#!/usr/bin/env node
// The before-and-after player under the hero on /drft and /fltr - one shared
// player (components/plugin-page/AbCompare.tsx) in each page's own clothes.
// What it does is checked on both pages; where it sits and what it looks
// like, on fltr's (drft's own layout is scripts/verify-drft-compare.mjs).
//
//   npm run dev                     # in another terminal
//   node scripts/verify-ab-compare.mjs
import { chromium } from "playwright"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

const PAGES = {
  "/drft": { section: "[data-drft-ab]", audio: "/drft/ab/", clips: 4 },
  "/fltr": { section: "[data-fltr-ab]", audio: "/fltr/ab/", clips: 5 },
}

// Autoplay needs a gesture; the clicks below are one. Headless Chromium plays
// audio without a device, so `paused` and `currentTime` move as they would.
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] })

async function section(label, options, body) {
  const page = await browser.newPage(options)
  page.setDefaultTimeout(8000)
  try { await body(page) } catch (e) { check(`${label}: ran to the end`, false, String(e?.message ?? e).split("\n")[0]) }
  finally { await page.close() }
}

/** The two <audio> elements: what each is, and whether it is heard. */
const players = (page, sel) => page.locator(`${sel} audio`).evaluateAll((els) => els.map((a) => ({
  src: a.getAttribute("src"), paused: a.paused, muted: a.muted, t: a.currentTime, preload: a.getAttribute("preload"),
})))

for (const [path, t] of Object.entries(PAGES)) {
  await section(path, { viewport: { width: 1280, height: 900 } }, async (page) => {
    const requested = []
    page.on("request", (r) => { if (r.url().includes(t.audio)) requested.push(r.url()) })
    await page.goto(BASE + path, { waitUntil: "networkidle" })
    const s = t.section
    check(`${path}: the player is on the page`, await page.locator(s).count() === 1)
    check(`${path}: nothing is downloaded until the visitor shows interest`, requested.length === 0, requested.join(", "))

    const chips = page.locator(`${s} [aria-label="Example clip"] button`)
    check(`${path}: one chip per clip`, await chips.count() === t.clips, `${await chips.count()}`)

    let a = await players(page, s)
    check(`${path}: two players, the clip without the plugin and with it`,
      a.length === 2 && a[0].src.endsWith("-off.mp3") && a[1].src.endsWith("-on.mp3") && a[0].src.replace("-off", "-on") === a[1].src,
      JSON.stringify(a.map((x) => x.src)))

    await page.locator(`${s} button[aria-label^="Play"]`).click()
    // Waits for the audio to get going rather than for a fixed time: on a
    // freshly started server the first clip can take a while to arrive.
    await page.waitForFunction(
      (sel) => [...document.querySelectorAll(`${sel} audio`)].every((a) => !a.paused && a.currentTime > 1),
      s,
      { timeout: 15000 },
    ).catch(() => {})
    a = await players(page, s)
    check(`${path}: play starts both, together`, a.every((x) => !x.paused) && Math.abs(a[0].t - a[1].t) < 0.1, JSON.stringify(a))
    check(`${path}: with the plugin on, only the plugin is heard`, a[0].muted && !a[1].muted, JSON.stringify(a.map((x) => x.muted)))
    check(`${path}: the time readout moves`, !/^0:00 \//.test((await page.locator(`${s} button[aria-label^="Pause"] ~ p`).innerText()).trim()) || a[1].t > 0.9,
      (await page.locator(`${s} button[aria-label^="Pause"] ~ p`).innerText()))

    const [offBtn] = await page.locator(`${s} [aria-label="Effect bypass"] button`).all()
    await offBtn.click()
    await page.waitForTimeout(200)
    a = await players(page, s)
    check(`${path}: switching off hears the dry clip, at the same moment`, !a[0].muted && a[1].muted && a.every((x) => !x.paused) && Math.abs(a[0].t - a[1].t) < 0.1, JSON.stringify(a))
    check(`${path}: the switch says which side is on`, (await offBtn.getAttribute("aria-pressed")) === "true")

    const before = a.map((x) => x.src)
    await chips.nth(1).click()
    await page.waitForTimeout(800)
    a = await players(page, s)
    const second = await chips.nth(1).innerText()
    check(`${path}: a chip changes the clip`, a.every((x, i) => x.src !== before[i] && x.src.startsWith(t.audio)) && (await chips.nth(1).getAttribute("aria-pressed")) === "true",
      `${second}: ${JSON.stringify(before)} -> ${JSON.stringify(a.map((x) => x.src))}`)
    check(`${path}: and it keeps playing`, a.every((x) => !x.paused), JSON.stringify(a.map((x) => x.paused)))

    const loaded = await page.evaluate(async (urls) => Promise.all(urls.map((u) => fetch(u).then((r) => r.status))), a.map((x) => x.src))
    check(`${path}: both of its files are there`, loaded.every((st) => st === 200), loaded.join())

    // Every clip, not only the two walked above: each chip's pair is there.
    const missing = []
    for (let i = 0; i < t.clips; i++) {
      await chips.nth(i).click()
      await page.waitForTimeout(150)
      const srcs = (await players(page, s)).map((x) => x.src)
      const st = await page.evaluate(async (urls) => Promise.all(urls.map((u) => fetch(u, { method: "HEAD" }).then((r) => r.status))), srcs)
      srcs.forEach((u, j) => { if (st[j] !== 200) missing.push(`${u} (${st[j]})`) })
    }
    check(`${path}: every clip's two files are there`, missing.length === 0, missing.join(", "))

    await page.locator(`${s} button[aria-label^="Pause"]`).click()
    await page.waitForTimeout(200)
    check(`${path}: pause stops both`, (await players(page, s)).every((x) => x.paused))
  })
}

// ---- fltr's: straight under the hero, on a light band -------------------------
for (const [name, options] of [
  ["1280px", { viewport: { width: 1280, height: 900 } }],
  ["375px", { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }],
]) {
  await section(`/fltr ${name}`, options, async (page) => {
    await page.goto(BASE + "/fltr", { waitUntil: "networkidle" })
    const r = await page.locator("[data-fltr-ab]").evaluate((el) => {
      const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
      const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
      const ratio = (x, y) => { const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05) }
      const band = parse(getComputedStyle(el).backgroundColor)
      const page = parse(getComputedStyle(el.closest("[data-plugin]")).backgroundColor)
      const box = el.getBoundingClientRect()
      const unit = el.querySelector("[data-fltr-ab-unit]").getBoundingClientRect()
      const prev = el.previousElementSibling
      return {
        before: prev?.tagName + (prev?.querySelector("[data-plugin-panel]") ? " with the panel" : ""),
        opaque: band.a === 1, light: lum(band), apart: ratio(band, page),
        title: ratio(parse(getComputedStyle(el.querySelector("h2")).color), band),
        edge: [box.left, box.width, document.documentElement.clientWidth],
        unit: [unit.left, unit.right],
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    check(`/fltr ${name}: the player comes straight after the hero`, r.before === "SECTION with the panel", r.before)
    check(`/fltr ${name}: its band is light`, r.opaque && r.light > 0.7, `luminance ${r.light.toFixed(3)}`)
    check(`/fltr ${name}: and stands apart from the black page`, r.apart >= 10, `${r.apart.toFixed(2)}:1`)
    check(`/fltr ${name}: the heading is readable on it`, r.title >= 7, `${r.title.toFixed(2)}:1`)
    check(`/fltr ${name}: the band runs edge to edge`, Math.abs(r.edge[0]) < 1 && Math.abs(r.edge[1] - r.edge[2]) < 1, r.edge.join(", "))
    check(`/fltr ${name}: the player keeps inside the page's margin`, r.unit[0] >= 16 && r.unit[1] <= r.edge[2] - 16, r.unit.join(", "))
    check(`/fltr ${name}: the page does not scroll sideways`, r.sideways <= 1, `${r.sideways}px`)
  })
}

// ---- fltr's reels: straight after the player, on a light grey band ---------
await section("/fltr reels", { viewport: { width: 1280, height: 900 } }, async (page) => {
  await page.goto(BASE + "/fltr", { waitUntil: "networkidle" })
  const r = await page.locator("[data-reels]").evaluate((el) => {
    const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
    const ab = el.previousElementSibling
    const band = parse(getComputedStyle(el).backgroundColor)
    const above = parse(getComputedStyle(ab).backgroundColor)
    const grey = Math.max(band.r, band.g, band.b) - Math.min(band.r, band.g, band.b) <= 12
    const poster = el.querySelector("img, video")
    const link = el.querySelector('a[href*="instagram.com"]')
    return {
      afterPlayer: ab?.hasAttribute("data-fltr-ab") ?? false,
      label: el.getAttribute("aria-label"),
      band: lum(band), above: lum(above), grey, opaque: band.a === 1,
      src: el.querySelector("video")?.getAttribute("src") ?? el.querySelector("img")?.getAttribute("src"),
      poster: poster?.getAttribute("poster") ?? poster?.getAttribute("src"),
      link: link?.getAttribute("href") ?? null,
    }
  })
  check("/fltr: the reels come straight after the player", r.afterPlayer)
  check("/fltr: and are named for screen readers", r.label === "Made with fltr", r.label)
  check("/fltr: on a light grey band", r.opaque && r.grey && r.band > 0.6, `luminance ${r.band.toFixed(3)}`)
  check("/fltr: a shade apart from the player's band above", r.above - r.band > 0.05, `${r.above.toFixed(3)} above, ${r.band.toFixed(3)} here`)
  const files = await page.evaluate(async (urls) => Promise.all(urls.map((u) => fetch(u, { method: "HEAD" }).then((x) => x.status))),
    ["/fltr/reels/Dd7UhVySifQ.mp4", "/fltr/reels/Dd7UhVySifQ.jpg", "/fltr/reels/peu806U37ms.mp4", "/fltr/reels/peu806U37ms.jpg"])
  check("/fltr: both reels and their posters are there", files.every((x) => x === 200), files.join())
  check("/fltr: with a dot for each", (await page.locator('[data-reels] button[aria-label^="Go to reel"]').count()) === 2)
  await page.locator('[data-reels] button[aria-label="Play reel"]').click()
  await page.waitForFunction(() => { const v = document.querySelector("[data-reels] video"); return v && !v.paused && v.currentTime > 0.5 }, null, { timeout: 15000 }).catch(() => {})
  const playing = await page.locator("[data-reels] video").evaluate((v) => ({ paused: v.paused, t: v.currentTime }))
  check("/fltr: the reel plays", !playing.paused && playing.t > 0.5, JSON.stringify(playing))
  const link = await page.locator('[data-reels] a[href*="instagram.com"]').getAttribute("href").catch(() => null)
  check("/fltr: and links to the post on Instagram", link === "https://www.instagram.com/reel/Dd7UhVySifQ/", String(link))

  await page.locator('[data-reels] button[aria-label="Next reel"]').click()
  await page.waitForFunction(() => document.querySelector("[data-reels] video")?.getAttribute("src")?.includes("peu806U37ms"), null, { timeout: 5000 }).catch(() => {})
  const second = await page.locator("[data-reels] video").evaluate((v) => ({ src: v.getAttribute("src"), poster: v.getAttribute("poster") }))
  check("/fltr: Next brings up the YouTube short", second.src === "/fltr/reels/peu806U37ms.mp4" && second.poster === "/fltr/reels/peu806U37ms.jpg", JSON.stringify(second))
  await page.locator('[data-reels] button[aria-label="Play reel"]').click()
  await page.waitForFunction(() => { const v = document.querySelector("[data-reels] video"); return v && !v.paused && v.currentTime > 0.5 }, null, { timeout: 15000 }).catch(() => {})
  const playing2 = await page.locator("[data-reels] video").evaluate((v) => ({ paused: v.paused, t: v.currentTime }))
  check("/fltr: and it plays", !playing2.paused && playing2.t > 0.5, JSON.stringify(playing2))
  const yt = await page.locator('[data-reels] a[href*="youtube.com"]').getAttribute("href").catch(() => null)
  check("/fltr: and links to the short on YouTube", yt === "https://youtube.com/shorts/peu806U37ms", String(yt))
})

await browser.close()
console.log(`\nverify-ab-compare: ${failures.length ? `${failures.length} failed` : "all passed"}`)
process.exit(failures.length ? 1 : 0)
