import { test } from "node:test"
import assert from "node:assert/strict"
import { duplicatePurchaseAlert } from "./duplicate-purchase-alert"

test("duplicatePurchaseAlert: a fully duplicate bundle names the buyer, the charge and what they already owned", () => {
  // A bundle now grants three products (shft, drft, fltr), so all three must
  // already be owned for this to be a FULL duplicate - two owned out of three
  // is a partial one (see the test below). Before fltr existed, two owned out
  // of two was the full-duplicate case; this is that same scenario updated to
  // match the bundle's real grant count instead of a stale one.
  const alert = duplicatePurchaseAlert({
    buyerEmail: "jhoacoustic@gmail.com",
    product: "bundle",
    duplicates: ["shft", "drft", "fltr"],
    amountTotal: 3400,
    sessionId: "cs_live_b1dxbWdp",
  })

  assert.ok(alert, "a purchase with duplicates must produce an alert")
  assert.match(alert.subject, /jhoacoustic@gmail\.com/)
  assert.match(alert.text, /\$34\.00/)
  assert.match(alert.text, /shft/)
  assert.match(alert.text, /drft/)
  assert.match(alert.text, /fltr/)
  assert.match(alert.text, /cs_live_b1dxbWdp/)
  assert.match(alert.text, /Nothing new was granted/, "all three owned already means nothing new, not a partial refund warning")
})

test("duplicatePurchaseAlert: a purchase that granted something new is not a duplicate", () => {
  const alert = duplicatePurchaseAlert({
    buyerEmail: "new@example.com",
    product: "bundle",
    duplicates: [],
    amountTotal: 3400,
    sessionId: "cs_live_fresh",
  })

  assert.equal(alert, null, "no duplicates means nothing to alert about")
})

test("duplicatePurchaseAlert: a partial duplicate warns that a full refund would be wrong", () => {
  const alert = duplicatePurchaseAlert({
    buyerEmail: "owns-one@example.com",
    product: "bundle",
    duplicates: ["shft"],
    amountTotal: 3400,
    sessionId: "cs_live_partial",
  })

  assert.ok(alert)
  assert.match(alert.text, /PARTIAL/)
})
