import { test } from "node:test"
import assert from "node:assert/strict"
import {
  COMPLETE_SET_HOURS,
  COMPLETE_SET_PRICE,
  completeSetOffer,
  completeSetToken,
  readCompleteSetToken,
} from "./complete-set-logic"
import { PRICING } from "./products"

const OPENED = new Date("2026-10-02T12:00:00.000Z")
const SOON = new Date(OPENED.getTime() + 60_000)

test("completeSetOffer: own one, the other two at the two-left price", () => {
  const o = completeSetOffer(["shft"], OPENED, SOON)
  assert.ok(o)
  assert.deepEqual(o.missing, ["drft", "fltr"])
  assert.equal(o.price, COMPLETE_SET_PRICE[2])
  assert.equal(o.compareAt, PRICING.drft.price + PRICING.fltr.price)
  assert.equal(o.discountCents, (o.compareAt - o.price) * 100)
})

test("completeSetOffer: own two, the last one at the one-left price", () => {
  const o = completeSetOffer(["shft", "fltr"], OPENED, SOON)
  assert.deepEqual(o?.missing, ["drft"])
  assert.equal(o?.price, COMPLETE_SET_PRICE[1])
})

test("completeSetOffer: always cheaper than buying them one by one", () => {
  for (const owned of [["shft"], ["drft"], ["fltr"], ["shft", "drft"], ["drft", "fltr"]]) {
    const o = completeSetOffer(owned, OPENED, SOON)!
    assert.ok(o.price < o.compareAt && o.discountCents > 0, owned.join())
  }
})

test("completeSetOffer: never to someone who owns none (that's the bundle) or all three", () => {
  assert.equal(completeSetOffer([], OPENED, SOON), null)
  assert.equal(completeSetOffer(["shft", "drft", "fltr"], OPENED, SOON), null)
})

test("completeSetOffer: runs for a day from the purchase, then not", () => {
  const end = OPENED.getTime() + COMPLETE_SET_HOURS * 3_600_000
  assert.equal(completeSetOffer(["shft"], OPENED, new Date(end - 1))?.endsAt.getTime(), end)
  assert.equal(completeSetOffer(["shft"], OPENED, new Date(end)), null)
})

test("tokens: read back to the account and end they were made for", () => {
  const ends = new Date(OPENED.getTime() + 3_600_000)
  const t = completeSetToken("secret", "user_1", ends)
  assert.deepEqual(readCompleteSetToken("secret", t, OPENED), { userId: "user_1", endsAt: new Date(Math.floor(ends.getTime() / 1000) * 1000) })
})

test("tokens: a forged, altered or foreign-key token reads as nothing", () => {
  const ends = new Date(OPENED.getTime() + 3_600_000)
  const t = completeSetToken("secret", "user_1", ends)
  assert.equal(readCompleteSetToken("other-secret", t, OPENED), null)
  const [, mac] = t.split(".")
  const forged = `${Buffer.from(`user_2.${Math.floor(ends.getTime() / 1000)}`).toString("base64url")}.${mac}`
  assert.equal(readCompleteSetToken("secret", forged, OPENED), null)
  assert.equal(readCompleteSetToken("secret", `${t}x`, OPENED), null)
  assert.equal(readCompleteSetToken("secret", "nonsense", OPENED), null)
  assert.equal(readCompleteSetToken("secret", undefined, OPENED), null)
})

test("tokens: stop working when the offer ends", () => {
  const t = completeSetToken("secret", "user_1", new Date(OPENED.getTime() + 1000))
  assert.equal(readCompleteSetToken("secret", t, new Date(OPENED.getTime() + 1000)), null)
})

test("tokens: no secret, no token", () => {
  assert.throws(() => completeSetToken("", "user_1", OPENED))
  assert.equal(readCompleteSetToken("", "a.b", OPENED), null)
})
