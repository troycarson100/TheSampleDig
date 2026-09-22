import { test } from "node:test"
import assert from "node:assert/strict"
import { parseAdminEmails } from "./admin-emails"

test("parseAdminEmails: splits on commas, trims, lowercases and drops blanks", () => {
  assert.deepEqual(parseAdminEmails(" Troy@Example.com , ops@example.com ,, "), [
    "troy@example.com",
    "ops@example.com",
  ])
})

test("parseAdminEmails: an unset or empty list yields no recipients", () => {
  assert.deepEqual(parseAdminEmails(undefined), [])
  assert.deepEqual(parseAdminEmails(""), [])
})
