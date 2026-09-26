import { test } from "node:test"
import assert from "node:assert/strict"
import { bundleEligibility } from "./bundle-eligibility"

test("a visitor who owns nothing may buy the bundle", () => {
  assert.deepEqual(bundleEligibility([]), { ok: true, owns: [] })
})

test("an owner of all three is refused as already_owned", () => {
  const r = bundleEligibility(["shft", "drft", "fltr"])
  assert.equal(r.ok, false)
  assert.equal(r.reason, "already_owned")
})

test("an owner of one is refused as a partial owner, and told what they own", () => {
  const r = bundleEligibility(["drft"])
  assert.equal(r.ok, false)
  assert.equal(r.reason, "partial_owner")
  assert.deepEqual(r.owns, ["drft"])
})

test("an owner of two is refused as a partial owner", () => {
  // The case that would otherwise charge a second time for two owned plugins.
  const r = bundleEligibility(["shft", "fltr"])
  assert.equal(r.ok, false)
  assert.equal(r.reason, "partial_owner")
})

test("unrelated products are ignored", () => {
  assert.equal(bundleEligibility(["pro-subscription"]).ok, true)
})
