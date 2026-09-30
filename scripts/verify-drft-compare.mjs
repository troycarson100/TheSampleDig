#!/usr/bin/env node
// drft's "Hear it in action" section: the dark band the player sits on, and the
// room around it.
//
//   npm run dev                     # in another terminal
//   node scripts/verify-drft-compare.mjs
import { chromium, devices } from "playwright"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

const browser = await chromium.launch()

for (const [name, options] of [
  ["1280px", { viewport: { width: 1280, height: 900 } }],
  ["375px", { ...devices["iPhone SE"], viewport: { width: 375, height: 667 } }],
]) {
  const page = await browser.newPage(options)
  await page.goto(BASE + "/drft", { waitUntil: "networkidle" })
  check(`${name}: the section is on the page`, await page.locator("[data-drft-ab]").count() === 1)

  const s = await page.locator("[data-drft-ab]").evaluate((el) => {
    const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
    const lum = ({ r, g, b }) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
    const band = el.getBoundingClientRect()
    const unitEl = el.querySelector("[data-drft-ab-unit]")
    const unit = unitEl.getBoundingClientRect()
    // What is actually painted behind the section: its own colour laid over
    // the page's, so a band with no colour of its own is measured as paper
    // and not as the black that "transparent" parses to.
    const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 })
    const page = parse(getComputedStyle(el.closest("[data-plugin]")).backgroundColor)
    const own = parse(getComputedStyle(el).backgroundColor)
    const ground = over(own, page)
    const shadow = getComputedStyle(unitEl).boxShadow
    const reels = document.querySelector("[data-reels]")
    const firstCard = reels.querySelector("video, img")
    return {
      left: band.left, width: band.width, screen: document.documentElement.clientWidth,
      opaque: own.a === 1, groundLum: lum(ground),
      groundOnPage: ratio(ground, page),
      title: ratio(parse(getComputedStyle(el.querySelector("h2")).color), ground),
      shadow, shadowOnGround: /rgb/.test(shadow) ? ratio(parse(shadow.match(/rgba?\([^)]+\)/)[0]), ground) : 0,
      unitWidth: unit.width, unitLeft: unit.left, unitRight: unit.right,
      under: band.bottom - unit.bottom, over: el.querySelector("h2").getBoundingClientRect().top - band.top,
      toReels: reels.getBoundingClientRect().top - band.bottom,
      toFirstCard: firstCard ? firstCard.getBoundingClientRect().top - band.bottom : null,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })

  check(`${name}: the band runs from one edge of the screen to the other`,
    Math.abs(s.left) < 1 && Math.abs(s.width - s.screen) < 1, `from ${s.left}, ${s.width} of ${s.screen}`)
  check(`${name}: the band is dark`, s.opaque && s.groundLum < 0.03, `luminance ${s.groundLum.toFixed(3)}`)
  check(`${name}: and stands apart from the page around it`, s.groundOnPage >= 7, `${s.groundOnPage.toFixed(2)}:1`)
  check(`${name}: the heading is readable on it`, s.title >= 4.5, `${s.title.toFixed(2)}:1`)
  check(`${name}: the player's offset shadow can be seen on it`, s.shadowOnGround >= 3, `${s.shadowOnGround.toFixed(2)}:1 — ${s.shadow}`)
  check(`${name}: the player keeps to the page's measure`, s.unitWidth <= 960 && s.unitLeft >= 16 && s.unitRight <= s.screen - 16,
    `${s.unitWidth} wide, ${s.unitLeft} to ${s.unitRight}`)
  // The shadow is cast 7px down, so the room is measured from the player and
  // has to clear that first.
  check(`${name}: there is more room under the player than over the heading`, s.under >= 96 && s.under > s.over, `${s.under} under, ${s.over} over`)
  check(`${name}: the reels stand clear of the band`, s.toReels >= 48, `${s.toReels}px`)
  check(`${name}: the page does not scroll sideways`, s.sideways <= 1, `${s.sideways}px`)
  await page.close()
}

await browser.close()
console.log(`\nverify-drft-compare: ${failures.length ? `${failures.length} failed` : "all passed"}`)
process.exit(failures.length ? 1 : 0)
