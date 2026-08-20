import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"
import { readAttributionMetadata } from "@/lib/attribution-snapshot"
import { PRICING } from "@/lib/products"

// One-time checkout for the shft plugin. Requires login so the purchase can be
// tied to an account and surfaced on the /products page.
// Dormant until BOTH env vars are set:
//   STRIPE_SECRET_KEY      — already used by the subscription checkout
//   STRIPE_SHFT_PRICE_ID   — the one-time price for shft
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_SHFT_PRICE_ID
  if (!secret || !priceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 })
  }

  // Already own it? Don't let them pay twice — send them to their downloads.
  const existing = await prisma.purchase.findUnique({
    where: { userId_product: { userId: session.user.id, product: "shft" } },
  })
  if (existing) {
    return NextResponse.json({ error: "already_owned" }, { status: 409 })
  }

  // Crossgrade: owning drft earns the $15 complete-the-pair price. Ownership is
  // checked server-side here — nothing client-controlled picks the price.
  const ownsDrft = Boolean(
    await prisma.purchase.findUnique({
      where: { userId_product: { userId: session.user.id, product: "drft" } },
    })
  )
  const crossgradeId = process.env.STRIPE_SHFT_CROSSGRADE_PRICE_ID
  const chosenPriceId = ownsDrft && crossgradeId ? crossgradeId : priceId
  const paidValue = ownsDrft && crossgradeId ? PRICING.crossgrade.price : PRICING.shft.price

  // Affiliate attribution: forward a valid ?ref= cookie code into session
  // metadata; the webhook re-validates it against an active affiliate.
  let affiliateCode: string | null = null
  try {
    const cookieStore = await cookies()
    const raw = normalizeAffiliateCode(cookieStore.get("shft_ref")?.value)
    if (raw) {
      const affiliate = await prisma.affiliate.findUnique({ where: { code: raw } })
      if (affiliate?.active) affiliateCode = raw
    }
  } catch (e) {
    console.error("[shft checkout] affiliate cookie read failed", e)
  }

  try {
    const stripe = new Stripe(secret)
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    const attrMetadata = await readAttributionMetadata()

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: chosenPriceId, quantity: 1 }],
      success_url: `${baseUrl}/shft?purchase=success&session_id={CHECKOUT_SESSION_ID}&paid=${paidValue}`,
      cancel_url: `${baseUrl}/shft?purchase=canceled`,
      customer_creation: "always",
      customer_email: session.user.email || undefined,
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      client_reference_id: session.user.id,
      metadata: {
        product: "shft",
        userId: session.user.id,
        ...(affiliateCode ? { affiliateCode } : {}),
        ...attrMetadata,
      },
      custom_fields: [
        {
          key: "creator_code",
          label: { type: "custom", custom: "Creator code (optional)" },
          type: "text",
          optional: true,
        },
      ],
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (e) {
    console.error("[shft checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
