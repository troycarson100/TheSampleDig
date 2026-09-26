import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createPluginCheckoutSession, readAffiliateCodeFromCookie, buyerFromSession } from "@/lib/plugin-checkout"
import { checkCart } from "@/lib/cart-ownership"
import { cartTotals } from "@/lib/cart-pricing"
import { PLUGIN_PRODUCTS, type PluginProduct } from "@/lib/plugin-products"

// Checkout for an arbitrary cart of plugins, built from a cart's worth of
// localStorage state or a hand-crafted request body - neither is trusted for
// what it may buy. What the buyer owns is looked up fresh, here, from their
// session or the email they give us, and checked against the cart with
// checkCart before a single price id is touched. A previous review on this
// branch found a bundle route hardcoded to two of the three plugins, letting
// an owner of the third read as owning nothing and pay full price for a
// bundle containing it; this route builds its line items from what checkCart
// says is actually sellable, not from a fixed list, so that shape of bug
// cannot recur here.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const body: { ids?: unknown; email?: unknown } = (await request.json().catch(() => null)) ?? {}
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : []
  const postedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""

  // Rule 1: resolve the buyer. A signed-in session always wins over a posted
  // email; a guest's email here is used only for our own ownership lookup
  // below, never forwarded to Stripe - Checkout collects it fresh, exactly as
  // every other guest checkout on the site does.
  const session = await auth()
  const buyer = buyerFromSession(session)
  if (!buyer && !postedEmail) {
    return NextResponse.json({ error: "Sign in or provide an email to check out." }, { status: 400 })
  }

  // Rule 2: what does this buyer actually own? Never taken from the request.
  const ownedIds = await ownedProductsFor(buyer?.id ?? null, postedEmail)

  // Rule 3: the client's cart is never trusted. A cart that is entirely
  // owned reports "empty" - there is nothing left to sell, so naming an item
  // would say nothing useful. A cart with SOME sellable items left reports
  // "already_owned" instead, naming exactly what has to come out of it before
  // the rest can be bought. Order matters here: a fully-owned cart satisfies
  // both `owned.length > 0` and `empty`, and it is the empty branch, checked
  // first, that must win.
  const check = checkCart(ids, ownedIds)
  if (check.empty) {
    return NextResponse.json({ reason: "empty" }, { status: 409 })
  }
  if (check.owned.length > 0) {
    return NextResponse.json({ reason: "already_owned", owns: check.owned }, { status: 409 })
  }

  // Rule 4: one line item at the bundle price when the sellable set is every
  // plugin, otherwise one line item per plugin at its own price.
  const totals = cartTotals(check.sellable)
  const priced = totals.bundleApplied
    ? { product: "bundle" as const, lineItems: [withPrice(process.env.STRIPE_BUNDLE3_PRICE_ID)] }
    : { product: check.sellable[0], lineItems: check.sellable.map((id) => withPrice(SINGLE_PRICE_ENV[id])) }

  // Rule 5: a charge must never go out at the wrong price. If any price this
  // cart needs is unset, refuse rather than fall back to something else.
  if (priced.lineItems.some((item) => item === null)) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const affiliateCode = await readAffiliateCodeFromCookie("cart checkout")

  try {
    const checkout = await createPluginCheckoutSession(new Stripe(secret), {
      product: priced.product,
      lineItems: priced.lineItems as { price: string; quantity: number }[],
      // The /thanks pixel must report what was actually charged, which is
      // the (possibly bundle-discounted) cart total, not the sum of list
      // prices for whatever was requested.
      paid: totals.total,
      cancelPath: "/checkout",
      buyer,
      affiliateCode,
      // The grant path (lib/plugin-purchase-grant.ts) resolves this list
      // first, falling back to PLUGIN_GRANTS[product] only when it is absent
      // - so a partial cart grants exactly what was sold, not a fixed pair.
      metadata: { products: check.sellable.join(",") },
    })
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    console.error("[cart checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}

const SINGLE_PRICE_ENV: Record<PluginProduct, string | undefined> = {
  shft: process.env.STRIPE_SHFT29_PRICE_ID,
  drft: process.env.STRIPE_DRFT29_PRICE_ID,
  fltr: process.env.STRIPE_FLTR_PRICE_ID,
}

function withPrice(priceId: string | undefined): { price: string; quantity: number } | null {
  return priceId ? { price: priceId, quantity: 1 } : null
}

/** What this buyer owns, looked up by user id when signed in or by email for
 *  a guest - never taken from the request body. Unknown user, unknown email,
 *  or no email at all all resolve to "owns nothing", the same shape checkCart
 *  already treats a brand-new buyer as. */
async function ownedProductsFor(userId: string | null, email: string): Promise<string[]> {
  let ownerId = userId
  if (!ownerId) {
    if (!email) return []
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    })
    if (!user) return []
    ownerId = user.id
  }
  const purchases = await prisma.purchase.findMany({
    where: { userId: ownerId, product: { in: [...PLUGIN_PRODUCTS] } },
    select: { product: true },
  })
  return purchases.map((p) => p.product)
}
