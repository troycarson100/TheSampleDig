import { test } from "node:test"
import assert from "node:assert/strict"
import {
  bundleEndsOn,
  isReminderRecipient,
  reminderExclusion,
  reminderPrices,
  reminderSubject,
  reminderVariant,
  type ReminderCandidate,
} from "./offer-reminder-logic"
import { PLUGIN_ORDER } from "./plugins"
import { PRICING } from "./products"

const base: ReminderCandidate = {
  userId: "u1",
  emailMarketingOptIn: true,
  productUpdateOptIn: true,
  owns: [],
  codeSent: true,
  codeRedeemed: false,
}

test("reminder: goes to someone who was sent a code and has done nothing with it", () => {
  assert.equal(isReminderRecipient(base), true)
  assert.equal(isReminderRecipient({ ...base, owns: ["shft"] }), true)
  assert.equal(isReminderRecipient({ ...base, owns: ["shft", "drft"] }), true)
})

test("reminder: not to someone who used their code, whatever they bought with it", () => {
  assert.equal(reminderExclusion({ ...base, codeRedeemed: true }), "redeemed")
  assert.equal(reminderExclusion({ ...base, codeRedeemed: true, owns: ["drft"] }), "redeemed")
  assert.equal(reminderExclusion({ ...base, codeRedeemed: true, owns: ["fltr"] }), "redeemed")
})

test("reminder: not to someone who has fltr, code used or not", () => {
  assert.equal(reminderExclusion({ ...base, owns: ["fltr"] }), "owns-fltr")
  assert.equal(reminderExclusion({ ...base, owns: [...PLUGIN_ORDER] }), "owns-fltr")
})

test("reminder: not to someone who stopped taking email, by either switch", () => {
  assert.equal(reminderExclusion({ ...base, emailMarketingOptIn: false }), "opted-out")
  assert.equal(reminderExclusion({ ...base, productUpdateOptIn: false }), "opted-out")
})

test("reminder: not to someone the offer never went to - they have no code to be reminded of", () => {
  assert.equal(reminderExclusion({ ...base, codeSent: false }), "no-code")
})

test("reminderVariant: the bundle is only put to someone who owns none of the range", () => {
  assert.equal(reminderVariant([]), "bundle")
  for (const id of PLUGIN_ORDER) assert.equal(reminderVariant([id]), "fltr", id)
  assert.equal(reminderVariant(["shft", "drft"]), "fltr")
})

test("reminderPrices: the code comes off the bundle price and off fltr's, as checkout takes it", () => {
  const p = reminderPrices(1000)
  assert.equal(p.amountOff, "$10")
  assert.equal(p.bundle, `$${PRICING.bundle.price}`)
  assert.equal(p.bundleWas, `$${PRICING.bundle.compareAt}`)
  assert.equal(p.bundleSaving, `$${PRICING.bundle.compareAt - PRICING.bundle.price}`)
  assert.equal(p.bundleWithCode, `$${PRICING.bundle.price - 10}`)
  assert.equal(p.fltr, `$${PRICING.fltr.price}`)
  assert.equal(p.fltrWas, `$${PRICING.fltr.msrp}`)
  assert.equal(p.fltrWithCode, `$${PRICING.fltr.price - 10}`)
})

test("reminderPrices: refuses to print a price for a code that would make the order free", () => {
  assert.throws(() => reminderPrices(PRICING.fltr.price * 100))
})

test("reminderSubject: names the price that reader can have, never the bundle to an owner", () => {
  const p = reminderPrices(1000)
  assert.ok(reminderSubject("bundle", p).includes(p.bundleWithCode))
  assert.ok(reminderSubject("fltr", p).includes(p.fltrWithCode))
  assert.equal(/three|bundle/i.test(reminderSubject("fltr", p)), false)
  for (const v of ["bundle", "fltr"] as const) assert.ok(reminderSubject(v, p).length <= 60, v)
})

test("bundleEndsOn: a date while the deadline is ahead, nothing once it has passed or is unset", () => {
  const raw = "2026-10-31T23:59:59-07:00"
  assert.equal(bundleEndsOn(new Date("2026-10-02T12:00:00Z"), raw), "October 31")
  assert.equal(bundleEndsOn(new Date("2026-11-02T12:00:00Z"), raw), null)
  assert.equal(bundleEndsOn(new Date("2026-10-02T12:00:00Z"), null), null)
})
