#!/usr/bin/env node
// Drives the real nav dropdown and ticker in Chromium.
//
//   npm run dev                     # in another terminal
//   node scripts/verify-storefront-nav.mjs
//
// The intro-countdown checks need NEXT_PUBLIC_FLTR_INTRO_ENDS set to a future
// date in .env.local and the dev server restarted; without it the script checks
// the unset behaviour instead and says so.
import { chromium, devices } from "playwright"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
await page.goto(BASE + "/shft", { waitUntil: "networkidle" })

// --- dropdown ---------------------------------------------------------------
const trigger = page.locator('button[aria-controls="plugins-menu-panel"]')
check("trigger present", await trigger.count() === 1)
check("panel starts closed", await trigger.getAttribute("aria-expanded") === "false")

await trigger.hover()
await page.waitForTimeout(200)
check("opens on hover", await trigger.getAttribute("aria-expanded") === "true")
// Scoped to #plugins-menu-panel: SiteNav mounts PluginsMenuRows a second time
// inside the mobile drawer (portaled to document.body, hidden via `md:hidden`
// rather than unmounted), so an unscoped `[data-menu-row="x"]` matches 2 nodes
// at 1280px — the drawer copy is display:none but still in the DOM, and
// Playwright's count() does not filter by visibility. The unscoped selector
// from the brief's script always fails here; this is a real property of the
// app (by design — see SiteNav.tsx's comment on why the drawer needs its own
// copy), not a flake.
for (const id of ["shft", "drft", "fltr"]) {
  check(`panel lists ${id}`, await page.locator(`#plugins-menu-panel [data-menu-row="${id}"]`).count() === 1)
}
check("panel offers the bundle to a signed-out visitor",
  await page.locator('#plugins-menu-panel [data-menu-row="bundle"]').count() === 1)

await page.keyboard.press("Escape")
await page.waitForTimeout(120)
check("Escape closes it", await trigger.getAttribute("aria-expanded") === "false")
check("Escape returns focus to the trigger",
  await page.evaluate(() => document.activeElement?.getAttribute("aria-controls")) === "plugins-menu-panel")

await trigger.focus()
await page.waitForTimeout(150)
check("opens on keyboard focus", await trigger.getAttribute("aria-expanded") === "true")
await page.keyboard.press("ArrowDown")
check("ArrowDown moves into the rows",
  await page.evaluate(() => document.activeElement?.getAttribute("role")) === "menuitem")

// --- ticker -----------------------------------------------------------------
const variant = await page.locator("[data-sale-strip]").getAttribute("data-strip-variant")
const hasClock = await page.locator("[data-countdown]").count() === 1
if (process.env.NEXT_PUBLIC_FLTR_INTRO_ENDS) {
  check("intro set: ticker shows the countdown", variant === "intro", `variant=${variant}`)
  check("intro set: the clock renders", hasClock)
} else {
  console.log("  note  NEXT_PUBLIC_FLTR_INTRO_ENDS unset — checking fallback behaviour")
  check("intro unset: ticker falls back to the bundle", variant === "bundle", `variant=${variant}`)
  check("intro unset: no clock renders", !hasClock)
}

const stripBox = await page.locator("[data-sale-strip]").boundingBox()
check("strip is 64px tall", stripBox && Math.abs(stripBox.height - 64) <= 2, `h=${stripBox?.height}`)
check("no hydration or render errors in console", errors.length === 0, errors.slice(0, 2).join(" | "))
await page.close()

// --- narrow -----------------------------------------------------------------
const mobile = await browser.newPage({ ...devices["iPhone SE"] })
await mobile.goto(BASE + "/shft", { waitUntil: "networkidle" })
check("375px: page does not scroll sideways",
  await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
await mobile.close()

await browser.close()
process.exit(failures.length ? 1 : 0)
