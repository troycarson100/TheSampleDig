#!/usr/bin/env node
// Drives the real /shft page in Chromium and checks the two social-proof
// sections. Not a test framework — a script using the playwright library the
// repo already depends on.
//
//   npm run dev            # in another terminal
//   node scripts/verify-shft-social.mjs
//
// Override the target with BASE_URL=https://... to check a deploy.
import { chromium, devices } from "playwright"
import { mkdirSync } from "node:fs"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const OUT = "reports/shft-social"
const failures = []

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`)
  } else {
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`)
    failures.push(label)
  }
}

async function run() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()

  // ---- Desktop ----------------------------------------------------------
  console.log("\ndesktop 1440x900")
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await desktop.newPage()
  await page.goto(`${BASE}/shft`, { waitUntil: "domcontentloaded", timeout: 90000 })

  const feedback = page.locator('section[aria-labelledby="shft-feedback-title"]')
  await feedback.waitFor({ state: "attached", timeout: 60000 })
  check("feedback section renders", (await feedback.count()) === 1)

  // Count cards by anchor, not by [aria-hidden] — the platform glyphs and
  // monogram circles carry aria-hidden too and would make the count meaningless.
  const real = await feedback.locator('a:not([aria-hidden="true"])').count()
  const dupes = await feedback.locator('a[aria-hidden="true"]').count()
  check("five testimonial cards render", real === 5, `got ${real}`)
  check("duplicate set matches and is hidden from assistive tech", dupes === real, `${dupes} dupes vs ${real} real`)

  // Emoji-only quote must not be wrapped in curly quotes. Read it off the card
  // rather than matching on the text, so a regression fails instead of throwing.
  const atlas = (await feedback.locator('a[href*="atlasmaison"]').first().textContent()) || ""
  check("emoji-only quote has no quote marks", atlas.includes("🔥") && !atlas.includes("“"), JSON.stringify(atlas))

  // Track must actually be animating. Targeted by data attribute — an nth()
  // index would silently follow any markup change.
  const anim = await feedback
    .locator("[data-marquee-track]")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName)
  check("marquee track is animating", anim !== "none" && anim !== "", `animation-name: ${anim}`)

  // The seamless wrap depends on -50% landing exactly one full set along. If a
  // gap ever gets added to the track, this drifts and the loop visibly jumps.
  const wrap = await feedback.locator("[data-marquee-track]").first().evaluate((el) => {
    const kids = [...el.children]
    const half = kids.length / 2
    const setStride = kids[half].getBoundingClientRect().left - kids[0].getBoundingClientRect().left
    return { halfTrack: el.scrollWidth / 2, setStride, cards: kids.length }
  })
  check(
    "marquee wraps seamlessly (-50% == one full set)",
    Math.abs(wrap.halfTrack - wrap.setStride) < 1,
    `half-track ${wrap.halfTrack.toFixed(1)}px vs set stride ${wrap.setStride.toFixed(1)}px`,
  )

  // REELS is empty, so the carousel must be absent entirely.
  const reels = page.locator('section[aria-labelledby="shft-reels-title"]')
  check("reel carousel absent while REELS is empty", (await reels.count()) === 0)

  // The page must never scroll sideways — the marquee track is wider than the
  // viewport and must be clipped by its own overflow, not the body's.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check("no horizontal page overflow", overflow <= 1, `${overflow}px`)

  await page.screenshot({ path: `${OUT}/desktop-full.png`, fullPage: true })
  await feedback.screenshot({ path: `${OUT}/desktop-feedback.png` })

  // ---- Mobile -----------------------------------------------------------
  console.log("\nmobile (iPhone 13)")
  const mobile = await browser.newContext({ ...devices["iPhone 13"] })
  const mpage = await mobile.newPage()
  await mpage.goto(`${BASE}/shft`, { waitUntil: "domcontentloaded", timeout: 90000 })
  const mfeedback = mpage.locator('section[aria-labelledby="shft-feedback-title"]')
  await mfeedback.waitFor({ state: "attached", timeout: 60000 })
  check("feedback section renders on mobile", (await mfeedback.count()) === 1)
  const moverflow = await mpage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  check("no horizontal page overflow on mobile", moverflow <= 1, `${moverflow}px`)
  await mpage.screenshot({ path: `${OUT}/mobile-full.png`, fullPage: true })

  // ---- Reduced motion ---------------------------------------------------
  console.log("\nreduced motion")
  const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })
  const rpage = await rm.newPage()
  await rpage.goto(`${BASE}/shft`, { waitUntil: "domcontentloaded", timeout: 90000 })
  const rfeedback = rpage.locator('section[aria-labelledby="shft-feedback-title"]')
  await rfeedback.waitFor({ state: "attached", timeout: 60000 })
  const rdupes = rfeedback.locator('a[aria-hidden="true"]')
  const rdupeCount = await rdupes.count()
  const dupeVisible = rdupeCount > 0 ? await rdupes.first().isVisible() : false
  check(
    "duplicate cards rendered but hidden under reduced motion",
    rdupeCount > 0 && !dupeVisible,
    `${rdupeCount} dupes, visible=${dupeVisible}`,
  )
  const ranim = await rfeedback
    .locator("[data-marquee-track]")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName)
  check("marquee animation disabled under reduced motion", ranim === "none", `animation-name: ${ranim}`)
  await rpage.screenshot({ path: `${OUT}/reduced-motion.png`, fullPage: true })

  await browser.close()

  console.log(`\nscreenshots → ${OUT}/`)
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed:`)
    for (const f of failures) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log("\nall checks passed")
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
