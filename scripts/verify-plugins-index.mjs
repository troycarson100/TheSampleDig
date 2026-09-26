#!/usr/bin/env node
import { chromium } from "playwright"
const { PRICING } = await import("../lib/products.ts")
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
await page.goto(BASE + "/plugins", { waitUntil: "networkidle" })

check("bundle panel present", await page.locator("#bundle").count() === 1)
const bundleText = await page.locator("#bundle").innerText()
check("bundle shows $59", bundleText.includes("59"), bundleText.slice(0, 120))
check("bundle strikes $147", bundleText.includes("147"), bundleText.slice(0, 120))
for (const id of ["shft", "drft", "fltr"]) {
  check(`${id} card present`, await page.locator(`[data-plugin-card="${id}"]`).count() === 1)
}

// fltr's own price is $19 (see lib/products.ts) - a page-wide "no $19
// anywhere" check can never pass once fltr has a card, since that is not a
// stale leftover but fltr's real price. The original intent was to catch the
// OLD pricing leaking onto the WRONG plugin, so assert it per element instead:
// fltr's card must show its own price, and nothing else on the page - the
// other two cards or the bundle panel - may show it.
const fltrPrice = `$${PRICING.fltr.price}`
const fltrPriceRe = new RegExp(`\\$${PRICING.fltr.price}\\b`)
const fltrText = await page.locator('[data-plugin-card="fltr"]').innerText()
check(`fltr card shows its own ${fltrPrice}`, fltrPriceRe.test(fltrText), fltrText.slice(0, 120))
for (const id of ["shft", "drft"]) {
  const cardText = await page.locator(`[data-plugin-card="${id}"]`).innerText()
  check(`${id} card does not show fltr's ${fltrPrice}`, !fltrPriceRe.test(cardText), cardText.slice(0, 120))
}
check(`bundle panel does not show fltr's ${fltrPrice}`, !fltrPriceRe.test(bundleText), bundleText.slice(0, 120))

const body = await page.locator("main").innerText()
check("no stale $34 anywhere on the page", !/\$34\b/.test(body))

await browser.close()
process.exit(failures.length ? 1 : 0)
