import { NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/db"
import { PLUGIN_GRANTS, isCompProduct } from "@/lib/plugin-products"
import { sendPluginPurchaseEmail } from "@/lib/email"
import { recordAffiliateReferral } from "@/lib/affiliate"
import { generateLicenseKey } from "@/lib/license-key"
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
        // metadata.product → which Purchase rows to grant. The map lives in
        // lib/plugin-products so comp codes grant exactly what a purchase does;
        // it used to be defined here while comps hardcoded "shft", and two
        // copies of a grant map is how the wrong product gets handed out.
        const metaProduct = session.metadata?.product ?? ""
        const grantProducts = isCompProduct(metaProduct) ? PLUGIN_GRANTS[metaProduct] : undefined
        if (grantProducts) {
          const buyerId = session.client_reference_id ?? session.metadata?.userId
          // Hoisted: the email below is sent even when there is no buyerId, and
          // it needs the keys. Missing keys are omitted from the template rather
          // than printing something that cannot activate.
          const emailItems: { product: "shft" | "drft"; licenseKey: string | null }[] = []

          if (buyerId && typeof buyerId === "string") {
            let referralPurchaseId: string | null = null
            let first = true
            for (const product of grantProducts) {
              // stripeSessionId is @unique on Purchase: one checkout session
              // cannot stamp two rows, so only the FIRST granted product
              // carries it (bundle: shft — the same row the referral hangs
              // off). The second row is created with null, like comp grants.
              const purchase = await prisma.purchase.upsert({
                where: { userId_product: { userId: buyerId, product } },
                create: {
                  userId: buyerId,
                  product,
                  stripeSessionId: first ? session.id : null,
                  licenseKey: generateLicenseKey(product),
                },
                // Never regenerate: a buyer may already have the old key in the
                // plugin, and rotating it would deactivate them silently.
                update: first ? { stripeSessionId: session.id } : {},
              })
              first = false

              let licenseKey = purchase.licenseKey
              if (!licenseKey) {
                // The row predates licensing, or was created by an older deploy.
                //
                // Conditional update, then re-read: this route and the claim
                // routes can run concurrently on the same purchase. A
                // read-then-write would let the second mint overwrite the first,
                // so the buyer gets emailed a key that is no longer on their
                // account. With licenseKey:null in the WHERE the loser writes
                // nothing, and the re-read returns whichever key actually won.
                await prisma.purchase.updateMany({
                  where: { id: purchase.id, licenseKey: null },
                  data: { licenseKey: generateLicenseKey(product) },
                })
                const filled = await prisma.purchase.findUnique({
                  where: { id: purchase.id },
                  select: { licenseKey: true },
                })
                licenseKey = filled?.licenseKey ?? null
              }
              emailItems.push({ product, licenseKey })
              // One referral per checkout session — first granted product only
              // (the AffiliateReferral↔Purchase relation is one-to-one).
              if (!referralPurchaseId) referralPurchaseId = purchase.id
            }
            if (referralPurchaseId) {
              await recordAffiliateReferral(session, referralPurchaseId)
            }
          } else {
            console.warn("[Stripe webhook] plugin purchase missing userId")
          }
          const email = session.customer_details?.email ?? session.customer_email ?? null
          if (email) {
            try {
              await sendPluginPurchaseEmail(
                email,
                emailItems.length
                  ? emailItems
                  : grantProducts.map((product) => ({ product, licenseKey: null }))
              )
            } catch (e) {
              console.error("[Stripe webhook] plugin purchase email failed:", e)
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
