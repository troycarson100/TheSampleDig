import { test } from "node:test"
import assert from "node:assert/strict"
import { cartTotals } from "./cart-pricing"
import { PRICING } from "./products"
import {
  describeOffer,
  formatCents,
  normalizePromoCode,
  offerFromPromotionCode,
  quotePromo,
  sanitizeStoredOffer,
  type PromoOffer,
  type PromotionCodeLike,
} from "./cart-promo"

const percent = (p: number, extra: Partial<PromoOffer> = {}): PromoOffer => ({
  code: "SAVE", percentOff: p, amountOffCents: null, minimumCents: null, restricted: false, ...extra,
})
const amount = (cents: number, extra: Partial<PromoOffer> = {}): PromoOffer => ({
  code: "SAVE", percentOff: null, amountOffCents: cents, minimumCents: null, restricted: false, ...extra,
})

const stripeCode = (over: Partial<PromotionCodeLike> = {}): PromotionCodeLike => ({
  active: true,
  code: "SAVE20",
  customer: null,
  customer_account: null,
  promotion: { coupon: { valid: true, percent_off: 20, amount_off: null, currency: null } },
  restrictions: { minimum_amount: null, minimum_amount_currency: null },
  ...over,
})

// ---- normalizePromoCode ---------------------------------------------------

test("normalizePromoCode: letters and digits pass, with the space a paste brings trimmed", () => {
  assert.equal(normalizePromoCode("SAVE20"), "SAVE20")
  assert.equal(normalizePromoCode("  save20\n"), "save20")
})

test("normalizePromoCode: anything Stripe would not accept as a code is refused, not repaired", () => {
  for (const bad of ["", "  ", "ab", "SAVE 20", "SAVE-20", "save_20", "50%", "<script>", "a".repeat(41)]) {
    assert.equal(normalizePromoCode(bad), null, JSON.stringify(bad))
  }
})

test("normalizePromoCode: a non-string is refused", () => {
  for (const bad of [undefined, null, 20, ["SAVE20"], { code: "SAVE20" }]) {
    assert.equal(normalizePromoCode(bad), null)
  }
})

// ---- offerFromPromotionCode -------------------------------------------------

test("offerFromPromotionCode: a percentage code, shown with Stripe's casing", () => {
  assert.deepEqual(offerFromPromotionCode(stripeCode()), percent(20, { code: "SAVE20" }))
})

test("offerFromPromotionCode: a fixed-amount code in dollars", () => {
  const pc = stripeCode({ promotion: { coupon: { valid: true, percent_off: null, amount_off: 1000, currency: "usd" } } })
  assert.deepEqual(offerFromPromotionCode(pc), amount(1000, { code: "SAVE20" }))
})

test("offerFromPromotionCode: a fixed amount in any other currency is refused", () => {
  const pc = stripeCode({ promotion: { coupon: { valid: true, percent_off: null, amount_off: 1000, currency: "eur" } } })
  assert.equal(offerFromPromotionCode(pc), null)
})

test("offerFromPromotionCode: a code past its expiry is refused, though Stripe still calls it active", () => {
  const NOW = Date.parse("2026-10-15T12:00:00.000Z")
  const at = (iso: string) => Date.parse(iso) / 1000
  assert.equal(offerFromPromotionCode(stripeCode({ expires_at: at("2026-10-15T11:59:59.000Z") }), NOW), null)
  assert.equal(offerFromPromotionCode(stripeCode({ expires_at: at("2026-10-15T12:00:00.000Z") }), NOW), null)
  assert.ok(offerFromPromotionCode(stripeCode({ expires_at: at("2026-10-15T12:00:01.000Z") }), NOW))
  assert.ok(offerFromPromotionCode(stripeCode({ expires_at: null }), NOW))
})

test("offerFromPromotionCode: a single-use code that has been used is refused", () => {
  assert.equal(offerFromPromotionCode(stripeCode({ max_redemptions: 1, times_redeemed: 1 })), null)
  assert.ok(offerFromPromotionCode(stripeCode({ max_redemptions: 1, times_redeemed: 0 })))
  assert.ok(offerFromPromotionCode(stripeCode({ max_redemptions: null, times_redeemed: 40 })))
})

test("offerFromPromotionCode: an inactive code, or an invalid coupon, is refused", () => {
  assert.equal(offerFromPromotionCode(stripeCode({ active: false })), null)
  assert.equal(
    offerFromPromotionCode(stripeCode({ promotion: { coupon: { valid: false, percent_off: 20 } } })),
    null,
  )
})

test("offerFromPromotionCode: a code tied to one customer is refused — checkout could not redeem it", () => {
  assert.equal(offerFromPromotionCode(stripeCode({ customer: "cus_123" })), null)
  assert.equal(offerFromPromotionCode(stripeCode({ customer_account: "acct_123" })), null)
})

test("offerFromPromotionCode: a coupon that arrived unexpanded is refused rather than guessed at", () => {
  assert.equal(offerFromPromotionCode(stripeCode({ promotion: { coupon: "co_123" } })), null)
  assert.equal(offerFromPromotionCode(stripeCode({ promotion: { coupon: null } })), null)
  assert.equal(offerFromPromotionCode(stripeCode({ promotion: null })), null)
})

test("offerFromPromotionCode: a coupon worth nothing, or more than everything, is refused", () => {
  for (const p of [0, -5, 101]) {
    assert.equal(offerFromPromotionCode(stripeCode({ promotion: { coupon: { valid: true, percent_off: p } } })), null, `${p}%`)
  }
  assert.equal(
    offerFromPromotionCode(stripeCode({ promotion: { coupon: { valid: true, amount_off: 0, currency: "usd" } } })),
    null,
  )
})

test("offerFromPromotionCode: a minimum order is carried, in cents", () => {
  const pc = stripeCode({ restrictions: { minimum_amount: 5000, minimum_amount_currency: "usd" } })
  assert.equal(offerFromPromotionCode(pc)?.minimumCents, 5000)
})

test("offerFromPromotionCode: a minimum in another currency is refused — it cannot be compared", () => {
  const pc = stripeCode({ restrictions: { minimum_amount: 5000, minimum_amount_currency: "eur" } })
  assert.equal(offerFromPromotionCode(pc), null)
})

test("offerFromPromotionCode: a coupon limited to certain products is marked restricted", () => {
  const pc = stripeCode({
    promotion: { coupon: { valid: true, percent_off: 20, applies_to: { products: ["prod_1"] } } },
  })
  assert.equal(offerFromPromotionCode(pc)?.restricted, true)
  assert.equal(offerFromPromotionCode(stripeCode())?.restricted, false)
})

// ---- quotePromo -------------------------------------------------------------

test("quotePromo: no offer leaves the total alone", () => {
  const totals = cartTotals(["shft"])
  assert.deepEqual(quotePromo(totals, null), { kind: "none", totalCents: PRICING.shft.price * 100 })
})

test("quotePromo: an offer on an empty cart is nothing, not a negative total", () => {
  assert.deepEqual(quotePromo(cartTotals([]), percent(20)), { kind: "none", totalCents: 0 })
})

test("quotePromo: a percentage comes off the bundle price when the bundle applies, not off the three singles", () => {
  const totals = cartTotals(["shft", "drft", "fltr"])
  const bundle = PRICING.bundle.price * 100
  const q = quotePromo(totals, percent(20))
  assert.deepEqual(q, { kind: "applied", discountCents: Math.round(bundle * 0.2), totalCents: bundle - Math.round(bundle * 0.2) })
})

test("quotePromo: a percentage is rounded on each line, the way Stripe rounds it", () => {
  // One third off two lines. Rounded per line and summed, not taken off the
  // total and rounded once — those differ by a cent whenever the fraction
  // rounds up on each line, which is exactly the case this pins.
  const totals = cartTotals(["shft", "drft"])
  const lines = [PRICING.shft.price * 100, PRICING.drft.price * 100]
  const perLine = lines.reduce((s, c) => s + Math.round((c * 33.33) / 100), 0)
  const q = quotePromo(totals, percent(33.33))
  assert.equal(q.kind, "applied")
  if (q.kind === "applied") {
    assert.equal(q.discountCents, perLine)
    assert.equal(q.totalCents, lines[0] + lines[1] - perLine)
  }
})

test("quotePromo: a fixed amount comes off the total", () => {
  const totals = cartTotals(["shft"])
  const price = PRICING.shft.price * 100
  assert.deepEqual(quotePromo(totals, amount(1000)), { kind: "applied", discountCents: 1000, totalCents: price - 1000 })
})

test("quotePromo: a fixed amount larger than the order takes the order to zero, never below", () => {
  const totals = cartTotals(["fltr"])
  const price = PRICING.fltr.price * 100
  assert.deepEqual(quotePromo(totals, amount(price + 5000)), { kind: "applied", discountCents: price, totalCents: 0 })
})

test("quotePromo: 100% off is free", () => {
  const q = quotePromo(cartTotals(["shft"]), percent(100))
  assert.equal(q.totalCents, 0)
})

test("quotePromo: an order under the code's minimum gets no discount and says what the minimum is", () => {
  const totals = cartTotals(["fltr"])
  const price = PRICING.fltr.price * 100
  assert.deepEqual(quotePromo(totals, percent(20, { minimumCents: price + 100 })), {
    kind: "below-minimum", minimumCents: price + 100, totalCents: price,
  })
})

test("quotePromo: an order exactly at the minimum qualifies", () => {
  const totals = cartTotals(["fltr"])
  const price = PRICING.fltr.price * 100
  assert.equal(quotePromo(totals, percent(20, { minimumCents: price })).kind, "applied")
})

test("quotePromo: a restricted code is left for Stripe to price, and the total is not touched", () => {
  const totals = cartTotals(["shft", "drft"])
  assert.deepEqual(quotePromo(totals, percent(50, { restricted: true })), {
    kind: "at-payment", totalCents: totals.total * 100,
  })
})

// ---- formatCents / describeOffer ---------------------------------------------

test("formatCents: whole dollars show no cents; anything else shows two places", () => {
  assert.equal(formatCents(4200), "$42")
  assert.equal(formatCents(4720), "$47.20")
  assert.equal(formatCents(4705), "$47.05")
  assert.equal(formatCents(0), "$0")
  assert.equal(formatCents(99), "$0.99")
})

test("describeOffer: a percentage and a fixed amount each read as themselves", () => {
  assert.equal(describeOffer(percent(20)), "20% off")
  assert.equal(describeOffer(amount(1000)), "$10 off")
  assert.equal(describeOffer(amount(1050)), "$10.50 off")
})

// ---- sanitizeStoredOffer -----------------------------------------------------

test("sanitizeStoredOffer: a well-formed offer survives a round trip through storage", () => {
  for (const offer of [percent(20), amount(1000, { minimumCents: 5000 }), percent(15, { restricted: true })]) {
    assert.deepEqual(sanitizeStoredOffer(JSON.parse(JSON.stringify(offer))), offer)
  }
})

test("sanitizeStoredOffer: anything that is not an offer is dropped", () => {
  for (const bad of [null, undefined, "SAVE20", 20, [], {}, { code: "SAVE20" }, { code: "no good", percentOff: 20 }]) {
    assert.equal(sanitizeStoredOffer(bad), null, JSON.stringify(bad))
  }
})

test("sanitizeStoredOffer: a tampered value cannot promise more than a code could", () => {
  assert.equal(sanitizeStoredOffer({ code: "SAVE", percentOff: 500, amountOffCents: null }), null)
  assert.equal(sanitizeStoredOffer({ code: "SAVE", percentOff: -20, amountOffCents: null }), null)
  assert.equal(sanitizeStoredOffer({ code: "SAVE", percentOff: null, amountOffCents: -1000 }), null)
  assert.equal(sanitizeStoredOffer({ code: "SAVE", percentOff: null, amountOffCents: 10.5 }), null)
  // Both at once is not a shape Stripe produces, so it is not one to trust.
  assert.equal(sanitizeStoredOffer({ code: "SAVE", percentOff: 20, amountOffCents: 1000 }), null)
  assert.equal(sanitizeStoredOffer({ code: "SAVE", percentOff: 20, amountOffCents: null, minimumCents: -1 }), null)
})
