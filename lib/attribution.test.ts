import { test } from "node:test"
import assert from "node:assert/strict"
import { parseUtm, referrerHost, isStrictConsentRegion, consentRegionFor } from "./attribution"

test("parseUtm pulls all five keys", () => {
  const r = parseUtm("?utm_source=ig&utm_medium=social&utm_campaign=launch&utm_content=reel1&utm_term=gate")
  assert.deepEqual(r, {
    utmSource: "ig", utmMedium: "social", utmCampaign: "launch",
    utmContent: "reel1", utmTerm: "gate",
  })
})

test("parseUtm returns nulls for an empty query string", () => {
  assert.deepEqual(parseUtm(""), {
    utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null,
  })
})

test("parseUtm ignores unrelated params and works without a leading ?", () => {
  const r = parseUtm("ref=abc&utm_source=reddit")
  assert.equal(r.utmSource, "reddit")
  assert.equal(r.utmMedium, null)
})

test("referrerHost extracts the host", () => {
  assert.equal(referrerHost("https://www.instagram.com/p/abc/"), "www.instagram.com")
})

test("referrerHost returns null for same-origin referrers", () => {
  assert.equal(referrerHost("https://sampleroll.com/dig", "sampleroll.com"), null)
})

test("referrerHost returns null for empty, null, and unparseable input", () => {
  assert.equal(referrerHost(null), null)
  assert.equal(referrerHost(""), null)
  assert.equal(referrerHost("not a url"), null)
})

test("isStrictConsentRegion is true for EU, UK, and EEA", () => {
  for (const c of ["DE", "FR", "GB", "IE", "NO", "IS", "LI"]) {
    assert.equal(isStrictConsentRegion(c), true, `${c} should be strict`)
  }
})

test("isStrictConsentRegion is false for the US and other non-EU countries", () => {
  for (const c of ["US", "CA", "AU", "JP", "BR"]) {
    assert.equal(isStrictConsentRegion(c), false, `${c} should not be strict`)
  }
})

test("isStrictConsentRegion treats unknown and missing as strict", () => {
  assert.equal(isStrictConsentRegion(null), true)
  assert.equal(isStrictConsentRegion(undefined), true)
  assert.equal(isStrictConsentRegion(""), true)
  assert.equal(isStrictConsentRegion("XX"), true)
})

test("isStrictConsentRegion is case-insensitive", () => {
  assert.equal(isStrictConsentRegion("de"), true)
  assert.equal(isStrictConsentRegion("us"), false)
})

test("consentRegionFor maps to the region strings", () => {
  assert.equal(consentRegionFor("US"), "notice")
  assert.equal(consentRegionFor("DE"), "strict")
  assert.equal(consentRegionFor(null), "strict")
})
