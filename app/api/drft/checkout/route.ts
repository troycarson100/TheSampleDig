import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PRICING } from "@/lib/products"
import { createPluginCheckoutSession, readAffiliateCodeFromCookie, buyerFromSession } from "@/lib/plugin-checkout"

// One-time checkout for the drft plugin. Signing in is optional: a guest pays
// the full price (ownership can only be checked against an account) and the
// webhook attaches the purchase to whatever email they give Stripe - creating
// the account if there isn't one.
// Dormant until BOTH env vars are set:
//   STRIPE_SECRET_KEY     — already used by the subscription checkout
//   STRIPE_DRFT_PRICE_ID  — the one-time price for drft
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_DRFT_PRICE_ID
  if (!secret || !priceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const session = await auth()
  const buyer = buyerFromSession(session)

  const paid: number = PRICING.drft.price
  if (buyer) {
    // Already own it? Don't let them pay twice — send them to their downloads.
    const existing = await prisma.purchase.findUnique({
      where: { userId_product: { userId: buyer.id, product: "drft" } },
    })
    if (existing) {
      return NextResponse.json({ error: "already_owned" }, { status: 409 })
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
