import { test } from "node:test"
import assert from "node:assert/strict"
import { checkoutUrls } from "./plugin-checkout-logic"

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
