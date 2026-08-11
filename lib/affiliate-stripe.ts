import Stripe from "stripe"
import { prisma } from "@/lib/db"
import { canInstantPayout } from "@/lib/affiliate-logic"

// Every Stripe Connect call for the affiliate program lives here. Functions on
// the sale path (sendInstantCommission, reverseTransferForRefund) swallow all
// errors — a Stripe hiccup must never break a purchase or a webhook. Admin-
// facing functions throw so the UI can show what went wrong.

function getStripe(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY
  return secret ? new Stripe(secret) : null
}

// Creates the Express account on first use and returns a fresh hosted
// onboarding link. Throws with a readable message when Connect isn't ready.
export async function ensureOnboardingUrl(affiliateId: string, returnUrl: string): Promise<string> {
  const stripe = getStripe()
  if (!stripe) throw new Error("Payouts aren't ready yet.")
  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } })
  if (!affiliate) throw new Error("Unknown affiliate.")

  let accountId = affiliate.stripeAccountId
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: affiliate.email,
      capabilities: { transfers: { requested: true } },
      business_type: "individual",
      metadata: { affiliateId: affiliate.id, affiliateCode: affiliate.code },
    })
    accountId = account.id
    await prisma.affiliate.update({ where: { id: affiliate.id }, data: { stripeAccountId: accountId } })
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: returnUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  })
  return link.url
}

// Re-checks payouts_enabled while we have it cached as false (called on
// dashboard/admin loads instead of running Connect webhooks). Never throws.
export async function refreshPayoutStatus(affiliateId: string): Promise<boolean> {
  try {
    const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } })
    if (!affiliate?.stripeAccountId) return false
    if (affiliate.stripePayoutsEnabled) return true
    const stripe = getStripe()
    if (!stripe) return false
    const account = await stripe.accounts.retrieve(affiliate.stripeAccountId)
    if (account.payouts_enabled) {
      await prisma.affiliate.update({ where: { id: affiliate.id }, data: { stripePayoutsEnabled: true } })
      return true
    }
    return false
  } catch (e) {
    console.error("[affiliate stripe] refreshPayoutStatus failed:", e)
    return false
  }
}

// Instant per-sale payout: transfer the commission to the creator's account,
// tied to the buyer's charge so no platform float is needed. Sale-path — all
// errors are logged and swallowed; a failed transfer just leaves the sale owed.
export async function sendInstantCommission(referralId: string): Promise<void> {
  try {
    const stripe = getStripe()
    if (!stripe) return
    const referral = await prisma.affiliateReferral.findUnique({
      where: { id: referralId },
      include: { affiliate: true },
    })
    if (!referral) return
    if (
      !canInstantPayout({
        refundedAt: referral.refundedAt,
        stripeTransferId: referral.stripeTransferId,
        payoutId: referral.payoutId,
        stripeAccountId: referral.affiliate.stripeAccountId,
        stripePayoutsEnabled: referral.affiliate.stripePayoutsEnabled,
      })
    )
      return
    if (!referral.stripePaymentIntentId) return

    const paymentIntent = await stripe.paymentIntents.retrieve(referral.stripePaymentIntentId)
    const chargeId =
      typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id
    if (!chargeId) return

    const transfer = await stripe.transfers.create(
      {
        amount: referral.commissionCents,
        currency: referral.currency,
        destination: referral.affiliate.stripeAccountId as string,
        source_transaction: chargeId,
        metadata: { referralId: referral.id, affiliateCode: referral.affiliate.code },
      },
      { idempotencyKey: `aff-transfer-${referral.id}` }
    )
    await prisma.affiliateReferral.update({
      where: { id: referral.id },
      data: { stripeTransferId: transfer.id },
    })
  } catch (e) {
    console.error("[affiliate stripe] sendInstantCommission failed:", e)
  }
}

// Flushes an accrued owed balance (pre-onboarding sales, failed instant
// transfers) from the platform balance. Admin-facing: throws on failure with
// the DB left exactly as it was.
export async function payAccruedViaStripe(
  affiliateId: string
): Promise<{ id: string; amountCents: number } | null> {
  const stripe = getStripe()
  if (!stripe) throw new Error("Stripe is not configured.")
  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } })
  if (!affiliate?.stripeAccountId || !affiliate.stripePayoutsEnabled) {
    throw new Error("This creator hasn't finished Stripe setup.")
  }

  const stamped = await prisma.$transaction(async (tx) => {
    const owed = await tx.affiliateReferral.findMany({
      where: { affiliateId, payoutId: null, stripeTransferId: null, refundedAt: null },
      select: { id: true, commissionCents: true },
    })
    if (owed.length === 0) return null
    const amountCents = owed.reduce((s, r) => s + r.commissionCents, 0)
    const payout = await tx.affiliatePayout.create({
      data: { affiliateId, amountCents, note: "Stripe transfer pending" },
    })
    await tx.affiliateReferral.updateMany({
      where: { id: { in: owed.map((r) => r.id) } },
      data: { payoutId: payout.id },
    })
    return { payoutId: payout.id, amountCents }
  })
  if (!stamped) return null

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: stamped.amountCents,
        currency: "usd",
        destination: affiliate.stripeAccountId,
        metadata: { affiliateId, payoutId: stamped.payoutId },
      },
      { idempotencyKey: `aff-payout-${stamped.payoutId}` }
    )
    await prisma.affiliatePayout.update({
      where: { id: stamped.payoutId },
      data: { note: `Stripe transfer ${transfer.id}` },
    })
    return { id: stamped.payoutId, amountCents: stamped.amountCents }
  } catch (e) {
    // Roll the stamp back so the balance stays owed and the books stay true.
    await prisma.affiliateReferral.updateMany({
      where: { payoutId: stamped.payoutId },
      data: { payoutId: null },
    })
    await prisma.affiliatePayout.delete({ where: { id: stamped.payoutId } })
    throw e
  }
}

// Refund clawback for instantly-paid sales. Sale-path (webhook) — never throws;
// an unreversed transfer surfaces in the admin "refunded after payout" warning.
export async function reverseTransferForRefund(referralId: string): Promise<void> {
  try {
    const stripe = getStripe()
    if (!stripe) return
    const referral = await prisma.affiliateReferral.findUnique({ where: { id: referralId } })
    if (!referral?.stripeTransferId || referral.stripeTransferReversalId) return
    const reversal = await stripe.transfers.createReversal(
      referral.stripeTransferId,
      {},
      { idempotencyKey: `aff-reversal-${referral.id}` }
    )
    await prisma.affiliateReferral.update({
      where: { id: referral.id },
      data: { stripeTransferReversalId: reversal.id },
    })
  } catch (e) {
    console.error("[affiliate stripe] reverseTransferForRefund failed:", e)
  }
}
