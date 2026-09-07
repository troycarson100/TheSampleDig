import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PRICING } from "@/lib/products"
import { createPluginCheckoutSession, readAffiliateCodeFromCookie, buyerFromSession } from "@/lib/plugin-checkout"

// One-time checkout for the drft plugin. Signing in is optional: a guest pays
// the full price (ownership, and so the crossgrade, can only be checked
// against an account) and the webhook attaches the purchase to whatever email
// they give Stripe - creating the account if there isn't one.
// Dormant until BOTH env vars are set:
//   STRIPE_SECRET_KEY     — already used by the subscription checkout
//   STRIPE_DRFT_PRICE_ID  — the one-time price for drft
// Crossgrade: a signed-in user who already owns shft checks out against
// STRIPE_DRFT_CROSSGRADE_PRICE_ID ($15) instead, falling back to the full
// price ID if the crossgrade one isn't configured yet.
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const fullPriceId = process.env.STRIPE_DRFT_PRICE_ID
  if (!secret || !fullPriceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const session = await auth()
  const buyer = buyerFromSession(session)

  let priceId = fullPriceId
  let paid: number = PRICING.drft.price
  if (buyer) {
    // Already own it? Don't let them pay twice — send them to their downloads.
    const existing = await prisma.purchase.findUnique({
      where: { userId_product: { userId: buyer.id, product: "drft" } },
    })
    if (existing) {
      return NextResponse.json({ error: "already_owned" }, { status: 409 })
    }
    // Crossgrade: owning shft earns the $15 complete-the-pair price. Ownership
    // is checked server-side here — nothing client-controlled picks the price.
    const ownsShft = Boolean(
      await prisma.purchase.findUnique({
        where: { userId_product: { userId: buyer.id, product: "shft" } },
      })
    )
    const crossgradeId = process.env.STRIPE_DRFT_CROSSGRADE_PRICE_ID
    if (ownsShft && crossgradeId) {
      priceId = crossgradeId
      paid = PRICING.crossgrade.price
    }
  }

  const affiliateCode = await readAffiliateCodeFromCookie("drft checkout")

  try {
    const checkout = await createPluginCheckoutSession(new Stripe(secret), {
      product: "drft",
      priceId,
      paid,
      cancelPath: "/drft",
      buyer,
      affiliateCode,
    })
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    console.error("[drft checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
