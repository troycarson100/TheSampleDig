#!/usr/bin/env node
import { chromium } from "playwright"
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
const body = await page.locator("main").innerText()
check("no stale $19 anywhere on the page", !/\$19\b/.test(body))
check("no stale $34 anywhere on the page", !/\$34\b/.test(body))

await browser.close()
process.exit(failures.length ? 1 : 0)
