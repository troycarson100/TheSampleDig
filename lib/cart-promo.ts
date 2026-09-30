import type { CartTotals } from "./cart-pricing"

// Promo codes, on this side of Stripe.
//
// A code is created and managed in the Stripe dashboard and Stripe is the only
// thing that ever decides what gets charged. Everything in this file is about
// the two things the site has to do before the buyer reaches Stripe: decide
// whether a string is worth asking Stripe about, and show what the order will
// cost with the code applied. The figure shown is worked out the way Stripe
// works it out, so the two agree — but it is a display, never the charge.
//
// Pure on purpose (no Stripe client, no fetch, no storage), so the cart, the
// checkout route and the tests all run the same arithmetic.

/** What a promo code is worth, reduced to what the site needs to show it. */
export interface PromoOffer {
  /** The code as Stripe has it, which is how it is shown back — not as typed. */
  code: string
  /** 0 < percentOff <= 100, or null for a fixed-amount code. */
  percentOff: number | null
  /** US cents, or null for a percentage code. */
  amountOffCents: number | null
  /** The smallest order, in US cents, the code may be used on. */
  minimumCents: number | null
  /** True when the coupon only covers certain products. Which of the cart's
   *  lines those are is Stripe's knowledge, not the site's, so a restricted
   *  code is carried to checkout but never priced here. */
  restricted: boolean
}

/** Stripe's own rule for a code: letters and digits, nothing else. The length
 *  limits are the site's — long enough for any real code, short enough that a
 *  pasted paragraph is refused before it is sent anywhere. */
const PROMO_CODE_RE = /^[A-Za-z0-9]{3,40}$/

/** The code to look up, or null when the input cannot be one. Surrounding
 *  space is forgiven (it comes with a paste); anything else is not repaired. */
export function normalizePromoCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const code = raw.trim()
  return PROMO_CODE_RE.test(code) ? code : null
}

/** The subset of Stripe's PromotionCode this file reads. Structural, so the
 *  tests can hand it plain objects and so it does not pin a Stripe version. */
export interface PromotionCodeLike {
  active: boolean
  code: string
  /** Unix seconds. Stripe leaves an expired code `active`. */
  expires_at?: number | null
  max_redemptions?: number | null
  times_redeemed?: number | null
  customer?: unknown
  customer_account?: unknown
  promotion?: {
    coupon?:
      | string
      | null
      | {
          valid?: boolean
          percent_off?: number | null
          amount_off?: number | null
          currency?: string | null
          applies_to?: { products?: string[] | null } | null
        }
  } | null
  restrictions?: {
    minimum_amount?: number | null
    minimum_amount_currency?: string | null
  } | null
}

/**
 * A Stripe promotion code as an offer, or null when it is not one this
 * checkout can honour. Every refusal is the same null on purpose: the caller
 * tells the visitor "that code isn't valid" whatever the reason, so the reply
 * never says whether a code exists, has expired, or belongs to someone else.
 *
 * Refused: an inactive code, one past its expiry or used as many times as it
 * may be (Stripe keeps both `active`, so the list call does not leave them
 * out), or an invalid coupon; a code tied to one customer
 * (checkout never passes Stripe a customer, so it could not be redeemed); a
 * coupon that arrived unexpanded; and anything not in US dollars.
 */
export function offerFromPromotionCode(pc: PromotionCodeLike, now: number = Date.now()): PromoOffer | null {
  if (!pc.active) return null
  if (typeof pc.expires_at === "number" && pc.expires_at * 1000 <= now) return null
  if (typeof pc.max_redemptions === "number" && (pc.times_redeemed ?? 0) >= pc.max_redemptions) return null
  if (pc.customer || pc.customer_account) return null

  const coupon = pc.promotion?.coupon
  if (!coupon || typeof coupon === "string") return null
  if (coupon.valid === false) return null

  const percentOff = typeof coupon.percent_off === "number" ? coupon.percent_off : null
  const amountOff = typeof coupon.amount_off === "number" ? coupon.amount_off : null

  if (percentOff !== null) {
    if (!(percentOff > 0 && percentOff <= 100)) return null
  } else if (amountOff !== null) {
    if (!(amountOff > 0) || coupon.currency !== "usd") return null
  } else {
    return null
  }

  const minimum = pc.restrictions?.minimum_amount
  let minimumCents: number | null = null
  if (typeof minimum === "number" && minimum > 0) {
    if (pc.restrictions?.minimum_amount_currency !== "usd") return null
    minimumCents = minimum
  }

  return {
    code: pc.code,
    percentOff,
    amountOffCents: percentOff === null ? amountOff : null,
    minimumCents,
    restricted: (coupon.applies_to?.products?.length ?? 0) > 0,
  }
}

/** Stored state is untrusted, the same as the cart's ids: a tampered offer
 *  must not be able to show a discount no code gives. It could never change
 *  the charge — checkout looks the code up again — but it should not be able
 *  to promise one either. */
export function sanitizeStoredOffer(value: unknown): PromoOffer | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  const code = normalizePromoCode(v.code)
  if (!code) return null
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null)
  const percentOff = num(v.percentOff)
  const amountOffCents = num(v.amountOffCents)
  const minimumCents = num(v.minimumCents)
  if (percentOff !== null) {
    if (!(percentOff > 0 && percentOff <= 100) || amountOffCents !== null) return null
  } else if (amountOffCents === null || !(amountOffCents > 0) || !Number.isInteger(amountOffCents)) {
    return null
  }
  if (minimumCents !== null && !(minimumCents > 0)) return null
  return { code, percentOff, amountOffCents, minimumCents, restricted: v.restricted === true }
}

export type PromoQuote =
  /** No code on the order. */
  | { kind: "none"; totalCents: number }
  /** The code applies and this is what it takes off. */
  | { kind: "applied"; discountCents: number; totalCents: number }
  /** The code only covers some products; Stripe works out which at payment. */
  | { kind: "at-payment"; totalCents: number }
  /** The order is too small for the code. */
  | { kind: "below-minimum"; minimumCents: number; totalCents: number }

/**
 * What the order costs with the offer on it.
 *
 * Priced the way Stripe prices it: a percentage is taken off each line item
 * and rounded there, not taken off the total and rounded once — the two can
 * differ by a cent, and the figure on this page has to be the figure on
 * Stripe's. The line items are whatever checkout will actually send: the
 * bundle as one line when it applies, otherwise each plugin as its own.
 */
export function quotePromo(totals: CartTotals, offer: PromoOffer | null): PromoQuote {
  const totalCents = totals.total * 100
  if (!offer || totals.lines.length === 0) return { kind: "none", totalCents }
  if (offer.minimumCents !== null && totalCents < offer.minimumCents) {
    return { kind: "below-minimum", minimumCents: offer.minimumCents, totalCents }
  }
  if (offer.restricted) return { kind: "at-payment", totalCents }

  const lineCents = totals.bundleApplied ? [totalCents] : totals.lines.map((l) => l.price * 100)
  const discountCents =
    offer.percentOff !== null
      ? lineCents.reduce((sum, c) => sum + Math.round((c * offer.percentOff!) / 100), 0)
      : Math.min(offer.amountOffCents ?? 0, totalCents)

  return { kind: "applied", discountCents, totalCents: totalCents - discountCents }
}

/** "$47.20", or "$47" when there are no cents to show — every price on the
 *  site is a whole number of dollars until a percentage gets involved. */
export function formatCents(cents: number): string {
  const whole = Math.trunc(cents / 100)
  const rest = Math.abs(cents % 100)
  return rest === 0 ? `$${whole}` : `$${whole}.${String(rest).padStart(2, "0")}`
}

/** "20% off" / "$10 off". */
export function describeOffer(offer: PromoOffer): string {
  return offer.percentOff !== null ? `${offer.percentOff}% off` : `${formatCents(offer.amountOffCents ?? 0)} off`
}
