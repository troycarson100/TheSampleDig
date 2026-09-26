#!/usr/bin/env node
import { chromium, devices } from "playwright"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

const browser = await chromium.launch()

for (const [path, active] of [["/plugins", null], ["/shft", "shft"], ["/drft", "drft"], ["/fltr", "fltr"]]) {
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

  // Signed out => owns nothing => bundle offer everywhere.
  check(`${path}: bundle pill present for a signed-out visitor`,
    await page.locator('[data-bundle-pill]').count() === 1)
  check(`${path}: sale strip shows the bundle`,
    (await page.locator('[data-sale-strip]').innerText()).includes("59"))

  // The rail must survive scrolling — that is the point of the redesign.
  const before = await rail.boundingBox()
  await page.evaluate(() => window.scrollBy(0, 1200))
  await page.waitForTimeout(250)
  const after = await rail.boundingBox()
  check(`${path}: rail stays put while the page scrolls`,
    before && after && Math.abs(before.y - after.y) < 2, `${before?.y} -> ${after?.y}`)

  await page.close()
}

// Narrow viewport: the rail scrolls sideways rather than wrapping or clipping.
const mobile = await browser.newPage({ ...devices["iPhone SE"] })
await mobile.goto(BASE + "/plugins", { waitUntil: "networkidle" })
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
