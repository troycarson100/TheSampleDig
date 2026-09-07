import { test } from "node:test"
import assert from "node:assert/strict"
import { checkoutUrls } from "./plugin-checkout-logic"

test("checkoutUrls: success lands on /thanks with the session placeholder, product and price", () => {
  const urls = checkoutUrls("https://sampleroll.com", "shft", 19, "/shft")
  assert.equal(urls.success_url, "https://sampleroll.com/thanks?session_id={CHECKOUT_SESSION_ID}&product=shft&paid=19")
})

test("checkoutUrls: cancel returns to the page the buyer left", () => {
  assert.equal(checkoutUrls("http://localhost:3000", "bundle", 34, "/plugins").cancel_url, "http://localhost:3000/plugins?purchase=canceled")
  assert.equal(checkoutUrls("http://localhost:3000", "drft", 15, "/drft").cancel_url, "http://localhost:3000/drft?purchase=canceled")
})
