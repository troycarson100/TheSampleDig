import { test } from "node:test"
import assert from "node:assert/strict"
import { CODE_PLACEHOLDER, MEMBER_OFFER_IMAGE, OFFER_URL_PLACEHOLDER, UNSUBSCRIBE_PLACEHOLDER, renderMemberOfferHtml } from "./email"

const html = renderMemberOfferHtml({ amountOff: "$10", expires: "October 30" })

test("member offer email: shows fltr, from an address any email app can load", () => {
  const img = html.match(/<img[^>]*>/)?.[0] ?? ""
  assert.ok(img, "no image")
  assert.match(img, /src="https?:\/\/[^"]+\/fltr\/email\.jpg"/)
  assert.equal(img.includes(`src="${MEMBER_OFFER_IMAGE}"`), true)
})

test("member offer email: the image says what it is, for anyone whose email app hides pictures", () => {
  const alt = html.match(/<img[^>]*alt="([^"]*)"/)?.[1] ?? ""
  assert.match(alt, /fltr/)
  assert.ok(alt.length > 20)
})

test("member offer email: the image is sized for the email and leads to the offer", () => {
  const img = html.match(/<img[^>]*>/)?.[0] ?? ""
  assert.match(img, /width="432"/)
  assert.match(img, /max-width: 432px/)
  assert.match(img, /height: auto/)
  const link = html.match(/<a [^>]*>\s*<img/)?.[0] ?? ""
  assert.ok(link.includes(`href="${OFFER_URL_PLACEHOLDER}"`), link)
})

test("member offer email: keeps its code, link, date and unsubscribe", () => {
  for (const part of [CODE_PLACEHOLDER, OFFER_URL_PLACEHOLDER, UNSUBSCRIBE_PLACEHOLDER, "October 30"]) {
    assert.ok(html.includes(part), part)
  }
})
