import { test } from "node:test"
import assert from "node:assert/strict"
import {
  claimTokenMatches,
  giftCookieName,
  giftPath,
  giftPlaceholderEmail,
  giftStatus,
  giftView,
  hashClaimToken,
  isGiftPlaceholderEmail,
  newClaimToken,
  showsKeys,
  type GiftRow,
} from "./gift-link-logic"
import { normalizeCompCode } from "./comp-code"

const NOW = new Date("2026-10-02T12:00:00.000Z")
const open: GiftRow = { redeemedAt: null, revokedAt: null, expiresAt: null, claimTokenHash: null }
const claimed: GiftRow = { ...open, redeemedAt: NOW, claimTokenHash: "h" }

test("giftStatus: a fresh link is open", () => {
  assert.equal(giftStatus(open, NOW), "open")
})

test("giftStatus: claimed, while the claimer holds a token", () => {
  assert.equal(giftStatus(claimed, NOW), "claimed")
})

test("giftStatus: claimed with no token is a link an admin reopened", () => {
  assert.equal(giftStatus({ ...claimed, claimTokenHash: null }, NOW), "reopened")
})

test("giftStatus: cancelled and expired, until someone claims it", () => {
  assert.equal(giftStatus({ ...open, revokedAt: NOW }, NOW), "revoked")
  assert.equal(giftStatus({ ...open, expiresAt: NOW }, NOW), "expired")
  assert.equal(giftStatus({ ...open, expiresAt: new Date(NOW.getTime() + 1) }, NOW), "open")
})

test("giftStatus: once claimed, an expiry date passing changes nothing", () => {
  assert.equal(giftStatus({ ...claimed, expiresAt: new Date(NOW.getTime() - 1) }, NOW), "claimed")
})

test("giftView: only the token holder sees a claimed gift", () => {
  assert.equal(giftView("claimed", true), "mine")
  assert.equal(giftView("claimed", false), "taken")
})

test("giftView: open and reopened links offer Claim to anyone", () => {
  assert.equal(giftView("open", false), "claim")
  assert.equal(giftView("reopened", false), "claim")
})

test("giftView: cancelled and expired say so", () => {
  assert.equal(giftView("revoked", false), "revoked")
  assert.equal(giftView("expired", false), "expired")
})

test("claim tokens: unguessable, and only their own hash matches", () => {
  const a = newClaimToken()
  const b = newClaimToken()
  assert.notEqual(a, b)
  assert.ok(a.length >= 43)
  assert.equal(claimTokenMatches(a, hashClaimToken(a)), true)
  assert.equal(claimTokenMatches(b, hashClaimToken(a)), false)
})

test("claim tokens: nothing matches a missing token or a missing hash", () => {
  assert.equal(claimTokenMatches(undefined, hashClaimToken("x")), false)
  assert.equal(claimTokenMatches("", hashClaimToken("")), false)
  assert.equal(claimTokenMatches("x", null), false)
  assert.equal(claimTokenMatches("x", "not-hex"), false)
})

test("placeholder addresses: recognised, and on a domain mail can never reach", () => {
  const email = giftPlaceholderEmail("AB12")
  assert.equal(email, email.toLowerCase())
  assert.ok(email.endsWith(".invalid"))
  assert.equal(isGiftPlaceholderEmail(email), true)
  assert.equal(isGiftPlaceholderEmail(email.toUpperCase()), true)
  assert.equal(isGiftPlaceholderEmail("someone@gmail.com"), false)
  assert.equal(isGiftPlaceholderEmail("gifts.sampleroll.invalid@gmail.com"), false)
  assert.equal(isGiftPlaceholderEmail(null), false)
})

test("giftPath: drops the GIFT- prefix, and the code still reads back", () => {
  const code = "GIFT-K7QM-4XPA-9RTD"
  assert.equal(giftPath(code), "/gift/K7QM-4XPA-9RTD")
  const real = "GIFT-0000-0000-0000"
  assert.equal(normalizeCompCode(giftPath(real).slice("/gift/".length)), real)
})

test("giftCookieName: one per gift", () => {
  assert.notEqual(giftCookieName("a"), giftCookieName("b"))
})

test("showsKeys: an account made for the gift shows its keys; one that was already there does not", () => {
  const made = new Date("2026-10-01T00:00:00.000Z")
  assert.equal(showsKeys(new Date("2026-10-02T00:00:00.000Z"), made), true)
  assert.equal(showsKeys(new Date("2025-01-01T00:00:00.000Z"), made), false)
})
