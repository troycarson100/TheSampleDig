import { NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/db"
import { isCompProduct } from "@/lib/plugin-products"
import { sendPluginPurchaseEmail } from "@/lib/email"
import { grantPluginPurchase } from "@/lib/plugin-purchase-grant"
import { mintSetPasswordUrl } from "@/lib/set-password"
import { reverseTransferForRefund } from "@/lib/affiliate-stripe"

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

        // --- Plugin purchases: single products and the bundle. -----------------
        // All the grant logic (find-or-create the buyer, create-or-read the
        // Purchase rows, mint keys, record the referral) lives in
        // lib/plugin-purchase-grant.ts and is shared with /api/plugins/claim,
        // so the two can run in either order. This route's only extra job is
        // the receipt email, sent exactly once, from here.
        if (isCompProduct(session.metadata?.product)) {
          const result = await grantPluginPurchase(session)
          if (!result) {
            console.warn(`[Stripe webhook] plugin purchase ${session.id} could not be granted`)
            break
          }
          try {
            // A purchase-created account has no password yet; the receipt is
            // where the buyer gets the link to set one. An account with a real
            // password is told to sign in instead - never handed a reset link.
            const setPasswordUrl = result.needsPassword ? await mintSetPasswordUrl(result.userId) : null
            await sendPluginPurchaseEmail(result.email, result.items, {
              setPasswordUrl,
              duplicates: result.duplicates,
            })
          } catch (e) {
            console.error("[Stripe webhook] plugin purchase email failed:", e)
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
        // Any refund (full or partial) claws back the whole commission (v1
        // policy). Instantly-transferred commissions also get the Stripe
        // transfer reversed; a failed reversal surfaces in the admin warning.
        const refunded = await prisma.affiliateReferral.findMany({
          where: { stripePaymentIntentId: paymentIntentId, refundedAt: null },
          select: { id: true },
        })
        for (const referral of refunded) {
          await prisma.affiliateReferral.update({
            where: { id: referral.id },
            data: { refundedAt: new Date() },
          })
          await reverseTransferForRefund(referral.id)
        }
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
