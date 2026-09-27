#!/usr/bin/env node
import { chromium, devices } from "playwright"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

const browser = await chromium.launch()

// /plugins is retired — a redirect, not a page of its own. It used to sit in
// the loop below as a fourth row with `active: null`, which skipped the
// whole active-pill block (2 of that row's checks) without anyone noticing:
// what ran instead was a second, silent copy of the /shft checks under a
// misleading label. Rather than duplicate /shft, assert the one thing that
// is actually specific to /plugins: that it redirects, and that it forwards
// the query string rather than dropping it — an affiliate ?ref= link served
// through a stale /plugins?ref=<code> URL depends on exactly this (see
// app/plugins/page.tsx and the whole-increment review's Critical 2).
{
  const page = await browser.newPage()
  await page.goto(BASE + "/plugins?ref=verify-plugin-chrome", { waitUntil: "networkidle" })
  check("/plugins redirects to /shft, forwarding the query string",
    page.url() === `${BASE}/shft?ref=verify-plugin-chrome`, page.url())
  await page.close()
}

for (const [path, active] of [["/shft", "shft"], ["/drft", "drft"], ["/fltr", "fltr"]]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(BASE + path, { waitUntil: "networkidle" })

  const rail = page.locator('[data-plugin-rail]')
  check(`${path}: rail present`, await rail.count() === 1)

  for (const id of ["shft", "drft", "fltr"]) {
    check(`${path}: ${id} pill present`, await page.locator(`[data-pill="${id}"]`).count() === 1)
  }

  if (active) {
    const isActive = await page.locator(`[data-pill="${active}"]`).getAttribute("data-active")
    check(`${path}: ${active} pill marked active`, isActive === "true", `got ${isActive}`)
    check(`${path}: aria-current set`,
      await page.locator(`[data-pill="${active}"][aria-current="page"]`).count() === 1)
  }

  // Signed out => owns nothing => the strip is either the bundle offer, or —
  // whenever fltr's intro window is live (NEXT_PUBLIC_FLTR_INTRO_ENDS set to
  // a future date, the whole point of this increment) — the intro price
  // instead. A check that only ever knew about the bundle's "59" would fail
  // on every plugin path the moment an owner actually sets that env var, so
  // branch on the rendered variant and assert the price that variant
  // actually promises (bundle: PRICING.bundle.price; intro: PRICING.fltr.price
  // — see lib/products.ts).
  check(`${path}: bundle pill present for a signed-out visitor`,
    await page.locator('[data-bundle-pill]').count() === 1)
  const stripVariant = await page.locator('[data-sale-strip]').getAttribute("data-strip-variant")
  const stripText = await page.locator('[data-sale-strip]').innerText()
  if (stripVariant === "intro") {
    check(`${path}: intro strip shows fltr's intro price`, stripText.includes("19"), stripText)
  } else {
    check(`${path}: sale strip variant is "bundle"`, stripVariant === "bundle", `got ${stripVariant}`)
    check(`${path}: sale strip shows the bundle price`, stripText.includes("59"), stripText)
  }

  // The rail must survive scrolling — that is the point of the redesign. Its
  // *unscrolled* position sits below the sale strip (by design, the strip
  // scrolls away and the rail sticks under the header once you pass it), so
  // comparing scroll-0 against scrolled would always show that expected
  // shift. Instead: scroll past the strip first so the rail is stuck, record
  // that position, scroll further, and assert it hasn't moved from there.
  await page.evaluate(() => window.scrollBy(0, 200))
  await page.waitForTimeout(250)
  const stuck1 = await rail.boundingBox()
  await page.evaluate(() => window.scrollBy(0, 1200))
  await page.waitForTimeout(250)
  const stuck2 = await rail.boundingBox()
  check(`${path}: rail stays stuck while the page keeps scrolling`,
    stuck1 && stuck2 && Math.abs(stuck1.y - stuck2.y) < 2, `${stuck1?.y} -> ${stuck2?.y}`)

  await page.close()
}

// Narrow viewport: the rail scrolls sideways rather than wrapping or clipping.
const mobile = await browser.newPage({ ...devices["iPhone SE"] })
await mobile.goto(BASE + "/shft", { waitUntil: "networkidle" })
const metrics = await mobile.locator('[data-plugin-rail]').evaluate((el) => ({
  scrollW: el.scrollWidth, clientW: el.clientWidth,
  overflowX: getComputedStyle(el).overflowX,
}))
check("375px: rail scrolls horizontally", ["auto", "scroll"].includes(metrics.overflowX), metrics.overflowX)
check("375px: page itself does not scroll sideways",
  await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
await mobile.close()

await browser.close()
process.exit(failures.length ? 1 : 0)
