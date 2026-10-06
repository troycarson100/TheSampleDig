import { test } from "node:test"
import assert from "node:assert/strict"
import { CREATOR_COMMISSION_PERCENT, readApplication, suggestCode } from "./affiliate-application-logic"
import { CREATOR_COUNTRIES, isCreatorCountry } from "./creator-countries"
import { normalizeAffiliateCode } from "./affiliate-logic"

const good = { email: " Maker@Example.com ", name: "  DJ   Mo ", country: "GB", plugin: "fltr", message: "I make beat videos on YouTube." }

test("readApplication: a good application, tidied", () => {
  const r = readApplication(good)
  assert.ok(r.ok)
  assert.deepEqual(r.value, { email: "maker@example.com", name: "DJ Mo", country: "GB", plugin: "fltr", message: "I make beat videos on YouTube." })
})

test("readApplication: only countries Stripe can pay", () => {
  for (const country of ["BR", "GI", "", "us", undefined]) {
    assert.equal(readApplication({ ...good, country }).ok, false, String(country))
  }
  for (const country of ["US", "AU", "IL"]) assert.equal(readApplication({ ...good, country }).ok, true, country)
})

test("readApplication: refuses what isn't there or isn't right", () => {
  assert.equal(readApplication({ ...good, email: "not an email" }).ok, false)
  assert.equal(readApplication({ ...good, name: "   " }).ok, false)
  assert.equal(readApplication({ ...good, plugin: "pro" }).ok, false)
  assert.equal(readApplication({ ...good, message: "hi" }).ok, false)
  assert.equal(readApplication({ ...good, message: "x".repeat(2001) }).ok, false)
  assert.equal(readApplication(null).ok, false)
})

test("creator countries: Stripe's US-platform payout list - not Brazil or Gibraltar, which it refused", () => {
  for (const c of ["US", "GB", "CA", "CH", "DE", "FR", "NO", "IS", "LI", "AU", "IL", "JP", "MX", "IN"]) assert.ok(isCreatorCountry(c), c)
  for (const c of ["BR", "GI", "RU", "CN"]) assert.ok(!isCreatorCountry(c), c)
  assert.equal(CREATOR_COUNTRIES[0].code, "US")
  assert.equal(new Set(CREATOR_COUNTRIES.map((c) => c.code)).size, CREATOR_COUNTRIES.length)
})

test("suggestCode: a valid referral code from a name, never one that's taken", () => {
  assert.equal(suggestCode("DJ Mo' Beats", new Set()), "dj-mo-beats")
  assert.equal(suggestCode("Zoë Ñúñez", new Set()), "zoe-nunez")
  assert.equal(suggestCode("DJ Mo", new Set(["dj-mo"])), "dj-mo-2")
  assert.equal(suggestCode("!!!", new Set()), "creator")
  assert.equal(suggestCode("A", new Set()), "a-1")
  for (const n of ["DJ Mo' Beats", "x".repeat(80), "Zoë", "A", "!!!"]) {
    const c = suggestCode(n, new Set())
    assert.equal(normalizeAffiliateCode(c), c, n)
  }
})

test("the program pays 25%", () => {
  assert.equal(CREATOR_COMMISSION_PERCENT, 25)
})
