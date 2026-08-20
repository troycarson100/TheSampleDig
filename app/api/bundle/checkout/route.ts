import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"
import { readAttributionMetadata } from "@/lib/attribution-snapshot"
import { PRICING } from "@/lib/products"

// One-time checkout for the shft + drft bundle. One Stripe price, one line
// item; the webhook (and /api/bundle/claim) grant BOTH products.
// Guard rails: owners of both get 409 already_owned; owners of one get 409
// own_one — the storefront swaps to the $15 crossgrade offer instead, so no
// path through here can double-charge.
// Dormant until STRIPE_SECRET_KEY + STRIPE_BUNDLE_PRICE_ID are set.
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_BUNDLE_PRICE_ID
  if (!secret || !priceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 })
  }

  const owned = await prisma.purchase.findMany({
    where: { userId: session.user.id, product: { in: ["shft", "drft"] } },
    select: { product: true },
  })
  const ownedSet = new Set(owned.map((p) => p.product))
  if (ownedSet.size === 2) {
    return NextResponse.json({ error: "already_owned" }, { status: 409 })
  }
  if (ownedSet.size === 1) {
    return NextResponse.json({ error: "own_one", owns: [...ownedSet][0] }, { status: 409 })
  }

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
    console.error("[bundle checkout] affiliate cookie read failed", e)
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
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/plugins?purchase=success&session_id={CHECKOUT_SESSION_ID}&paid=${PRICING.bundle.price}`,
      cancel_url: `${baseUrl}/plugins?purchase=canceled`,
      customer_creation: "always",
      customer_email: session.user.email || undefined,
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      client_reference_id: session.user.id,
      metadata: {
        product: "bundle",
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
    console.error("[bundle checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
