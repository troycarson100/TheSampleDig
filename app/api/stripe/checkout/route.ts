import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Stripe from "stripe"
import { prisma } from "@/lib/db"

const ALLOWED_TRIAL_DAYS = new Set([7, 14])

export async function POST(req: Request) {
  try {
    let trialDays = 7
    const ct = req.headers.get("content-type")
    if (ct?.includes("application/json")) {
      try {
        const body = (await req.json()) as { trialDays?: unknown }
        const n = typeof body?.trialDays === "number" ? body.trialDays : Number(body?.trialDays)
        if (ALLOWED_TRIAL_DAYS.has(n)) trialDays = n
      } catch {
        /* empty or invalid JSON — default 7 */
      }
    }

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
    const successUrl = `${baseUrl}/dig?checkout_success=1`
    const cancelUrl = `${baseUrl}/dig?checkout_canceled=1`

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })

    // Accounts V2: Checkout in test mode requires an existing Customer; `customer_email` alone is rejected.
    // Always attach a Customer id (create + persist when missing).
    let customerId = user?.stripeCustomerId ?? null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email ?? undefined,
        metadata: { userId: session.user.id },
      })
      customerId = customer.id
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer: customerId,
      client_reference_id: session.user.id,
      metadata: { userId: session.user.id },
      subscription_data: {
        metadata: { userId: session.user.id },
        trial_period_days: trialDays,
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
