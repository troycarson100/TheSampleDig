import { test } from "node:test"
import assert from "node:assert/strict"
import {
  buyerLookupFor,
  isDuplicateGrant,
  setPasswordPath,
  downloadHref,
  downloadsFor,
} from "./plugin-purchase-logic"

const guestless = { client_reference_id: null, metadata: {}, customer_details: null, customer_email: null }

test("buyerLookupFor: client_reference_id wins over everything", () => {
  const session = { ...guestless, client_reference_id: "u1", metadata: { userId: "u9" }, customer_details: { email: "a@b.c" } }
  assert.deepEqual(buyerLookupFor(session), { kind: "user", id: "u1" })
})

test("buyerLookupFor: metadata.userId is the fallback id", () => {
  assert.deepEqual(buyerLookupFor({ ...guestless, metadata: { userId: "u2" } }), { kind: "user", id: "u2" })
})

test("buyerLookupFor: a guest resolves by trimmed, lowercased email", () => {
  const session = { ...guestless, customer_details: { email: "  Buyer@Example.COM " } }
  assert.deepEqual(buyerLookupFor(session), { kind: "email", email: "buyer@example.com" })
})

test("buyerLookupFor: customer_email is used when customer_details has none", () => {
  assert.deepEqual(buyerLookupFor({ ...guestless, customer_email: "x@y.z" }), { kind: "email", email: "x@y.z" })
})

test("buyerLookupFor: nothing to go on", () => {
  assert.deepEqual(buyerLookupFor(guestless), { kind: "none" })
})

test("isDuplicateGrant: a row older than the session is a duplicate", () => {
  const sessionCreated = 1_700_000_000
  assert.equal(isDuplicateGrant(new Date(sessionCreated * 1000 - 1), sessionCreated), true)
})

test("isDuplicateGrant: a row created after the session began is this purchase", () => {
  const sessionCreated = 1_700_000_000
  assert.equal(isDuplicateGrant(new Date(sessionCreated * 1000 + 5_000), sessionCreated), false)
})

test("setPasswordPath carries the token and the welcome flag", () => {
  assert.equal(setPasswordPath("abc123"), "/reset-password?token=abc123&welcome=1")
})

test("downloadHref points at the download route with the key as credential", () => {
  assert.equal(
    downloadHref("shft", "installer-win", "SHFT-0000-0000-0000"),
    "/api/products/shft/download?asset=installer-win&key=SHFT-0000-0000-0000",
  )
})

test("downloadsFor lists every asset of the product with the key baked in", () => {
  const links = downloadsFor("drft", "DRFT-0000-0000-0000")
  assert.deepEqual(
    links.map((l) => l.id),
    ["installer", "installer-win", "manual"],
  )
  for (const l of links) {
    assert.ok(l.label.length > 0)
    assert.ok(l.href.startsWith("/api/products/drft/download?asset="))
    assert.ok(l.href.endsWith("&key=DRFT-0000-0000-0000"))
  }
})

test("downloadsFor returns nothing for an unknown product", () => {
  assert.deepEqual(downloadsFor("nope", "SHFT-0000-0000-0000"), [])
})
