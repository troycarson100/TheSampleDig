import { test } from "node:test"
import assert from "node:assert/strict"
import { BUNDLE_OFFER_ENDS, bundleWindow, introWindow } from "./plugins"

const NOW = new Date("2026-10-01T12:00:00.000Z")

test("introWindow: an unset deadline is never live", () => {
  const w = introWindow(NOW, null)
  assert.equal(w.endsAt, null)
  assert.equal(w.live, false)
})

test("introWindow: a malformed deadline is never live", () => {
  const w = introWindow(NOW, "next tuesday")
  assert.equal(w.endsAt, null)
  assert.equal(w.live, false)
})

test("introWindow: a future deadline is live and reports its date", () => {
  const w = introWindow(NOW, "2026-10-31T12:00:00.000Z")
  assert.equal(w.live, true)
  assert.equal(w.endsAt?.toISOString(), "2026-10-31T12:00:00.000Z")
})

test("introWindow: a past deadline is not live, but still reports its date", () => {
  const w = introWindow(NOW, "2026-09-01T12:00:00.000Z")
  assert.equal(w.live, false)
  assert.equal(w.endsAt?.toISOString(), "2026-09-01T12:00:00.000Z")
})

// The boundary is the moment the offer ends, so it is already over.
test("introWindow: exactly at the deadline is not live", () => {
  const w = introWindow(NOW, NOW.toISOString())
  assert.equal(w.live, false)
})

test("bundleWindow: runs up to its deadline and not past it", () => {
  assert.equal(bundleWindow(NOW, "2026-10-31T23:59:59-07:00").live, true)
  assert.equal(bundleWindow(new Date("2026-11-01T07:00:00.000Z"), "2026-10-31T23:59:59-07:00").live, false)
  assert.equal(bundleWindow(NOW, null).live, false)
})

// A date with no offset is read in each visitor's own timezone, so the offer
// would end at a different moment for every one of them.
test("BUNDLE_OFFER_ENDS: unset, or a real date that says which timezone it is in", () => {
  if (BUNDLE_OFFER_ENDS === null) return
  assert.match(BUNDLE_OFFER_ENDS, /(Z|[+-]\d{2}:\d{2})$/)
  assert.notEqual(bundleWindow(NOW, BUNDLE_OFFER_ENDS).endsAt, null)
})
