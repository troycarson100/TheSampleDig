import { test } from "node:test"
import assert from "node:assert/strict"
import {
  MEMBER_CODE_PREFIX,
  MEMBER_OFFER,
  formatOfferDate,
  isMemberOfferRecipient,
  memberOfferCode,
  memberOfferExpiry,
  TEST_CODE_PREFIX,
  testOfferCode,
  type Candidate,
} from "./member-offer-logic"
import { normalizePromoCode } from "./cart-promo"

const CUTOFF = new Date("2026-10-01T17:00:00.000Z")
const base: Candidate = {
  userId: "u1",
  email: "a@example.com",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  emailMarketingOptIn: true,
  productUpdateOptIn: true,
  owns: [],
}

test("memberOfferCode: the same person and offer always get the same code", () => {
  assert.equal(memberOfferCode("s", MEMBER_OFFER.slug, "u1"), memberOfferCode("s", MEMBER_OFFER.slug, "u1"))
})

test("memberOfferCode: two people get two codes", () => {
  const seen = new Set(Array.from({ length: 500 }, (_, i) => memberOfferCode("s", MEMBER_OFFER.slug, `user-${i}`)))
  assert.equal(seen.size, 500)
})

test("memberOfferCode: depends on the secret, so it cannot be worked out from an account id", () => {
  assert.notEqual(memberOfferCode("one", MEMBER_OFFER.slug, "u1"), memberOfferCode("two", MEMBER_OFFER.slug, "u1"))
})

test("memberOfferCode: a code the promo box and Stripe will both take, with no look-alike characters", () => {
  for (let i = 0; i < 200; i++) {
    const code = memberOfferCode("s", MEMBER_OFFER.slug, `user-${i}`)
    assert.equal(normalizePromoCode(code), code)
    assert.ok(code.startsWith(MEMBER_CODE_PREFIX))
    assert.equal(code.length, MEMBER_CODE_PREFIX.length + 6)
    assert.doesNotMatch(code.slice(MEMBER_CODE_PREFIX.length), /[01OIL]/)
  }
})

test("memberOfferCode: refuses to derive codes without a secret", () => {
  assert.throws(() => memberOfferCode("", MEMBER_OFFER.slug, "u1"))
})

test("memberOfferExpiry: thirty days after the send began", () => {
  const claimed = new Date("2026-10-01T17:00:00.000Z")
  assert.equal(memberOfferExpiry(claimed).toISOString(), "2026-10-31T17:00:00.000Z")
  assert.equal(MEMBER_OFFER.days, 30)
})

test("MEMBER_OFFER: ten dollars off", () => {
  assert.equal(MEMBER_OFFER.amountOffCents, 1000)
})

test("isMemberOfferRecipient: an account from before the cutoff that takes email", () => {
  assert.equal(isMemberOfferRecipient(base, CUTOFF), true)
})

test("isMemberOfferRecipient: an account made at the cutoff itself still counts", () => {
  assert.equal(isMemberOfferRecipient({ ...base, createdAt: CUTOFF }, CUTOFF), true)
})

test("isMemberOfferRecipient: an account made after the cutoff never does", () => {
  assert.equal(isMemberOfferRecipient({ ...base, createdAt: new Date(CUTOFF.getTime() + 1) }, CUTOFF), false)
})

test("isMemberOfferRecipient: marketing email turned off leaves them out", () => {
  assert.equal(isMemberOfferRecipient({ ...base, emailMarketingOptIn: false }, CUTOFF), false)
})

test("isMemberOfferRecipient: product emails turned off leaves them out", () => {
  assert.equal(isMemberOfferRecipient({ ...base, productUpdateOptIn: false }, CUTOFF), false)
})

test("isMemberOfferRecipient: owning some of the range is no reason to leave them out", () => {
  assert.equal(isMemberOfferRecipient({ ...base, owns: ["shft", "drft"] }, CUTOFF), true)
})

test("isMemberOfferRecipient: owning all of it is - there is nothing left to take $10 off", () => {
  assert.equal(isMemberOfferRecipient({ ...base, owns: ["shft", "drft", "fltr"] }, CUTOFF), false)
})

test("formatOfferDate: the date as it is in Pacific time", () => {
  // 03:00 on 1 November in UTC is still 31 October in Los Angeles.
  assert.equal(formatOfferDate(new Date("2026-11-01T03:00:00.000Z")), "October 31")
})

test("testOfferCode: marked as a test, never shaped like a member's code", () => {
  let n = 0
  const code = testOfferCode(() => n++ % 31)
  assert.ok(code.startsWith(TEST_CODE_PREFIX))
  assert.ok(!code.startsWith(MEMBER_CODE_PREFIX))
  assert.equal(normalizePromoCode(code), code)
  assert.doesNotMatch(code.slice(TEST_CODE_PREFIX.length), /[01OIL]/)
})

test("testOfferCode: a different code every time", () => {
  const seen = new Set(Array.from({ length: 200 }, () => testOfferCode((max) => Math.floor(Math.random() * max))))
  assert.ok(seen.size > 195)
})
