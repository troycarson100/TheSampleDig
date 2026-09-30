import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveCartIdentity, decideCartContents, readPromoRequest, decideCartPromo } from "./cart-checkout-decision"
import { PRICING } from "./products"

// --- resolveCartIdentity -----------------------------------------------------

test("resolveCartIdentity: no session and no email refuses", () => {
  const r = resolveCartIdentity({ postedEmail: "", buyer: null })
  assert.deepEqual(r, { kind: "invalid-identity" })
})

test("resolveCartIdentity: no session and a malformed email refuses", () => {
  const r = resolveCartIdentity({ postedEmail: "not-an-email", buyer: null })
  assert.deepEqual(r, { kind: "invalid-identity" })
})

test("resolveCartIdentity: no session and a valid email is ok", () => {
  const r = resolveCartIdentity({ postedEmail: "guest@example.com", buyer: null })
  assert.deepEqual(r, { kind: "ok" })
})

test("resolveCartIdentity: a session with no posted email is ok — nothing to disagree with", () => {
  const r = resolveCartIdentity({ postedEmail: "", buyer: { id: "u1", email: "alice@example.com" } })
  assert.deepEqual(r, { kind: "ok" })
})

test("resolveCartIdentity: a session and a matching posted email is ok", () => {
  const r = resolveCartIdentity({ postedEmail: "alice@example.com", buyer: { id: "u1", email: "alice@example.com" } })
  assert.deepEqual(r, { kind: "ok" })
})

test("resolveCartIdentity: a session and a matching posted email in a different case is ok", () => {
  const r = resolveCartIdentity({ postedEmail: "alice@example.com", buyer: { id: "u1", email: "Alice@Example.com" } })
  assert.deepEqual(r, { kind: "ok" })
})

// The exact failure the whole-increment review's Important 5 describes: a
// page that rendered the guest form (useSession() hadn't caught up yet) posts
// a DIFFERENT email than the live session's. Silently letting the session win
// charges and grants an identity the buyer never confirmed on this page.
test("resolveCartIdentity: a session and a DIFFERENT posted email refuses, naming the session's address", () => {
  const r = resolveCartIdentity({ postedEmail: "bob@example.com", buyer: { id: "u1", email: "alice@example.com" } })
  assert.deepEqual(r, { kind: "session-email-mismatch", sessionEmail: "alice@example.com" })
})

test("resolveCartIdentity: a session with no email on it can't mismatch and is ok", () => {
  const r = resolveCartIdentity({ postedEmail: "bob@example.com", buyer: { id: "u1", email: null } })
  assert.deepEqual(r, { kind: "ok" })
})

// --- decideCartContents ------------------------------------------------------

test("decideCartContents: owning one item present in the cart refuses, naming it", () => {
  const r = decideCartContents({ ids: ["shft", "drft"], ownedIds: ["shft"] })
  assert.deepEqual(r, { kind: "already-owned", owns: ["shft"] })
})

test("decideCartContents: a fully-owned cart refuses as owned, not empty", () => {
  const r = decideCartContents({ ids: ["shft", "drft"], ownedIds: ["shft", "drft"] })
  assert.equal(r.kind, "already-owned")
  assert.deepEqual((r as { owns: string[] }).owns, ["shft", "drft"])
})

test("decideCartContents: an empty or all-garbage cart (nothing owned, nothing valid) is empty", () => {
  const r = decideCartContents({ ids: [], ownedIds: [] })
  assert.deepEqual(r, { kind: "empty" })
  const garbage = decideCartContents({ ids: ["not-a-plugin"], ownedIds: [] })
  assert.deepEqual(garbage, { kind: "empty" })
})

test("decideCartContents: all three sellable prices as the bundle, not three singles", () => {
  const r = decideCartContents({ ids: ["shft", "drft", "fltr"], ownedIds: [] })
  assert.equal(r.kind, "priced")
  if (r.kind !== "priced") return
  assert.equal(r.product, "bundle")
  assert.equal(r.bundleApplied, true)
  assert.deepEqual(r.sellable, ["shft", "drft", "fltr"])
})

test("decideCartContents: a single sellable item prices as that plugin, not the bundle", () => {
  const r = decideCartContents({ ids: ["shft"], ownedIds: [] })
  assert.equal(r.kind, "priced")
  if (r.kind !== "priced") return
  assert.equal(r.product, "shft")
  assert.equal(r.bundleApplied, false)
})

test("decideCartContents: two sellable items price as two singles, not the bundle and not owned/empty", () => {
  const r = decideCartContents({ ids: ["shft", "drft"], ownedIds: [] })
  assert.equal(r.kind, "priced")
  if (r.kind !== "priced") return
  assert.equal(r.bundleApplied, false)
  assert.deepEqual(r.sellable, ["shft", "drft"])
})

test("decideCartContents: owning fltr elsewhere doesn't block buying shft+drft, which weren't asked to include it", () => {
  // The shape a resubmission takes after a client already removed an owned
  // item: fltr isn't in `ids` at all here, only in what's owned.
  const r = decideCartContents({ ids: ["shft", "drft"], ownedIds: ["fltr"] })
  assert.equal(r.kind, "priced")
  if (r.kind !== "priced") return
  assert.equal(r.bundleApplied, false)
  assert.deepEqual(r.sellable, ["shft", "drft"])
})

// --- readPromoRequest --------------------------------------------------------

test("readPromoRequest: absent, null and empty all mean the order has no code", () => {
  for (const none of [undefined, null, ""]) {
    assert.deepEqual(readPromoRequest(none), { kind: "none" })
  }
})

test("readPromoRequest: a code is looked up as sent, trimmed", () => {
  assert.deepEqual(readPromoRequest(" SAVE20 "), { kind: "lookup", code: "SAVE20" })
})

test("readPromoRequest: anything else in the code's place is refused, never treated as no code", () => {
  // Treating these as "none" would send the buyer to pay full price on an
  // order their page showed them discounted.
  for (const bad of ["not a code!", "  ", "ab", 20, true, ["SAVE20"], { code: "SAVE20", percentOff: 100 }]) {
    assert.deepEqual(readPromoRequest(bad), { kind: "malformed" }, JSON.stringify(bad))
  }
})

// --- decideCartPromo ---------------------------------------------------------

const twentyOff = { code: "SAVE20", percentOff: 20, amountOffCents: null, minimumCents: null, restricted: false }
/** Dollars left after 20% off, worked in cents the way the code under test
 *  does — `price * 0.8` in floating point is not quite the same number. */
const lessTwenty = (dollars: number) => (dollars * 100 - Math.round(dollars * 100 * 0.2)) / 100

test("decideCartPromo: a code Stripe did not find is refused", () => {
  assert.deepEqual(decideCartPromo({ found: null, sellable: ["shft"] }), { kind: "refused" })
})

test("decideCartPromo: a good code is applied by its Stripe id, and paid is the discounted total", () => {
  const r = decideCartPromo({ found: { id: "promo_123", offer: twentyOff }, sellable: ["shft"] })
  assert.deepEqual(r, { kind: "apply", promotionCodeId: "promo_123", paid: lessTwenty(PRICING.shft.price) })
})

test("decideCartPromo: on the whole catalog the discount comes off the bundle price", () => {
  const r = decideCartPromo({ found: { id: "promo_123", offer: twentyOff }, sellable: ["shft", "drft", "fltr"] })
  assert.deepEqual(r, { kind: "apply", promotionCodeId: "promo_123", paid: lessTwenty(PRICING.bundle.price) })
})

test("decideCartPromo: an order under the code's minimum is refused, not sold at full price", () => {
  const offer = { ...twentyOff, minimumCents: PRICING.shft.price * 100 + 1 }
  assert.deepEqual(decideCartPromo({ found: { id: "promo_123", offer }, sellable: ["shft"] }), { kind: "refused" })
})

test("decideCartPromo: a code limited to certain products is applied, with paid left undiscounted", () => {
  const offer = { ...twentyOff, restricted: true }
  const r = decideCartPromo({ found: { id: "promo_123", offer }, sellable: ["shft", "drft"] })
  assert.deepEqual(r, { kind: "apply", promotionCodeId: "promo_123", paid: PRICING.shft.price + PRICING.drft.price })
})
