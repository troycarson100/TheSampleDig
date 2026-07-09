import { NextResponse } from "next/server"
import Stripe from "stripe"

// One-time checkout for the shft plugin (guest checkout — no login required).
// Dormant until BOTH env vars are set, so the page can ship "as if selling"
// and go live the moment a Stripe product/price exists:
//   STRIPE_SECRET_KEY      — already used by the subscription checkout
//   STRIPE_SHFT_PRICE_ID   — the one-time price for shft (create at launch)
//
// TODO (post-purchase, separate phase): a webhook on checkout.session.completed
// that records a PluginLicense and emails the buyer a download link + key.
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_SHFT_PRICE_ID
  if (!secret || !priceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
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
      success_url: `${baseUrl}/shft?purchase=success`,
      cancel_url: `${baseUrl}/shft?purchase=canceled`,
      customer_creation: "always",
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      metadata: { product: "shft" },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (e) {
    console.error("[shft checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
