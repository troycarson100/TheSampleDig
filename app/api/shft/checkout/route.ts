import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

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

  try {
    const stripe = new Stripe(secret)
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/shft?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/shft?purchase=canceled`,
      customer_creation: "always",
      customer_email: session.user.email || undefined,
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      client_reference_id: session.user.id,
      metadata: { product: "shft", userId: session.user.id },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (e) {
    console.error("[shft checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
