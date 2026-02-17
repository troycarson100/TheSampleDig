import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Stripe from "stripe"
import { prisma } from "@/lib/db"

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const secret = process.env.STRIPE_SECRET_KEY
    const priceId = process.env.STRIPE_PRICE_ID
    if (!secret || !priceId) {
      return NextResponse.json(
        { error: "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID." },
        { status: 500 }
      )
    }

    const stripe = new Stripe(secret)
    const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    const successUrl = `${baseUrl}/pro?success=1`
    const cancelUrl = `${baseUrl}/pro?canceled=1`

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })

    const customerId = user?.stripeCustomerId ?? undefined
    const customerEmail = customerId ? undefined : session.user.email

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer: customerId,
      customer_email: customerEmail,
      client_reference_id: session.user.id,
      metadata: { userId: session.user.id },
      subscription_data: {
        metadata: { userId: session.user.id },
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (e: unknown) {
    console.error("[Stripe checkout]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 }
    )
  }
}
