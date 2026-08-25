// Pure attribution/commission logic for the creator program (shft, drft, and
// the bundle). No DB or Stripe imports — tested standalone by
// scripts/test-affiliate-logic.ts.

export function normalizeAffiliateCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const code = raw.toLowerCase().replace(/\s+/g, "")
  return /^[a-z0-9-]{2,32}$/.test(code) ? code : null
}

export function computeCommissionCents(amountTotalCents: number, percent: number): number {
  if (amountTotalCents <= 0 || percent <= 0) return 0
  return Math.round((amountTotalCents * percent) / 100)
}

// Ordered attribution candidates: a code typed at checkout beats the ?ref= cookie.
export function attributionCandidates(input: {
  typedCode?: string | null
  cookieCode?: string | null
}): { code: string; source: "code" | "link" }[] {
  const typed = normalizeAffiliateCode(input.typedCode)
  const cookie = normalizeAffiliateCode(input.cookieCode)
  const out: { code: string; source: "code" | "link" }[] = []
  if (typed) out.push({ code: typed, source: "code" })
  if (cookie && cookie !== typed) out.push({ code: cookie, source: "link" })
  return out
}

// Commission for one sale under the affiliate's deal: "flat" pays a fixed
// amount per sale (never more than the sale itself); anything else pays a
// percent of what the buyer paid.
export function computeCommission(input: {
  amountTotalCents: number
  commissionType: string
  commissionPercent: number
  commissionFlatCents: number | null
}): number {
  if (input.amountTotalCents <= 0) return 0
  if (input.commissionType === "flat") {
    return Math.max(0, Math.min(input.commissionFlatCents ?? 0, input.amountTotalCents))
  }
  return computeCommissionCents(input.amountTotalCents, input.commissionPercent)
}

// A referral qualifies for an instant Stripe transfer only when nothing has
// paid it yet (manually or via Stripe), it isn't refunded, and the affiliate
// has a payout-ready Connect account.
export function canInstantPayout(input: {
  refundedAt: Date | null
  stripeTransferId: string | null
  payoutId: string | null
  stripeAccountId: string | null
  stripePayoutsEnabled: boolean
}): boolean {
  return (
    input.refundedAt === null &&
    input.stripeTransferId === null &&
    input.payoutId === null &&
    input.stripeAccountId !== null &&
    input.stripePayoutsEnabled
  )
}

export function isSelfReferral(input: {
  affiliateEmail: string
  affiliateUserId: string | null
  buyerEmail: string | null
  buyerUserId: string | null
}): boolean {
  if (input.buyerEmail && input.buyerEmail.toLowerCase() === input.affiliateEmail.toLowerCase()) return true
  if (input.buyerUserId && input.affiliateUserId && input.buyerUserId === input.affiliateUserId) return true
  return false
}

// The product a referral was earned on, taken from Stripe session metadata:
// "shft" | "drft" | "bundle". Permissive on purpose — a future product slug
// labels itself correctly without anyone remembering to edit a list here.
// Falls back to "shft", matching the column default, for the legacy/missing
// case: every referral recorded before this column existed was a shft sale.
export function normalizeReferralProduct(raw: string | null | undefined): string {
  const product = (raw ?? "").toLowerCase().trim()
  return /^[a-z0-9-]{2,16}$/.test(product) ? product : "shft"
}
