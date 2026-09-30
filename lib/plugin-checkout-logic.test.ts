import { test } from "node:test"
import assert from "node:assert/strict"
import { checkoutUrls, sessionDiscount } from "./plugin-checkout-logic"

test("sessionDiscount: a code from the site is applied, and Stripe's own promo box is left off", () => {
  // Stripe rejects a session that sets both, so the second assertion is what
  // keeps checkout from failing outright for anyone who entered a code.
  const params = sessionDiscount("promo_123")
  assert.deepEqual(params, { discounts: [{ promotion_code: "promo_123" }] })
  assert.equal("allow_promotion_codes" in params, false)
})

test("sessionDiscount: with no code, Stripe's promo box stays, exactly as before", () => {
  for (const none of [null, undefined, ""]) {
    assert.deepEqual(sessionDiscount(none), { allow_promotion_codes: true })
  }
})

test("checkoutUrls: success lands on /thanks with the session placeholder, product and price", () => {
  const urls = checkoutUrls("https://sampleroll.com", "shft", 19, "/shft")
  assert.equal(urls.success_url, "https://sampleroll.com/thanks?session_id={CHECKOUT_SESSION_ID}&product=shft&paid=19")
})

test("checkoutUrls: cancel returns to the page the buyer left", () => {
  // "bundle" is still a real CompProduct (comp codes can grant it), but
  // nothing constructs a checkout session for it with a dedicated cancel
  // page anymore - cart checkout is the only path that sells a bundle, and
  // it cancels back to /checkout like everything else in the cart.
  assert.equal(checkoutUrls("http://localhost:3000", "bundle", 34, "/checkout").cancel_url, "http://localhost:3000/checkout?purchase=canceled")
  assert.equal(checkoutUrls("http://localhost:3000", "drft", 15, "/drft").cancel_url, "http://localhost:3000/drft?purchase=canceled")
})
