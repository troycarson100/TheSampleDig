import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { readCompleteSetToken } from "@/lib/complete-set-logic"
import { completeSetFor, completeSetSecret, ensureCompleteSetCoupon } from "@/lib/complete-set"
import { buyerFromSession, createPluginCheckoutSession, readAffiliateCodeFromCookie } from "@/lib/plugin-checkout"
import type { PluginProduct } from "@/lib/plugin-products"

// Buy the rest of the set at the complete-your-set price. Two ways in, one
// path: the button on /thanks POSTs the token and is sent the Checkout URL;
// the receipt's link GETs here and is redirected to it.
//
// The token names the account and when the offer ends. What is sold is
// worked out now, from what that account owns now - a link from yesterday
// never sells a plugin they have since bought, and the price follows how many
// are left. The checkout is bound to the account: its own id when its owner
// is signed in, otherwise its email as Stripe's read-only customer_email, so
// the webhook grants it to the account the offer was made to.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

const SINGLE_PRICE_ENV: Record<PluginProduct, string | undefined> = {
  shft: process.env.STRIPE_SHFT29_PRICE_ID,
  drft: process.env.STRIPE_DRFT29_PRICE_ID,
  fltr: process.env.STRIPE_FLTR29_PRICE_ID,
}

type Result = { url: string } | { error: string; status: number }

async function checkoutFor(token: unknown): Promise<Result> {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return { error: "Checkout is not configured.", status: 503 }

  const claim = readCompleteSetToken(completeSetSecret(), token)
  if (!claim) return { error: "This offer has ended.", status: 410 }

  const account = await prisma.user.findUnique({ where: { id: claim.userId }, select: { id: true, email: true } })
  const offer = account ? await completeSetFor(account.id) : null
  if (!account || !offer) return { error: "This offer has ended.", status: 410 }

  const lineItems = offer.missing.map((p) => SINGLE_PRICE_ENV[p])
  if (lineItems.some((price) => !price)) return { error: "Checkout is not configured.", status: 503 }

  const stripe = new Stripe(secret)
  const session = await auth()
  const viewer = buyerFromSession(session)
  const checkout = await createPluginCheckoutSession(stripe, {
    product: offer.missing[0],
    products: offer.missing,
    lineItems: lineItems.map((price) => ({ price: price!, quantity: 1 })),
    paid: offer.price,
    cancelPath: `/${offer.missing[0]}`,
    buyer: viewer?.id === account.id ? viewer : null,
    guestEmail: account.email,
    affiliateCode: await readAffiliateCodeFromCookie("complete set"),
    couponId: await ensureCompleteSetCoupon(stripe, offer.discountCents),
    metadata: { offer: "complete-set" },
  })
  return checkout.url ? { url: checkout.url } : { error: "Checkout failed.", status: 500 }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) ?? {}
  try {
    const r = await checkoutFor((body as { token?: unknown }).token)
    return "url" in r ? NextResponse.json({ url: r.url }) : NextResponse.json({ error: r.error }, { status: r.status })
  } catch (e) {
    console.error("[complete set]", e)
    return NextResponse.json({ error: "Checkout failed." }, { status: 500 })
  }
}

/** From the receipt. A link that has run out lands on the plugins rather
 *  than on an error. */
export async function GET(request: Request) {
  try {
    const r = await checkoutFor(new URL(request.url).searchParams.get("t"))
    if ("url" in r) return NextResponse.redirect(r.url, 303)
    return NextResponse.redirect(`${APP_URL}/products?offer=ended`, 303)
  } catch (e) {
    console.error("[complete set]", e)
    return NextResponse.redirect(`${APP_URL}/products?offer=ended`, 303)
  }
}
