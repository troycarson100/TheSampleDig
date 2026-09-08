import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PRICING } from "@/lib/products"
import { createPluginCheckoutSession, readAffiliateCodeFromCookie, buyerFromSession } from "@/lib/plugin-checkout"

// One-time checkout for the shft + drft bundle. One Stripe price, one line
// item; the webhook (and /api/plugins/claim) grant BOTH products.
// Signing in is optional. For a signed-in buyer the guard rails hold: owners
// of both get 409 already_owned; owners of one get 409 own_one — the
// storefront swaps to the $15 crossgrade offer instead, so no path through
// here can double-charge. A guest has no ownership to check and pays the
// bundle price.
// Dormant until STRIPE_SECRET_KEY + STRIPE_BUNDLE_PRICE_ID are set.
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_BUNDLE_PRICE_ID
  if (!secret || !priceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const session = await auth()
  const buyer = buyerFromSession(session)

  if (buyer) {
    const owned = await prisma.purchase.findMany({
      where: { userId: buyer.id, product: { in: ["shft", "drft"] } },
      select: { product: true },
    })
    const ownedSet = new Set(owned.map((p) => p.product))
    if (ownedSet.size === 2) {
      return NextResponse.json({ error: "already_owned" }, { status: 409 })
    }
    if (ownedSet.size === 1) {
      return NextResponse.json({ error: "own_one", owns: [...ownedSet][0] }, { status: 409 })
    }
  }

  const affiliateCode = await readAffiliateCodeFromCookie("bundle checkout")

  try {
    const checkout = await createPluginCheckoutSession(new Stripe(secret), {
      product: "bundle",
      priceId,
      paid: PRICING.bundle.price,
      cancelPath: "/plugins",
      buyer,
      affiliateCode,
    })
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    console.error("[bundle checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
