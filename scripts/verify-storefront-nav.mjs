#!/usr/bin/env node
// Drives the real nav dropdown and ticker in Chromium.
//
//   npm run dev                     # in another terminal
//   node scripts/verify-storefront-nav.mjs
//
// The intro-countdown checks need NEXT_PUBLIC_FLTR_INTRO_ENDS set to a future
// date in .env.local and the dev server restarted; without it the script checks
// the unset behaviour instead and says so.
import { readFileSync } from "node:fs"
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
const TRIGGER = 'a[aria-controls="plugins-menu-panel"]'
const trigger = page.locator(TRIGGER)
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

// "Plugins" is itself a link, to whichever plugin the menu lists first. Read
// off the menu rather than written here as "/shft", so this still means
// something if the order ever changes.
const firstPlugin = await page.locator("#plugins-menu-panel a[data-menu-row]").first().getAttribute("href")
check("Plugins links to the first plugin in the menu",
  !!firstPlugin && (await trigger.getAttribute("href")) === firstPlugin,
  `trigger ${await trigger.getAttribute("href")}, first row ${firstPlugin}`)

await page.keyboard.press("Escape")
await page.waitForTimeout(120)
check("Escape closes it", await trigger.getAttribute("aria-expanded") === "false")
check("Escape returns focus to the trigger",
  await page.evaluate(() => document.activeElement?.getAttribute("aria-controls")) === "plugins-menu-panel")

// Escape (above) deliberately leaves DOM focus on the trigger. Calling
// .focus() on an element that already has focus is a browser no-op — it
// fires no `focus` event — so this check must move focus away first, or it
// would silently exercise nothing and pass by accident (this bit a real
// review: the panel had regressed to never closing, which left focus here
// too, and that coincidentally made this check "pass" for the wrong reason).
await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
await trigger.focus()
await page.waitForTimeout(150)
check("opens on keyboard focus", await trigger.getAttribute("aria-expanded") === "true")
await page.keyboard.press("ArrowDown")
check("ArrowDown moves into the rows",
  await page.evaluate(() => document.activeElement?.getAttribute("role")) === "menuitem")

// --- clicking "Plugins" -------------------------------------------------------
// Each from a page that is NOT the first plugin's, so landing there is the
// click's doing.
{
  const other = await page.locator("#plugins-menu-panel a[data-menu-row]").nth(1).getAttribute("href")
  const nav = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await nav.goto(BASE + other, { waitUntil: "networkidle" })
  const link = nav.locator(TRIGGER)

  // The way a mouse gets there: over it first, which opens the panel.
  await link.hover()
  await nav.waitForTimeout(200)
  check("before the click: hovering has the panel open", await link.getAttribute("aria-expanded") === "true")
  await link.click()
  await nav.waitForURL(BASE + firstPlugin, { timeout: 10000 }).catch(() => {})
  check("clicking Plugins goes to the first plugin's page", nav.url() === BASE + firstPlugin, nav.url())
  // The pointer is still on the link, now on a new page with a new nav under
  // it, and the browser reports that as the pointer entering the link: a
  // `mouseover` a few milliseconds after the new nav mounts. Left to the
  // browser that event arrives before the page is listening in roughly one
  // run in three (measured: the panel reopened in 5 runs of 8 with the guard
  // in PluginsMenu removed), so a check that waited for it would pass or fail
  // by luck. This sends the same event itself, once the page is settled.
  // `relatedTarget: null` — arriving from nowhere — is what makes React treat
  // it as the pointer entering; from any element React itself rendered, it
  // waits for that element's `mouseout` instead and this would test nothing.
  await nav.waitForLoadState("networkidle")
  await nav.locator(TRIGGER).evaluate((el) => {
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: null }))
  })
  await nav.waitForTimeout(250)
  check("and the panel does not open over it while the pointer rests on the link",
    await nav.locator(TRIGGER).getAttribute("aria-expanded") === "false")

  // On the page it already points at there is no route change to close the
  // panel, so the click has to.
  await nav.mouse.move(5, 400)
  await nav.waitForTimeout(250)
  await nav.locator(TRIGGER).hover()
  await nav.waitForTimeout(200)
  check("moving away and back opens the panel again", await nav.locator(TRIGGER).getAttribute("aria-expanded") === "true")
  await nav.locator(TRIGGER).click()
  await nav.waitForTimeout(250)
  check("clicking Plugins on the first plugin's own page closes the panel and stays put",
    await nav.locator(TRIGGER).getAttribute("aria-expanded") === "false" && nav.url() === BASE + firstPlugin,
    `${await nav.locator(TRIGGER).getAttribute("aria-expanded")} at ${nav.url()}`)

  // From the keyboard: Enter on the focused link is a click.
  await nav.goto(BASE + other, { waitUntil: "networkidle" })
  await nav.locator(TRIGGER).focus()
  await nav.keyboard.press("Enter")
  await nav.waitForURL(BASE + firstPlugin, { timeout: 10000 }).catch(() => {})
  check("Enter on Plugins goes to the first plugin's page", nav.url() === BASE + firstPlugin, nav.url())
  await nav.close()
}

// --- ticker -----------------------------------------------------------------
const variant = await page.locator("[data-sale-strip]").getAttribute("data-strip-variant")
const hasClock = await page.locator("[data-countdown]").count() === 1
if (process.env.NEXT_PUBLIC_FLTR_INTRO_ENDS) {
  check("intro set: ticker shows the countdown", variant === "intro", `variant=${variant}`)
  check("intro set: the clock renders", hasClock)
} else {
  console.log("  note  NEXT_PUBLIC_FLTR_INTRO_ENDS unset — checking fallback behaviour")
  check("intro unset: ticker falls back to the bundle", variant === "bundle", `variant=${variant}`)
  // The bundle runs to a deadline of its own (BUNDLE_OFFER_ENDS in
  // lib/plugins.ts), so a clock here is the bundle's — and there is one
  // exactly while that deadline is still ahead.
  const raw = readFileSync(new URL("../lib/plugins.ts", import.meta.url), "utf8")
    .match(/export const BUNDLE_OFFER_ENDS[^=]*=\s*(?:"([^"]+)"|null)/)
  const bundleLive = Boolean(raw?.[1]) && new Date(raw[1]).getTime() > Date.now()
  check(`intro unset: ${bundleLive ? "the bundle's clock renders" : "no clock renders"}`, hasClock === bundleLive)
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
// The drawer's own "Plugins" link, which goes to the same place as the one in
// the desktop nav.
const drawerLink = mobile.locator("a.nav-drawer-link").filter({ hasText: /^\s*Plugins\s*$/ })
check("drawer: Plugins links to the first plugin in the menu",
  (await drawerLink.count()) === 1 && (await drawerLink.getAttribute("href")) === firstPlugin,
  `${await drawerLink.count()} link(s), href ${await drawerLink.first().getAttribute("href").catch(() => null)}`)
await mobile.close()

await browser.close()
process.exit(failures.length ? 1 : 0)
