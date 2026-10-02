import { test } from "node:test"
import assert from "node:assert/strict"
import { CODE_PLACEHOLDER, OFFER_URL_PLACEHOLDER, UNSUBSCRIBE_PLACEHOLDER } from "./email"
import { REMINDER_IMAGES, renderOfferReminderHtml, reminderPreheader } from "./offer-reminder-email"
import { reminderPrices } from "./offer-reminder-logic"
import { PLUGIN_ORDER } from "./plugins"

const prices = reminderPrices(1000)
const opts = { prices, expires: "October 30", bundleEnds: "October 31" as string | null }
const bundle = renderOfferReminderHtml({ ...opts, variant: "bundle" })
const fltr = renderOfferReminderHtml({ ...opts, variant: "fltr" })

/** What a reader sees: the markup and the hidden preheader taken away. */
const text = (html: string) =>
  html.replace(/<div style="display: none[\s\S]*?<\/div>/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

test("reminder email: both kinds keep the code, its link and the unsubscribe", () => {
  for (const [name, html] of [["bundle", bundle], ["fltr", fltr]] as const) {
    for (const part of [CODE_PLACEHOLDER, OFFER_URL_PLACEHOLDER, UNSUBSCRIBE_PLACEHOLDER]) {
      assert.ok(html.includes(part), `${name}: ${part}`)
    }
  }
})

test("reminder email: says the extra money off is for existing members, and until when", () => {
  for (const html of [bundle, fltr]) {
    assert.match(text(html), /Extra \$10 off for existing members/)
    assert.match(text(html), /until October 30/)
  }
})

test("reminder email, bundle: the sale price, the list price, its deadline and the price with the code", () => {
  const t = text(bundle)
  assert.ok(t.includes(`All three plugins for ${prices.bundle}`), t)
  assert.ok(t.includes(prices.bundleWas))
  assert.ok(t.includes(`Save ${prices.bundleSaving} on shft, drft and fltr together`), t)
  assert.ok(t.includes("ends October 31"))
  assert.ok(t.includes(`Get all three for ${prices.bundleWithCode}`))
  assert.ok(t.includes(`just fltr, for ${prices.fltrWithCode}`))
})

test("reminder email, bundle: shows every plugin in the range, by name and picture", () => {
  for (const id of PLUGIN_ORDER) {
    assert.ok(bundle.includes(`src="${REMINDER_IMAGES[id]}"`), id)
    assert.match(text(bundle), new RegExp(`\\b${id}\\b`))
  }
})

test("reminder email, bundle: names no deadline once the bundle price has none ahead of it", () => {
  const html = renderOfferReminderHtml({ ...opts, bundleEnds: null, variant: "bundle" })
  assert.equal(/ends /.test(text(html)), false)
  assert.match(text(html), /Bundle sale/)
})

test("reminder email, fltr: never puts the bundle to someone who owns a plugin already", () => {
  const t = text(fltr)
  assert.equal(/bundle|all three/i.test(t), false, t)
  assert.equal(t.includes(prices.bundle), false)
  assert.equal(t.includes(prices.bundleWithCode), false)
  assert.equal(/bundle|all three/i.test(reminderPreheader({ ...opts, variant: "fltr" })), false)
  assert.ok(t.includes(`Get fltr for ${prices.fltrWithCode}`))
})

test("reminder email: every picture is one any mail app can load, sized, and says what it is", () => {
  for (const html of [bundle, fltr]) {
    const imgs = html.match(/<img[^>]*>/g) ?? []
    assert.ok(imgs.length >= 2)
    for (const img of imgs) {
      assert.match(img, /src="https?:\/\/[^"]+\/email\/[a-z-]+\.(jpg|png)"/, img)
      assert.match(img, /width="\d+"/, img)
      assert.match(img, /height: auto/, img)
      assert.ok((img.match(/alt="([^"]*)"/)?.[1] ?? "").length > 8, img)
    }
  }
})

test("reminder email: carries no stylesheet or script, which mail apps drop or refuse", () => {
  for (const html of [bundle, fltr]) assert.equal(/<style|<script|<link/i.test(html), false)
})
