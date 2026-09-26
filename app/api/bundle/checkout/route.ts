import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PRICING } from "@/lib/products"
import { createPluginCheckoutSession, readAffiliateCodeFromCookie, buyerFromSession } from "@/lib/plugin-checkout"
import { checkCart } from "@/lib/cart-ownership"
import { PLUGIN_PRODUCTS } from "@/lib/plugin-products"

// One-time checkout for the shft + drft + fltr bundle. One Stripe price, one
// line item; the webhook (and /api/plugins/claim) grant ALL THREE products.
// Signing in is optional. For a signed-in buyer the guard rail holds: any
// ownership at all — one, two or all three — gets a 409 (already_owned or
// partial_owner) rather than a checkout session, so no path through here can
// double-charge. There is no discounted upgrade price to offer a partial owner
// instead; they buy the singles they are missing. A guest has no ownership to
// check and pays the bundle price.
// Dormant until STRIPE_SECRET_KEY + STRIPE_BUNDLE3_PRICE_ID are set.
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_BUNDLE3_PRICE_ID
  if (!secret || !priceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const session = await auth()
  const buyer = buyerFromSession(session)

  if (buyer) {
    const owned = await prisma.purchase.findMany({
      where: { userId: buyer.id, product: { in: [...PLUGIN_PRODUCTS] } },
      select: { product: true },
    })
    // TEMPORARY bridge: bundleEligibility was retired in favour of checkCart
    // (see lib/cart-ownership.ts). Task 8 deletes this route outright, so this
    // is reconstructed to match the old reason codes exactly rather than
    // redesigned. Remove this block along with the route in Task 8.
    const check = checkCart([...PLUGIN_PRODUCTS], owned.map((p) => p.product))
    if (check.owned.length > 0) {
      const reason = check.owned.length === PLUGIN_PRODUCTS.length ? "already_owned" : "partial_owner"
      return NextResponse.json({ error: reason, owns: check.owned }, { status: 409 })
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
