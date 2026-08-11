import type Stripe from "stripe"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/db"
import { attributionCandidates, computeCommissionCents, isSelfReferral } from "@/lib/affiliate-logic"

export interface AffiliateStats {
  clicksTotal: number
  clicks30d: number
  salesCount: number
  grossCents: number
  commissionCents: number
  owedCents: number
  refundedAfterPayoutCents: number
  payouts: { id: string; amountCents: number; note: string | null; paidAt: Date }[]
  referrals: {
    id: string
    createdAt: Date
    grossAmountCents: number
    commissionCents: number
    source: string
    refundedAt: Date | null
    paidOut: boolean
  }[]
}

export function generateDashboardToken(): string {
  return randomBytes(24).toString("base64url")
}

// Called from BOTH the Stripe webhook and the /api/shft/claim self-heal path
// after the Purchase upsert. Idempotent (unique purchaseId) and deliberately
// swallows every error — attribution must never break a purchase.
export async function recordAffiliateReferral(
  session: Stripe.Checkout.Session,
  purchaseId: string
): Promise<void> {
  try {
    const typedCode = session.custom_fields?.find((f) => f.key === "creator_code")?.text?.value ?? null
    const cookieCode = session.metadata?.affiliateCode ?? null
    const candidates = attributionCandidates({ typedCode, cookieCode })
    if (candidates.length === 0) return

    const buyerEmail = session.customer_details?.email ?? session.customer_email ?? null
    const buyerUserId = session.client_reference_id ?? session.metadata?.userId ?? null
    const amountTotal = session.amount_total ?? 0
    if (amountTotal <= 0) return

    for (const candidate of candidates) {
      const affiliate = await prisma.affiliate.findUnique({ where: { code: candidate.code } })
      if (!affiliate || !affiliate.active) continue
      if (
        isSelfReferral({
          affiliateEmail: affiliate.email,
          affiliateUserId: affiliate.userId,
          buyerEmail,
          buyerUserId,
        })
      ) {
        console.warn(`[affiliate] self-referral skipped: ${affiliate.code}`)
        return
      }

      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null

      try {
        await prisma.affiliateReferral.create({
          data: {
            affiliateId: affiliate.id,
            purchaseId,
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
            grossAmountCents: amountTotal,
            commissionCents: computeCommissionCents(amountTotal, affiliate.commissionPercent),
            currency: session.currency ?? "usd",
            source: candidate.source,
          },
        })
      } catch (e: unknown) {
        // P2002 = referral already recorded (webhook/claim race) — success.
        if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") return
        throw e
      }
      return
    }
  } catch (e) {
    console.error("[affiliate] recordAffiliateReferral failed:", e)
  }
}

export async function getAffiliateStats(affiliateId: string): Promise<AffiliateStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [clicksTotal, clicks30d, referrals, payouts] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateId } }),
    prisma.affiliateClick.count({ where: { affiliateId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.affiliateReferral.findMany({ where: { affiliateId }, orderBy: { createdAt: "desc" } }),
    prisma.affiliatePayout.findMany({ where: { affiliateId }, orderBy: { paidAt: "desc" } }),
  ])

  const live = referrals.filter((r) => !r.refundedAt)
  const sum = (rows: { commissionCents: number }[]) => rows.reduce((s, r) => s + r.commissionCents, 0)

  return {
    clicksTotal,
    clicks30d,
    salesCount: live.length,
    grossCents: live.reduce((s, r) => s + r.grossAmountCents, 0),
    commissionCents: sum(live),
    owedCents: sum(live.filter((r) => !r.payoutId)),
    refundedAfterPayoutCents: sum(referrals.filter((r) => r.refundedAt && r.payoutId)),
    payouts: payouts.map((p) => ({ id: p.id, amountCents: p.amountCents, note: p.note, paidAt: p.paidAt })),
    referrals: referrals.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      grossAmountCents: r.grossAmountCents,
      commissionCents: r.commissionCents,
      source: r.source,
      refundedAt: r.refundedAt,
      paidOut: r.payoutId !== null,
    })),
  }
}

// Pays out ALL currently-owed referrals; amount is computed server-side so the
// payout row and stamped referrals always agree. Returns null when nothing owed.
export async function recordPayout(
  affiliateId: string,
  note: string | null
): Promise<{ id: string; amountCents: number } | null> {
  return prisma.$transaction(async (tx) => {
    const owed = await tx.affiliateReferral.findMany({
      where: { affiliateId, payoutId: null, refundedAt: null },
      select: { id: true, commissionCents: true },
    })
    if (owed.length === 0) return null
    const amountCents = owed.reduce((s, r) => s + r.commissionCents, 0)
    const payout = await tx.affiliatePayout.create({ data: { affiliateId, amountCents, note } })
    await tx.affiliateReferral.updateMany({
      where: { id: { in: owed.map((r) => r.id) } },
      data: { payoutId: payout.id },
    })
    return { id: payout.id, amountCents }
  })
}
