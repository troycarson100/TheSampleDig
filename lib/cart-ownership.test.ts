import { test } from "node:test"
import assert from "node:assert/strict"
import { checkCart } from "./cart-ownership"

test("checkCart: a visitor who owns nothing may buy everything asked for", () => {
  const r = checkCart(["shft", "drft"], [])
  assert.deepEqual(r.requested, ["shft", "drft"])
  assert.deepEqual(r.owned, [])
  assert.deepEqual(r.sellable, ["shft", "drft"])
  assert.equal(r.empty, false)
})

test("checkCart: owned items are separated out, not silently sold again", () => {
  const r = checkCart(["shft", "drft", "fltr"], ["drft"])
  assert.deepEqual(r.owned, ["drft"])
  assert.deepEqual(r.sellable, ["shft", "fltr"])
  assert.equal(r.empty, false)
})

test("checkCart: a cart of only owned items is empty and sells nothing", () => {
  const r = checkCart(["shft"], ["shft", "drft"])
  assert.deepEqual(r.sellable, [])
  assert.equal(r.empty, true)
})

test("checkCart: unknown ids are discarded rather than trusted", () => {
  // A stale localStorage value or a crafted request must not reach Stripe.
  const r = checkCart(["shft", "not-a-plugin", "bundle"], [])
  assert.deepEqual(r.requested, ["shft"])
  assert.deepEqual(r.sellable, ["shft"])
})

test("checkCart: duplicates collapse", () => {
  const r = checkCart(["shft", "shft"], [])
  assert.deepEqual(r.sellable, ["shft"])
})

test("checkCart: results follow PLUGIN_PRODUCTS order regardless of input order", () => {
  const r = checkCart(["fltr", "shft"], [])
  assert.deepEqual(r.sellable, ["shft", "fltr"])
})
