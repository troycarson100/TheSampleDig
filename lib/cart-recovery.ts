import type Stripe from "stripe"
import { prisma } from "@/lib/db"
import { accountIdByEmail } from "@/lib/account-by-email"
import { sendCartRecoveryEmail } from "@/lib/email"
import { cartRecoverySubject, renderCartRecoveryHtml } from "@/lib/cart-recovery-email"
import { decideRecoveryEmail, type RecoveryDecision } from "@/lib/cart-recovery-logic"
import { formatOfferDate } from "@/lib/member-offer-logic"
import { bundleWindow, BUNDLE_OFFER_ENDS } from "@/lib/plugins"

// Abandoned checkouts, the I/O: called by the Stripe webhook on
// `checkout.session.expired`. The rules are in lib/cart-recovery-logic.ts.
// Never throws into the webhook - a reminder that fails is logged, not
// retried, because a retry is how someone gets the same email twice.

export async function handleExpiredCheckout(stripe: Stripe, session: Stripe.Checkout.Session): Promise<RecoveryDecision> {
  const email = (session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase()

  // Every checkout this address started from this one on, so only the
  // newest of a run of attempts is written about. Stripe filters by the
  // address the buyer typed or we bound.
  const others = email
    ? (await stripe.checkout.sessions.list({ customer_details: { email }, created: { gte: session.created }, limit: 20 })).data
    : []

  const accountId = email ? await accountIdByEmail(prisma, email) : null
  const owned = accountId
    ? (await prisma.purchase.findMany({ where: { userId: accountId }, select: { product: true } })).map((p) => p.product)
    : []

  const decision = decideRecoveryEmail(session, others, owned)
  if (!decision.send) {
    console.log(`[cart recovery] ${session.id}: not sent (${decision.reason})`)
    return decision
  }

  const saleEnds = bundleWindow().live && BUNDLE_OFFER_ENDS ? formatOfferDate(new Date(BUNDLE_OFFER_ENDS)) : null
  try {
    await sendCartRecoveryEmail(
      decision.email,
      cartRecoverySubject(decision.products),
      renderCartRecoveryHtml({ products: decision.products, url: decision.url, saleEnds }),
    )
    console.log(`[cart recovery] ${session.id}: sent`)
  } catch (e) {
    console.error(`[cart recovery] ${session.id}: send failed`, e)
  }
  return decision
}
