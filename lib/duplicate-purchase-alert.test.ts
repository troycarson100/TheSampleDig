import { test } from "node:test"
import assert from "node:assert/strict"
import { duplicatePurchaseAlert } from "./duplicate-purchase-alert"
import { PRICING } from "./products"

// The bundle's real price, in Stripe cents - amountTotal fixtures below use
// this rather than a hardcoded figure so they track PRICING.bundle.price
// instead of quietly going stale the next time it changes.
const BUNDLE_AMOUNT_CENTS = PRICING.bundle.price * 100
const bundlePriceRe = new RegExp(`\\$${PRICING.bundle.price}\\.00`)

test("duplicatePurchaseAlert: owning all three of the bundle's products (3 of 3) is a FULL duplicate", () => {
  // A bundle now grants three products (shft, drft, fltr), so all three must
  // already be owned for this to be a FULL duplicate - two owned out of three
  // is a PARTIAL one (see the test below, which is the one that actually
  // distinguishes GRANT_COUNT.bundle = 3 from the old, wrong, 2). Before fltr
  // existed, two owned out of two was the full-duplicate case; this is that
  // same scenario updated to match the bundle's real grant count.
  const alert = duplicatePurchaseAlert({
    buyerEmail: "jhoacoustic@gmail.com",
    product: "bundle",
    duplicates: ["shft", "drft", "fltr"],
    amountTotal: BUNDLE_AMOUNT_CENTS,
    sessionId: "cs_live_b1dxbWdp",
  })

  assert.ok(alert, "a purchase with duplicates must produce an alert")
  assert.match(alert.subject, /jhoacoustic@gmail\.com/)
  assert.match(alert.text, bundlePriceRe)
  assert.match(alert.text, /shft/)
  assert.match(alert.text, /drft/)
  assert.match(alert.text, /fltr/)
  assert.match(alert.text, /cs_live_b1dxbWdp/)
  assert.match(alert.text, /Nothing new was granted/, "all three owned already means nothing new, not a partial refund warning")
})

// This is the regression guard: with GRANT_COUNT.bundle wrongly left at 2
// (its pre-fltr value), 2 owned out of 3 reads as "everything", so this same
// input would assert /Nothing new was granted/ instead of /PARTIAL/ - the
// exact under-report the brief warned about. Verified by temporarily setting
// GRANT_COUNT.bundle back to 2 and confirming this test fails; see the fix
// report for the transcript.
test("duplicatePurchaseAlert: owning two of the bundle's three products (2 of 3) is a PARTIAL duplicate", () => {
  const alert = duplicatePurchaseAlert({
    buyerEmail: "owns-two@example.com",
    product: "bundle",
    duplicates: ["shft", "drft"],
    amountTotal: BUNDLE_AMOUNT_CENTS,
    sessionId: "cs_live_two_of_three",
  })

  assert.ok(alert)
  assert.match(alert.text, /PARTIAL/)
  assert.doesNotMatch(alert.text, /Nothing new was granted/, "fltr was still newly granted, so this is not a full duplicate")
})

test("duplicatePurchaseAlert: a purchase that granted something new is not a duplicate", () => {
  const alert = duplicatePurchaseAlert({
    buyerEmail: "new@example.com",
    product: "bundle",
    duplicates: [],
    amountTotal: BUNDLE_AMOUNT_CENTS,
    sessionId: "cs_live_fresh",
  })

  assert.equal(alert, null, "no duplicates means nothing to alert about")
})

test("duplicatePurchaseAlert: owning one of the bundle's three products (1 of 3) is a PARTIAL duplicate", () => {
  const alert = duplicatePurchaseAlert({
    buyerEmail: "owns-one@example.com",
    product: "bundle",
    duplicates: ["shft"],
    amountTotal: BUNDLE_AMOUNT_CENTS,
    sessionId: "cs_live_partial",
  })

  assert.ok(alert)
  assert.match(alert.text, /PARTIAL/)
})

// Regression guard for the whole-increment review's Important 4: a cart
// checkout's session.metadata.product is sellable[0] — a single plugin id —
// regardless of how many products were actually in the cart, so
// PLUGIN_GRANTS[product] (length 1 for any single plugin id) is the WRONG
// denominator for a cart. Without `products`, this exact input reads
// `1 < PLUGIN_GRANTS["shft"].length` === `1 < 1` === false — a FULL
// duplicate — and tells the owner drft was never delivered, when it was.
test("duplicatePurchaseAlert: a two-item cart (shft+drft) with one duplicate is a PARTIAL duplicate, not full", () => {
  const alert = duplicatePurchaseAlert({
    buyerEmail: "two-item-cart@example.com",
    product: "shft", // metadata.product = sellable[0] for a cart checkout
    duplicates: ["shft"],
    products: ["shft", "drft"], // metadata.products: the cart's real contents
    amountTotal: 5800,
    sessionId: "cs_live_cart_partial",
  })

  assert.ok(alert)
  assert.match(alert.text, /PARTIAL/, "drft was still newly granted, so this must not read as a full duplicate")
  assert.doesNotMatch(alert.text, /Nothing new was granted/)
})

// A legacy session (predating the cart, or a single-plugin/bundle checkout
// that never set metadata.products) must still compute the right answer from
// `product` alone, exactly as before this fix.
test("duplicatePurchaseAlert: without `products`, falls back to PLUGIN_GRANTS[product] for a legacy session", () => {
  const single = duplicatePurchaseAlert({
    buyerEmail: "legacy-single@example.com",
    product: "shft",
    duplicates: ["shft"],
    amountTotal: 2900,
    sessionId: "cs_live_legacy_single",
  })
  assert.ok(single)
  assert.match(single.text, /Nothing new was granted/, "a single-plugin session owning that one plugin is a full duplicate")

  const bundle = duplicatePurchaseAlert({
    buyerEmail: "legacy-bundle@example.com",
    product: "bundle",
    duplicates: ["shft"],
    amountTotal: BUNDLE_AMOUNT_CENTS,
    sessionId: "cs_live_legacy_bundle_partial",
  })
  assert.ok(bundle)
  assert.match(bundle.text, /PARTIAL/, "a legacy bundle session still falls back to PLUGIN_GRANTS.bundle.length === 3")
})
