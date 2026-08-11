import { NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/db"
import { sendShftPurchaseEmail } from "@/lib/email"
import { recordAffiliateReferral } from "@/lib/affiliate"

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[Stripe webhook] STRIPE_WEBHOOK_SECRET not set")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch (e) {
    console.error("[Stripe webhook] Failed to read body", e)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const sig = request.headers.get("stripe-signature")
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = Stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[Stripe webhook] Signature verification failed:", message)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        // --- shft plugin: one-time purchase, recorded against the user account. ---
        if (session.metadata?.product === "shft") {
          const buyerId = session.client_reference_id ?? session.metadata?.userId
          if (buyerId && typeof buyerId === "string") {
            const purchase = await prisma.purchase.upsert({
              where: { userId_product: { userId: buyerId, product: "shft" } },
              create: { userId: buyerId, product: "shft", stripeSessionId: session.id },
              update: { stripeSessionId: session.id },
            })
            await recordAffiliateReferral(session, purchase.id)
          } else {
            console.warn("[Stripe webhook] shft purchase missing userId")
          }
          const email = session.customer_details?.email ?? session.customer_email ?? null
          if (email) {
            try {
              await sendShftPurchaseEmail(email)
            } catch (e) {
              console.error("[Stripe webhook] shft purchase email failed:", e)
            }
          }
          break
        }

        const userId = session.client_reference_id ?? session.metadata?.userId
        if (!userId || typeof userId !== "string") {
          console.warn("[Stripe webhook] checkout.session.completed missing userId")
          break
        }
        const customerId = session.customer
          ? typeof session.customer === "string"
            ? session.customer
            : session.customer.id
          : null
        const subscriptionId = session.subscription
          ? typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id
          : null

        let periodEnd: Date | null = null
        if (subscriptionId) {
          const stripe = new Stripe(secret)
          const sub = await stripe.subscriptions.retrieve(subscriptionId) as { current_period_end?: number }
          periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: customerId ?? undefined,
            subscriptionStatus: subscriptionId ? "active" : undefined,
            subscriptionCurrentPeriodEnd: periodEnd ?? undefined,
          },
        })
        break
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription & { current_period_end?: number }
        const userId = subscription.metadata?.userId
        if (!userId || typeof userId !== "string") {
          console.warn("[Stripe webhook] subscription event missing userId in metadata")
          break
        }
        // Persist Stripe statuses that still grant access; everything else → canceled (was incorrectly mapping trialing → canceled).
        const raw = subscription.status
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : raw === "active" || raw === "trialing" || raw === "past_due" || raw === "paused"
              ? raw
              : "canceled"
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null

        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: status,
            subscriptionCurrentPeriodEnd: periodEnd ?? undefined,
          },
        })
        break
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId =
          typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id
        if (!paymentIntentId) break
        // Any refund (full or partial) claws back the whole commission (v1 policy).
        await prisma.affiliateReferral.updateMany({
          where: { stripePaymentIntentId: paymentIntentId, refundedAt: null },
          data: { refundedAt: new Date() },
        })
        break
      }

      default:
        // Unhandled event type
        break
    }
  } catch (e) {
    console.error("[Stripe webhook] Handler error:", e)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
