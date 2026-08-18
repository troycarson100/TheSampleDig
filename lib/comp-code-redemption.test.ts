import { test } from "node:test"
import assert from "node:assert/strict"
import { compCodeStatus, decideRedemption } from "./comp-code-redemption"

const now = new Date("2026-08-17T00:00:00.000Z")
const open = { redeemedAt: null, revokedAt: null, expiresAt: null }

test("compCodeStatus: open when nothing set", () => {
  assert.equal(compCodeStatus(open, now), "open")
})

test("compCodeStatus: redeemed takes priority over everything else", () => {
  assert.equal(
    compCodeStatus({ redeemedAt: now, revokedAt: now, expiresAt: new Date("2020-01-01") }, now),
    "redeemed"
  )
})

test("compCodeStatus: revoked beats expired", () => {
  assert.equal(
    compCodeStatus({ redeemedAt: null, revokedAt: now, expiresAt: new Date("2020-01-01") }, now),
    "revoked"
  )
})

test("compCodeStatus: expired only once the date has passed", () => {
  assert.equal(compCodeStatus({ ...open, expiresAt: new Date("2020-01-01") }, now), "expired")
  assert.equal(compCodeStatus({ ...open, expiresAt: new Date("2030-01-01") }, now), "open")
})

test("decideRedemption: unknown code", () => {
  assert.deepEqual(decideRedemption(null, false, now), { action: "refuse", reason: "not_found" })
})

test("decideRedemption: revoked code refuses even for a fresh account", () => {
  const row = { redeemedAt: null, revokedAt: now, expiresAt: null }
  assert.deepEqual(decideRedemption(row, false, now), { action: "refuse", reason: "revoked" })
})

test("decideRedemption: expired code", () => {
  const row = { redeemedAt: null, revokedAt: null, expiresAt: new Date("2020-01-01") }
  assert.deepEqual(decideRedemption(row, false, now), { action: "refuse", reason: "expired" })
})

test("decideRedemption: already redeemed by someone else", () => {
  const row = { redeemedAt: now, revokedAt: null, expiresAt: null }
  assert.deepEqual(decideRedemption(row, false, now), { action: "refuse", reason: "already_redeemed" })
})

test("decideRedemption: open code but the account already owns the product", () => {
  assert.deepEqual(decideRedemption(open, true, now), { action: "refuse", reason: "already_owned" })
})

test("decideRedemption: the happy path", () => {
  assert.deepEqual(decideRedemption(open, false, now), { action: "redeem" })
})
