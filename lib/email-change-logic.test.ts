import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizeNewEmail, decideEmailChange, EMAIL_CHANGE_REFUSAL } from "./email-change-logic"

test("normalizeNewEmail trims and lowercases", () => {
  assert.equal(normalizeNewEmail("  New@Example.COM "), "new@example.com")
})

test("normalizeNewEmail rejects anything that is not a usable address", () => {
  assert.equal(normalizeNewEmail(""), null)
  assert.equal(normalizeNewEmail("   "), null)
  assert.equal(normalizeNewEmail("no-at-sign"), null)
  assert.equal(normalizeNewEmail("@nolocalpart.com"), null)
  assert.equal(normalizeNewEmail("nodomain@"), null)
  assert.equal(normalizeNewEmail("has space@example.com"), null)
  assert.equal(normalizeNewEmail(`${"a".repeat(250)}@example.com`), null)
  assert.equal(normalizeNewEmail(42), null)
  assert.equal(normalizeNewEmail(null), null)
})

test("decideEmailChange sends for a good, free, different address", () => {
  assert.deepEqual(decideEmailChange("old@example.com", "new@example.com", false), { action: "send" })
})

test("decideEmailChange refuses an unusable address", () => {
  assert.deepEqual(decideEmailChange("old@example.com", null, false), {
    action: "refuse",
    reason: "invalid",
  })
})

test("decideEmailChange refuses the address the account already has", () => {
  assert.deepEqual(decideEmailChange("Old@Example.com", "old@example.com", false), {
    action: "refuse",
    reason: "unchanged",
  })
})

test("decideEmailChange refuses an address another account holds", () => {
  assert.deepEqual(decideEmailChange("old@example.com", "taken@example.com", true), {
    action: "refuse",
    reason: "taken",
  })
})

test("unchanged is reported before taken, since it is the more useful message", () => {
  assert.deepEqual(decideEmailChange("old@example.com", "old@example.com", true), {
    action: "refuse",
    reason: "unchanged",
  })
})

test("every refusal reason has a message", () => {
  for (const reason of ["invalid", "unchanged", "taken"] as const) {
    assert.ok(EMAIL_CHANGE_REFUSAL[reason].length > 0)
  }
})
