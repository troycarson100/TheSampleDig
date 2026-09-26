import { test } from "node:test"
import assert from "node:assert/strict"
import { introWindow } from "./plugins"

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
