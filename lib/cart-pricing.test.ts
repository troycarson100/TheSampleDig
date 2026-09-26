import { test } from "node:test"
import assert from "node:assert/strict"
import { cartTotals } from "./cart-pricing"
import { PRICING } from "./products"

test("cartTotals: an empty cart is all zeroes and no bundle", () => {
  const t = cartTotals([])
  assert.deepEqual(t.lines, [])
  assert.equal(t.subtotal, 0)
  assert.equal(t.total, 0)
  assert.equal(t.saving, 0)
  assert.equal(t.bundleApplied, false)
})

test("cartTotals: one item is its own price, no bundle", () => {
  const t = cartTotals(["shft"])
  assert.equal(t.subtotal, PRICING.shft.price)
  assert.equal(t.total, PRICING.shft.price)
  assert.equal(t.bundleApplied, false)
  assert.equal(t.saving, 0)
})

test("cartTotals: two items are the sum of singles — there is no two-item price", () => {
  const t = cartTotals(["shft", "fltr"])
  assert.equal(t.subtotal, PRICING.shft.price + PRICING.fltr.price)
  assert.equal(t.total, t.subtotal)
  assert.equal(t.bundleApplied, false)
})

test("cartTotals: all three applies the bundle price and reports the saving", () => {
  const t = cartTotals(["shft", "drft", "fltr"])
  assert.equal(t.bundleApplied, true)
  assert.equal(t.total, PRICING.bundle.price)
  assert.equal(t.subtotal, PRICING.shft.price + PRICING.drft.price + PRICING.fltr.price)
  assert.equal(t.saving, t.subtotal - PRICING.bundle.price)
})

test("cartTotals: duplicate ids collapse rather than double-charging", () => {
  const t = cartTotals(["shft", "shft", "drft"])
  assert.equal(t.lines.length, 2)
  assert.equal(t.subtotal, PRICING.shft.price + PRICING.drft.price)
})

test("cartTotals: lines follow PLUGIN_ORDER regardless of the order added", () => {
  const t = cartTotals(["fltr", "shft", "drft"])
  assert.deepEqual(t.lines.map((l) => l.id), ["shft", "drft", "fltr"])
})

test("cartTotals: msrpTotal is the combined list price, for the struck figure", () => {
  const t = cartTotals(["shft", "drft", "fltr"])
  assert.equal(t.msrpTotal, PRICING.shft.msrp + PRICING.drft.msrp + PRICING.fltr.msrp)
  assert.equal(t.msrpTotal, PRICING.bundle.compareAt)
})
