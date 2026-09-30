#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { chromium, devices } from "playwright"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

// The bundle's deadline, read out of the source rather than restated here, so
// moving the date does not mean moving it twice. `null` when it is turned off.
const BUNDLE_ENDS = (() => {
  const src = readFileSync(new URL("../lib/plugins.ts", import.meta.url), "utf8")
  const m = src.match(/export const BUNDLE_OFFER_ENDS[^=]*=\s*(?:"([^"]+)"|null)/)
  if (!m) throw new Error("BUNDLE_OFFER_ENDS not found in lib/plugins.ts")
  return m[1] ? new Date(m[1]) : null
})()

// The prices the strip should show, read out of lib/products.ts rather than
// typed here, so a price change is one edit and not two.
const PRICES = (() => {
  const src = readFileSync(new URL("../lib/products.ts", import.meta.url), "utf8")
  const fltr = src.match(/fltr:\s*\{\s*price:\s*(\d+)/)
  const bundle = src.match(/bundle:\s*\{\s*price:\s*(\d+)/)
  if (!fltr || !bundle) throw new Error("PRICING not found in lib/products.ts")
  return { fltr: fltr[1], bundle: bundle[1] }
})()

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

  // Every pill has to be readable while the pointer is on it — the active one
  // included, which for a while took the hover's pale tint and kept its own
  // cream label. Contrast is worked out from what the browser actually
  // painted: the label's colour against the pill's background, laid over the
  // rail's when it is see-through. 4.5:1 is the AA floor for text this size.
  for (const id of ["shft", "drft", "fltr"]) {
    const pill = page.locator(`[data-plugin-rail] [data-pill="${id}"]`)
    await page.mouse.move(5, 400)
    await pill.hover()
    await page.waitForTimeout(250)
    const ratio = await pill.evaluate((el) => {
      const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
      const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 })
      const lum = ({ r, g, b }) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const rail = parse(getComputedStyle(el.closest("[data-plugin-rail]")).backgroundColor)
      const ground = over(parse(getComputedStyle(el).backgroundColor), rail)
      const label = over(parse(getComputedStyle(el).color), ground)
      const [hi, lo] = [lum(label), lum(ground)].sort((a, b) => b - a)
      return (hi + 0.05) / (lo + 0.05)
    })
    check(`${path}: the ${id} pill is readable while hovered`, ratio >= 4.5, `${ratio.toFixed(2)}:1`)
  }
  await page.mouse.move(5, 400)

  if (active) {
    const isActive = await page.locator(`[data-pill="${active}"]`).getAttribute("data-active")
    check(`${path}: ${active} pill marked active`, isActive === "true", `got ${isActive}`)
    check(`${path}: aria-current set`,
      await page.locator(`[data-pill="${active}"][aria-current="page"]`).count() === 1)
  }

  // Signed out => owns nothing => the strip is either the bundle offer, or —
  // whenever fltr's intro window is live (NEXT_PUBLIC_FLTR_INTRO_ENDS set to
  // a future date, the whole point of this increment) — the intro price
  // instead. A check that only ever knew about the bundle's price would fail
  // on every plugin path the moment an owner actually sets that env var, so
  // branch on the rendered variant and assert the price that variant
  // actually promises (bundle: PRICING.bundle.price; intro: PRICING.fltr.price
  // — see lib/products.ts).
  check(`${path}: bundle pill present for a signed-out visitor`,
    await page.locator('[data-bundle-pill]').count() === 1)
  const stripVariant = await page.locator('[data-sale-strip]').getAttribute("data-strip-variant")
  const stripText = await page.locator('[data-sale-strip]').innerText()
  if (stripVariant === "intro") {
    check(`${path}: intro strip shows fltr's intro price`, stripText.includes(PRICES.fltr), stripText)
  } else {
    check(`${path}: sale strip variant is "bundle"`, stripVariant === "bundle", `got ${stripVariant}`)
    check(`${path}: sale strip shows the bundle price`, stripText.includes(PRICES.bundle), stripText)
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

// The bundle offer in the sale strip: the saving in the bundle button's red,
// and a clock that runs to the deadline and is gone once it has passed. The
// page's clock is set by hand throughout, so none of this depends on the day
// the script happens to be run.
const DAY = 86_400_000, HOUR = 3_600_000
const stripAt = async (time, { width = 1280, reducedMotion = "no-preference" } = {}) => {
  const p = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion })
  await p.clock.install({ time })
  await p.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await p.locator('[data-sale-strip][data-strip-variant]').waitFor({ timeout: 10000 })
  return p
}
// Read in the page rather than through a locator: with no clock there, a
// locator waits and then throws, and takes the rest of the script with it.
const clockText = (p) => p.evaluate(() => (document.querySelector('[data-sale-strip] [data-countdown]')?.innerText ?? "no clock").replace(/\s+/g, " ").trim())
const clocks = (p) => p.locator('[data-sale-strip] [data-countdown]').count()

if (BUNDLE_ENDS && await (async () => {
  const p = await stripAt(new Date(BUNDLE_ENDS.getTime() - DAY))
  const variant = await p.locator('[data-sale-strip]').getAttribute("data-strip-variant")
  await p.close()
  return variant === "bundle"
})()) {
  const page = await stripAt(new Date(BUNDLE_ENDS.getTime() - (3 * DAY + 4 * HOUR + 30_000)))
  const paint = await page.evaluate(() => {
    const parse = (c) => c.match(/[\d.]+/g).map(Number)
    const lum = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const save = getComputedStyle(document.querySelector("[data-strip-save]"))
    const pill = getComputedStyle(document.querySelector("[data-bundle-pill]"))
    const ink = lum(parse(save.color))
    // The red is a gradient, so the tag has to be readable on every stop of it.
    const stops = (save.backgroundImage.match(/rgba?\([^)]+\)/g) ?? []).map((c) => lum(parse(c)))
    const ratios = stops.map((s) => (Math.max(ink, s) + 0.05) / (Math.min(ink, s) + 0.05))
    return { save: save.backgroundImage, pill: pill.backgroundImage, stops: stops.length, worst: Math.min(...ratios), saveInk: save.color, pillInk: pill.color }
  })
  check("strip: the saving wears the bundle button's red",
    paint.stops > 0 && paint.save === paint.pill, `tag ${paint.save} / button ${paint.pill}`)
  check("strip: and the button's cream on it", paint.saveInk === paint.pillInk, `tag ${paint.saveInk} / button ${paint.pillInk}`)
  check("strip: the saving is readable on every stop of the red", paint.stops > 0 && paint.worst >= 4.5, `${paint.worst.toFixed(2)}:1`)

  const dress = await page.locator("[data-sale-strip]").evaluate((el) => {
    const rule = getComputedStyle(el, "::after"), light = getComputedStyle(el, "::before")
    return {
      rule: rule.backgroundImage, ruleHeight: rule.height, ruleBottom: rule.bottom,
      pill: getComputedStyle(document.querySelector("[data-bundle-pill]")).backgroundImage,
      light: light.animationName, lightShown: light.display !== "none",
      text: el.innerText.replace(/\s+/g, " "),
    }
  })
  check("strip: a rule in the button's red runs along its foot",
    dress.rule === dress.pill && dress.ruleHeight === "2px" && dress.ruleBottom === "0px", `${dress.rule}, ${dress.ruleHeight} at ${dress.ruleBottom}`)
  check("strip: a light crosses the band", dress.lightShown && dress.light !== "none", `animation ${dress.light}`)
  check("strip: the row ends on the way in, in words", /get all three/i.test(dress.text), dress.text)
  check("strip: the clock is said to be what the offer ends in", /ends in/i.test(dress.text), dress.text)

  check("strip: the bundle offer carries one clock", await clocks(page) === 1, `${await clocks(page)} clocks`)
  const reading = await clockText(page)
  check("strip: the clock counts to the bundle's deadline", /^03 DAYS :? ?04 HRS :? ?00 MIN/i.test(reading), reading)
  const box = await page.locator("[data-sale-strip]").evaluate((el) => {
    const inner = el.firstElementChild.getBoundingClientRect()
    const rows = new Set([...el.firstElementChild.children].map((c) => { const r = c.getBoundingClientRect(); return Math.round(r.top + r.height / 2) }))
    return { h: el.getBoundingClientRect().height, left: inner.left, right: inner.right, screen: document.documentElement.clientWidth, rows: rows.size }
  })
  check("strip: still 64px tall with the clock in it", Math.abs(box.h - 64) <= 2, `h=${box.h}`)
  await page.close()

  // The last seconds, watched: the clock has to go on its own, without a reload.
  const last = await stripAt(new Date(BUNDLE_ENDS.getTime() - 4000))
  check("strip: the clock is still up four seconds before the deadline", await clocks(last) === 1)
  await last.clock.runFor(6000)
  await last.waitForTimeout(300)
  check("strip: the clock goes when the deadline passes, without a reload", await clocks(last) === 0, `${await clocks(last)} clocks`)
  const after = await last.locator("[data-sale-strip]").innerText()
  check("strip: and the offer stays", await last.locator("[data-sale-strip]").getAttribute("data-strip-variant") === "bundle" && after.includes(PRICES.bundle), after)
  await last.close()

  const late = await stripAt(new Date(BUNDLE_ENDS.getTime() + 60_000))
  check("strip: a visit after the deadline sees no clock", await clocks(late) === 0, `${await clocks(late)} clocks`)
  check("strip: nor the words that led up to it", !/ends in/i.test(await late.locator("[data-sale-strip]").innerText()))
  await late.close()

  // A repainting clock is motion. Reduced motion keeps the deadline and drops
  // the seconds.
  const calm = await stripAt(new Date(BUNDLE_ENDS.getTime() - DAY), { reducedMotion: "reduce" })
  const calmText = await clockText(calm)
  const calmLight = await calm.locator("[data-sale-strip]").evaluate((el) => {
    const light = getComputedStyle(el, "::before")
    return { shown: light.display !== "none", animation: light.animationName }
  })
  check("strip: reduced motion takes the light away altogether", !calmLight.shown && calmLight.animation === "none", JSON.stringify(calmLight))
  check("strip: reduced motion keeps the clock, without the seconds", await clocks(calm) === 1 && !/sec/i.test(calmText), calmText)
  await calm.close()

  // On a narrow screen the row has to stay one row, inside the screen. 371,
  // 431, 561, 741 and 881 are each the narrowest width of their step, where
  // the row is tightest; 320 is the narrowest phone still in use and 375 the
  // common one.
  for (const width of [320, 371, 375, 431, 561, 741, 881]) {
    const phone = await stripAt(new Date(BUNDLE_ENDS.getTime() - 33 * DAY), { width })
    const row = await phone.locator("[data-sale-strip]").evaluate((el) => {
      const inner = el.firstElementChild
      const shown = [...inner.children].filter((c) => getComputedStyle(c).display !== "none")
      // Counted from the text itself: each child is a flex item, so it is one
      // box however many lines the words inside it run to. Lines are told
      // apart by their middles, not their tops — the price is set larger than
      // the figures beside it, so one line has several tops and one middle.
      const lines = shown.filter((c) => !c.matches("[data-countdown]")).map((c) => {
        const range = document.createRange()
        range.selectNodeContents(c)
        const mids = [...range.getClientRects()].filter((r) => r.width > 0).map((r) => r.top + r.height / 2).sort((a, b) => a - b)
        return mids.filter((m, i) => i === 0 || m - mids[i - 1] > 8).length
      })
      const boxes = shown.map((c) => c.getBoundingClientRect())
      return {
        h: el.getBoundingClientRect().height,
        left: Math.min(...boxes.map((b) => b.left)), right: Math.max(...boxes.map((b) => b.right)),
        screen: document.documentElement.clientWidth,
        lines: Math.max(...lines),
        clock: inner.querySelectorAll("[data-countdown]").length,
        text: inner.innerText.replace(/\s+/g, " "),
      }
    })
    check(`${width}px: the strip keeps its clock`, row.clock === 1, row.text)
    check(`${width}px: the saving is ${width > 370 ? "shown" : "left out"}`, /save/i.test(row.text) === (width > 370), row.text)
    check(`${width}px: the strip's offer fits the screen`, row.left >= 0 && row.right <= row.screen, `${row.left} to ${row.right} of ${row.screen}`)
    check(`${width}px: no label in the strip breaks onto a second line`, row.lines === 1, `${row.lines} lines`)
    check(`${width}px: the strip is 64px tall`, Math.abs(row.h - 64) <= 2, `h=${row.h}`)
    check(`${width}px: the strip still names the offer and its price`, /all three/i.test(row.text) && row.text.includes(PRICES.bundle), row.text)
    await phone.close()
  }
} else {
  console.log("  note  the bundle has no deadline, or fltr's intro has the strip — skipping the bundle clock checks")
}

// Narrow viewports: the rail wraps onto two rows — the pills, then the bundle
// and the cart under them — rather than scrolling sideways, which hid the two
// controls that sell off the right edge. 320 is the narrowest phone still in
// use; 371 is the narrowest at which the bundle keeps its three marks, so the
// width at which the second row is tightest; 375 is the common one; 640 is
// wide enough for the bundle to fit beside the pills, where only the rule that
// gives the pills the whole first row keeps it under them.
for (const width of [320, 371, 375, 640]) {
  const mobile = await browser.newPage({ ...devices["iPhone SE"], viewport: { width, height: 667 } })
  await mobile.goto(BASE + "/shft", { waitUntil: "networkidle" })
  const rail = await mobile.locator('[data-plugin-rail]').evaluate((el) => {
    const box = (sel) => { const r = el.querySelector(sel).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, right: r.right, mid: r.top + r.height / 2 } }
    const pills = [...el.querySelectorAll('[data-pill]')].map((p) => p.getBoundingClientRect())
    const bundle = el.querySelector('[data-bundle-pill]')
    return {
      top: el.getBoundingClientRect().top,
      pillsTop: Math.min(...pills.map((p) => p.top)),
      pillsLeft: Math.min(...pills.map((p) => p.left)),
      heroLeft: document.querySelector('main[data-plugin] h1').getBoundingClientRect().left,
      pillsBottom: Math.max(...pills.map((p) => p.bottom)),
      pillRows: new Set(pills.map((p) => Math.round(p.top))).size,
      bundle: box('[data-bundle-pill]'),
      cart: box('[data-cart-button]'),
      furthestRight: Math.max(...[...el.querySelectorAll('[data-pill], [data-bundle-pill], [data-cart-button]')].map((n) => n.getBoundingClientRect().right)),
      screen: window.innerWidth,
      label: { scrollW: bundle.scrollWidth, clientW: bundle.clientWidth },
    }
  })
  check(`${width}px: the three pills share the first row`, rail.pillRows === 1, `${rail.pillRows} rows`)
  check(`${width}px: the bundle sits under the pills`, rail.bundle.top >= rail.pillsBottom, `bundle top ${rail.bundle.top}, pills end ${rail.pillsBottom}`)
  check(`${width}px: the cart shares the bundle's row`, Math.abs(rail.cart.mid - rail.bundle.mid) < 6, `cart ${rail.cart.mid}, bundle ${rail.bundle.mid}`)
  check(`${width}px: the first pill sits on the hero's left edge`, Math.abs(rail.pillsLeft - rail.heroLeft) <= 1, `pill ${rail.pillsLeft}, hero ${rail.heroLeft}`)
  const above = rail.pillsTop - rail.top, between = rail.bundle.top - rail.pillsBottom
  check(`${width}px: the space between the rows matches the space above them`, Math.abs(above - between) <= 1.5, `${above} above, ${between} between`)
  check(`${width}px: nothing in the rail runs past the screen`, rail.furthestRight <= rail.screen, `${rail.furthestRight} of ${rail.screen}`)
  // The bundle pill clips its own overflow (for the light sweep), so a pill the
  // rail has squeezed doesn't wrap or spill — it just loses the end of its label.
  check(`${width}px: the bundle pill shows its whole label`, rail.label.scrollW <= rail.label.clientW, `${rail.label.scrollW}px of content in ${rail.label.clientW}px`)
  check(`${width}px: page itself does not scroll sideways`,
    await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  await mobile.close()
}

await browser.close()
process.exit(failures.length ? 1 : 0)
