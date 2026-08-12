import { test } from "node:test"
import assert from "node:assert/strict"
import { parseConsentCookie } from "./consent"

test("parseConsentCookie reads granted and denied", () => {
  assert.equal(parseConsentCookie("sr_consent=granted"), "granted")
  assert.equal(parseConsentCookie("sr_consent=denied"), "denied")
})

test("parseConsentCookie finds the value among other cookies", () => {
  assert.equal(parseConsentCookie("foo=1; sr_consent=granted; bar=2"), "granted")
})

test("parseConsentCookie returns unset when absent, empty, or garbage", () => {
  assert.equal(parseConsentCookie("foo=1"), "unset")
  assert.equal(parseConsentCookie(""), "unset")
  assert.equal(parseConsentCookie(null), "unset")
  assert.equal(parseConsentCookie("sr_consent=maybe"), "unset")
})

test("parseConsentCookie does not match a cookie whose name merely ends in sr_consent", () => {
  assert.equal(parseConsentCookie("not_sr_consent=granted"), "unset")
})
