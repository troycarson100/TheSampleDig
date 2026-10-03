import { test } from "node:test"
import assert from "node:assert/strict"
import {
  RECOVERY_SESSION_TTL_S,
  cartProducts,
  cartRecoveryEnabled,
  decideRecoveryEmail,
  recoverySessionParams,
  type ExpiredSession,
} from "./cart-recovery-logic"
import { cartTotal, renderCartRecoveryHtml } from "./cart-recovery-email"
import { PRICING } from "./products"

const base: ExpiredSession = {
  id: "cs_1",
  created: 1_000,
  metadata: { product: "fltr", products: "fltr" },
  customer_email: "Buyer@Example.com",
  consent: { promotions: "opt_in" },
  after_expiration: { recovery: { url: "https://buy.stripe.com/r/x" } },
}

test("cartRecoveryEnabled: only when switched on by name", () => {
  assert.equal(cartRecoveryEnabled({}), false)
  assert.equal(cartRecoveryEnabled({ STRIPE_CART_RECOVERY: "true" }), false)
  assert.equal(cartRecoveryEnabled({ STRIPE_CART_RECOVERY: "on" }), true)
})

test("recoverySessionParams: asks for consent, keeps the link, and expires in three hours", () => {
  const p = recoverySessionParams(1_000_000)
  assert.equal(p.consent_collection.promotions, "auto")
  assert.equal(p.after_expiration.recovery.enabled, true)
  assert.equal(p.expires_at, 1_000 + RECOVERY_SESSION_TTL_S)
  // Stripe's floor is 30 minutes and its ceiling a day.
  assert.ok(RECOVERY_SESSION_TTL_S >= 30 * 60 && RECOVERY_SESSION_TTL_S <= 24 * 60 * 60)
})

test("cartProducts: the sold list, else what the product grants", () => {
  assert.deepEqual(cartProducts({ product: "shft", products: "shft,fltr" }), ["shft", "fltr"])
  assert.deepEqual(cartProducts({ product: "bundle" }), ["shft", "drft", "fltr"])
  assert.deepEqual(cartProducts({ product: "pro" }), [])
  assert.deepEqual(cartProducts(null), [])
})

test("decideRecoveryEmail: an opted-in buyer's abandoned plugin cart is written about", () => {
  assert.deepEqual(decideRecoveryEmail(base, [], []), {
    send: true,
    email: "buyer@example.com",
    url: "https://buy.stripe.com/r/x",
    products: ["fltr"],
  })
})

test("decideRecoveryEmail: no consent, no email", () => {
  assert.equal(decideRecoveryEmail({ ...base, consent: null }, [], []).send, false)
  assert.equal(decideRecoveryEmail({ ...base, consent: { promotions: "opt_out" } }, [], []).send, false)
})

test("decideRecoveryEmail: nothing without a link, an address, or plugins", () => {
  assert.deepEqual(decideRecoveryEmail({ ...base, after_expiration: null }, [], []), { send: false, reason: "no_link" })
  assert.deepEqual(decideRecoveryEmail({ ...base, customer_email: null }, [], []), { send: false, reason: "no_email" })
  assert.deepEqual(decideRecoveryEmail({ ...base, metadata: { product: "pro" } }, [], []), { send: false, reason: "not_plugin" })
})

test("decideRecoveryEmail: a cart reopened from a reminder that lapses again gets no second", () => {
  assert.deepEqual(decideRecoveryEmail({ ...base, recovered_from: "cs_0" }, [], []), { send: false, reason: "second_try" })
})

test("decideRecoveryEmail: only the newest of several attempts is written about", () => {
  const later = { id: "cs_2", created: 2_000, status: "expired" }
  assert.deepEqual(decideRecoveryEmail(base, [later], []), { send: false, reason: "superseded" })
  assert.equal(decideRecoveryEmail(base, [{ id: "cs_1", created: 1_000, status: "expired" }], []).send, true)
})

test("decideRecoveryEmail: and not at all once they've paid", () => {
  assert.equal(decideRecoveryEmail(base, [{ id: "cs_2", created: 1_000, status: "complete" }], []).send, false)
})

test("decideRecoveryEmail: a cart holding something since bought is let go", () => {
  const cart = { ...base, metadata: { product: "shft", products: "shft,fltr" } }
  assert.deepEqual(decideRecoveryEmail(cart, [], ["fltr"]), { send: false, reason: "owned" })
  assert.equal(decideRecoveryEmail(cart, [], ["drft"]).send, true)
})

test("cartTotal: all three at the bundle price, otherwise each at its own", () => {
  assert.equal(cartTotal(["shft", "drft", "fltr"]).total, PRICING.bundle.price)
  assert.equal(cartTotal(["shft", "fltr"]).total, PRICING.shft.price + PRICING.fltr.price)
})

test("renderCartRecoveryHtml: the link, the price, and the plugins, with markup escaped", () => {
  const html = renderCartRecoveryHtml({ products: ["shft", "drft", "fltr"], url: "https://buy.stripe.com/r/a?b=1&c=2", saleEnds: "October 31" })
  assert.ok(html.includes("https://buy.stripe.com/r/a?b=1&amp;c=2"))
  assert.ok(html.includes(`$${PRICING.bundle.price}`))
  assert.ok(html.includes("ends October 31"))
  for (const n of ["shft", "drft", "fltr"]) assert.ok(html.includes(`alt="${n}"`))
  assert.ok(!renderCartRecoveryHtml({ products: ["fltr"], url: "u", saleEnds: "October 31" }).includes("ends October 31"))
})
