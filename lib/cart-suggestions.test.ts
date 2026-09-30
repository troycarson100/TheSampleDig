import { test } from "node:test"
import assert from "node:assert/strict"
import { cartSuggestions } from "./cart-suggestions"
import { PLUGIN_ORDER, type PluginId } from "./plugins"
import { PRICING } from "./products"

const NOTHING = Object.fromEntries(PLUGIN_ORDER.map((id) => [id, false])) as Record<PluginId, boolean>
const owns = (...ids: PluginId[]) => ({ ...NOTHING, ...Object.fromEntries(ids.map((id) => [id, true])) })
const singles = (ids: readonly PluginId[]) => ids.reduce((sum, id) => sum + PRICING[id].price, 0)

test("cartSuggestions: nothing taken out, nothing offered", () => {
  const s = cartSuggestions({ ids: ["shft"], removed: [], owned: NOTHING, known: true })
  assert.deepEqual(s, { items: [], bundle: null })
})

test("cartSuggestions: unknown ownership offers nothing, even what was taken out", () => {
  const s = cartSuggestions({ ids: ["shft"], removed: ["fltr"], owned: NOTHING, known: false })
  assert.deepEqual(s, { items: [], bundle: null })
})

test("cartSuggestions: an owned plugin is never offered back", () => {
  const s = cartSuggestions({ ids: ["shft"], removed: ["drft", "fltr"], owned: owns("drft"), known: true })
  assert.deepEqual(s.items.map((i) => i.id), ["fltr"])
})

test("cartSuggestions: one put back in the cart is no longer offered", () => {
  const s = cartSuggestions({ ids: ["shft", "fltr"], removed: ["fltr", "drft"], owned: NOTHING, known: true })
  assert.deepEqual(s.items.map((i) => i.id), ["drft"])
})

test("cartSuggestions: offered in the range's order, not the order they were taken out", () => {
  const s = cartSuggestions({ ids: ["shft"], removed: ["fltr", "drft"], owned: NOTHING, known: true })
  assert.deepEqual(s.items.map((i) => i.id), ["drft", "fltr"])
})

test("cartSuggestions: the last one missing costs only what takes the order to the bundle price", () => {
  const ids: PluginId[] = ["shft", "drft"]
  const s = cartSuggestions({ ids, removed: ["fltr"], owned: NOTHING, known: true })
  assert.equal(s.items.length, 1)
  assert.equal(s.items[0].completesBundle, true)
  assert.equal(s.items[0].price, PRICING.fltr.price)
  assert.equal(s.items[0].extra, PRICING.bundle.price - singles(ids))
  assert.ok(s.items[0].extra < s.items[0].price)
  // Its own row says so; a bundle card would say it twice.
  assert.equal(s.bundle, null)
})

test("cartSuggestions: with two missing, each costs its own price and the bundle is offered", () => {
  const s = cartSuggestions({ ids: ["shft"], removed: ["drft", "fltr"], owned: NOTHING, known: true })
  for (const i of s.items) {
    assert.equal(i.completesBundle, false)
    assert.equal(i.extra, i.price)
  }
  assert.ok(s.bundle)
  assert.equal(s.bundle.price, PRICING.bundle.price)
  assert.equal(s.bundle.extra, PRICING.bundle.price - PRICING.shft.price)
  assert.equal(s.bundle.saving, singles(["drft", "fltr"]) - s.bundle.extra)
  assert.ok(s.bundle.saving > 0)
})

test("cartSuggestions: an emptied cart is offered everything taken out, and the bundle", () => {
  const s = cartSuggestions({ ids: [], removed: [...PLUGIN_ORDER], owned: NOTHING, known: true })
  assert.equal(s.items.length, PLUGIN_ORDER.length)
  assert.ok(s.bundle)
  assert.equal(s.bundle.extra, PRICING.bundle.price)
  assert.equal(s.bundle.saving, singles(PLUGIN_ORDER) - PRICING.bundle.price)
})

test("cartSuggestions: no bundle for someone who owns one - it could never apply", () => {
  const s = cartSuggestions({ ids: ["shft"], removed: ["fltr"], owned: owns("drft"), known: true })
  assert.deepEqual(s.items.map((i) => i.id), ["fltr"])
  assert.equal(s.items[0].completesBundle, false)
  assert.equal(s.items[0].extra, PRICING.fltr.price)
  assert.equal(s.bundle, null)
})

test("cartSuggestions: an empty cart suggests every plugin, and the bundle, to someone who owns none", () => {
  const s = cartSuggestions({ ids: [], removed: [], owned: NOTHING, known: true })
  assert.deepEqual(s.items.map((i) => i.id), [...PLUGIN_ORDER])
  for (const i of s.items) {
    assert.equal(i.extra, i.price)
    assert.equal(i.completesBundle, false)
  }
  assert.ok(s.bundle)
  assert.equal(s.bundle.extra, PRICING.bundle.price)
  assert.equal(s.bundle.saving, singles(PLUGIN_ORDER) - PRICING.bundle.price)
})

test("cartSuggestions: an empty cart suggests only what is not owned, and no bundle", () => {
  const s = cartSuggestions({ ids: [], removed: [], owned: owns("shft"), known: true })
  assert.deepEqual(s.items.map((i) => i.id), ["drft", "fltr"])
  assert.equal(s.bundle, null)
})

test("cartSuggestions: an empty cart suggests nothing to someone who owns everything", () => {
  assert.deepEqual(cartSuggestions({ ids: [], removed: [], owned: owns("shft", "drft", "fltr"), known: true }), { items: [], bundle: null })
})

test("cartSuggestions: an empty cart suggests nothing while ownership is unknown", () => {
  assert.deepEqual(cartSuggestions({ ids: [], removed: [], owned: NOTHING, known: false }), { items: [], bundle: null })
})
