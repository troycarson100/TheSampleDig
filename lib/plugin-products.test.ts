import { test } from "node:test"
import assert from "node:assert/strict"
import { PLUGIN_PRODUCTS, PLUGIN_GRANTS, PRODUCT_LABEL, isPluginProduct } from "./plugin-products"
import { PLUGIN_ORDER } from "./plugins"
import { PRICING } from "./products"

test("fltr is a plugin product", () => {
  assert.ok(isPluginProduct("fltr"))
  assert.deepEqual([...PLUGIN_PRODUCTS], ["shft", "drft", "fltr"])
})

test("the bundle grants all three plugins", () => {
  assert.deepEqual([...PLUGIN_GRANTS.bundle], ["shft", "drft", "fltr"])
})

test("every plugin grants exactly itself", () => {
  for (const id of PLUGIN_PRODUCTS) assert.deepEqual([...PLUGIN_GRANTS[id]], [id])
})

test("every sellable thing has a label", () => {
  assert.equal(PRODUCT_LABEL.fltr, "fltr")
  assert.equal(PRODUCT_LABEL.bundle, "shft + drft + fltr")
})

// The guard that stops presentation and entitlements drifting apart.
test("the presentation catalog and the entitlement list hold the same plugins", () => {
  assert.deepEqual([...PLUGIN_ORDER].sort(), [...PLUGIN_PRODUCTS].sort())
})

test("every plugin has a price, and the bundle undercuts buying them singly", () => {
  const singles = PLUGIN_PRODUCTS.reduce((sum, id) => sum + PRICING[id].price, 0)
  assert.ok(PRICING.bundle.price < singles, `bundle ${PRICING.bundle.price} vs singles ${singles}`)
  assert.equal(PRICING.bundle.compareAt, PLUGIN_PRODUCTS.reduce((s, id) => s + PRICING[id].msrp, 0))
})
