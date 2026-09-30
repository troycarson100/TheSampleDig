#!/usr/bin/env node
// The hero panel on /shft, /drft and /fltr: a screenshot of the plugin that says what
// each control does as the pointer crosses it, in a bar underneath, with the
// plugin's own page tabs clickable. Needs the dev server running.
//
// Every check runs once per page, under that page's name. What differs from
// one plugin to the next - which pages, which controls, what the words are -
// is in PANELS below; what the panel *does* is the same checks for all three.
import { chromium } from "playwright"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"

const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

// Facts about each page's panel, read off app/<plugin>/panel.ts. Written out
// here rather than imported: this runs under plain node, and a check that
// read its expectations from the file under test would agree with anything.
const PANELS = {
  "/shft": {
    name: "shft",
    ground: "rgb(11, 17, 27)",
    first: { id: "seq", shot: "/shft/tour-seq.webp", spots: 33, doors: ["fx"] },
    // A knob: where it is on its screenshot, what colour its section is
    // printed in, and what the plugin's help table says about it.
    knob: {
      id: "depth", x: 638, y: 907, size: 160, of: [1758, 1454], tone: "rgb(56, 214, 245)",
      name: "DEPTH", what: "how far the gate closes", tip: "stop short of full",
    },
    // A second control, reached from the keyboard.
    other: { id: "cutoff", name: "CUTOFF" },
    // A page tab that leads somewhere, and one that does not.
    door: { id: "tab-fx", name: "FX", view: "fx", shot: "/shft/tour-fx.webp", spots: 35, tip: "open the fx page" },
    back: { id: "tab-seq", view: "seq" },
    deadEnd: "tab-lfo",
    // A control that only exists on the second page.
    there: { id: "rv-size", name: "SIZE", what: "from a booth to a canyon" },
    idle: /hover any control to see what it does/i,
    clip: "hero-v2",
    intro: [/inside shft/i, /draw a curve on every step/i],
    sentence: /each step is a tiny envelope/i,
  },
  "/drft": {
    name: "drft",
    ground: "rgb(23, 21, 18)",
    first: { id: "sound", shot: "/drft/tour-sound.webp", spots: 29, doors: ["field", "circuit"] },
    // No tone of its own, so its ring takes the panel's accent - drft's ember.
    knob: {
      id: "bend", x: 782, y: 1148, size: 178, of: [1700, 1316], tone: "rgb(232, 100, 31)",
      name: "BEND", what: "bit-starves the signal", tip: "reach for it first",
    },
    other: { id: "noise", name: "NOISE" },
    door: { id: "tab-circuit", name: "CIRCUIT", view: "circuit", shot: "/drft/tour-circuit.webp", spots: 30, tip: "open the circuit page" },
    back: { id: "tab-sound", view: "sound" },
    there: { id: "burst", name: "BURST", what: "the colour reference dying" },
    // PAINT is a page behind a page: FIELD's round P key, not a tab.
    nested: { via: "tab-field", key: "paint", view: "paint", shot: "/drft/tour-paint.webp", renamed: { id: "style", name: "SET" }, home: "field" },
    idle: /hover any control to see what it does/i,
    clip: "/drft/hero",
    intro: [/inside drft/i, /a dying deck in your chain/i],
    sentence: /six knobs of damage on whatever you run through it/i,
  },
  "/fltr": {
    name: "fltr",
    ground: "rgb(11, 12, 19)",
    // One page, not several: what changes the whole panel is the character,
    // so the nine cells of the character grid are the doors, each to a
    // screenshot of the plugin with that character running.
    first: { id: "ladder", shot: "/fltr/tour-ladder.webp", spots: 75, doors: ["sem", "fold", "comb", "formant", "phase", "chord", "harmony", "shift"] },
    // fltr has no knobs. Its TUNE chip stands in for one: a small control with
    // room round it. The box is the chip's own in the editor (1197.2, 93,
    // 48.8 x 24 at 1280x748), scaled by 2000/1280 less the screenshot's 6px
    // trim. The ring takes the colour the plugin turns with the ladder.
    knob: {
      id: "tune", x: 1902.8, y: 158.1, size: 76.3, of: [1986, 1150], tone: "rgb(255, 181, 71)", square: true,
      name: "TUNE", what: "snaps the cutoff to the nearest note of the scale", tip: "sweep the filter and it plays in key",
    },
    other: { id: "cutoff", name: "CUTOFF" },
    door: { id: "char-harmony", name: "HARMONY", view: "harmony", shot: "/fltr/tour-harmony.webp", spots: 82, tip: "see the panel with harmony running" },
    back: { id: "char-ladder", view: "ladder" },
    there: { id: "core-warp", name: "WARP", what: "stretches the chord's notes apart" },
    // In harmony's colour, not the ladder's: the ring follows the character.
    thereTone: "rgb(255, 107, 125)",
    // 1.73 to 1: it takes the wide hero, and the whole width of a phone.
    wide: true,
    // Every character, its screenshot, how many controls it has, and one
    // that answers differently there than anywhere else.
    every: [
      { view: "ladder", door: "char-ladder", spots: 75, own: { id: "fm-focus", name: "FOCUS" } },
      { view: "sem", door: "char-sem", spots: 75, own: { id: "fm-ratio", name: "RATIO" } },
      { view: "fold", door: "char-fold", spots: 79, own: { id: "core-sym", name: "SYMMETRY" } },
      { view: "comb", door: "char-comb", spots: 76, own: { id: "core-polarity", name: "POLARITY" } },
      { view: "formant", door: "char-formant", spots: 77, own: { id: "shape", name: "VOWEL" } },
      { view: "phase", door: "char-phase", spots: 77, own: { id: "shape", name: "NOTCHES" } },
      { view: "chord", door: "char-chord", spots: 82, own: { id: "chord-window", name: "WINDOW" } },
      { view: "harmony", door: "char-harmony", spots: 82, own: { id: "core-detune", name: "DETUNE" } },
      { view: "shift", door: "char-shift", spots: 77, own: { id: "cutoff", name: "SHIFT" } },
    ],
    idle: /hover any control to see what it does/i,
    clip: "/fltr/hero",
    intro: [/inside fltr/i, /a filter that knows what key you are in/i],
    sentence: /stops being a filter you sweep and starts being one that plays/i,
  },
}

const browser = await chromium.launch()

/**
 * One stretch of checks, on a page of its own. If something in it cannot be
 * done at all - a control that is not there to hover, a tap that lands on
 * something else - that is reported as a failure of the stretch and the run
 * carries on with the next one. Without this the first thing that could not
 * be done ended the whole run, and every check after it went unreported:
 * one broken page hid the state of the other.
 */
async function stretch(label, options, body) {
  const page = await browser.newPage(options)
  page.setDefaultTimeout(6000)
  try {
    await body(page)
  } catch (e) {
    check(`${label}: ran to the end`, false, String(e?.message ?? e).split("\n")[0])
  } finally {
    await page.close()
  }
}

/** Everything a check needs to know about the panel's current state. */
const read = (page) => page.locator("[data-plugin-panel]").evaluate((el) => {
  const box = (n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }
  const screen = el.querySelector("img").parentElement
  const bar = el.querySelector("[data-panel-idle]").parentElement.parentElement
  const ring = el.querySelector("[data-panel-ring]")
  const shown = [...bar.querySelectorAll("[data-panel-idle], [data-panel-text]")].filter((t) => getComputedStyle(t).visibility === "visible")
  const pages = el.querySelector("[data-panel-pages]")
  const pageButtons = pages ? [...pages.querySelectorAll("button")] : []
  const door = el.querySelector("[data-panel-opens]")
  return {
    view: el.dataset.panelView,
    spot: el.dataset.panelSpot,
    visibleShots: [...screen.querySelectorAll("img")]
      .filter((i) => getComputedStyle(i).opacity === "1").map((i) => i.getAttribute("src")),
    shotTransition: getComputedStyle(screen.querySelector("img")).transitionDuration,
    screen: box(screen),
    ring: ring ? { ...box(ring), colour: getComputedStyle(ring).borderTopColor, round: getComputedStyle(ring).borderTopLeftRadius } : null,
    spots: el.querySelectorAll("[data-panel-hit]").length,
    doors: [...el.querySelectorAll("[data-panel-opens]")].map((d) => d.dataset.panelOpens),
    doorPing: door ? getComputedStyle(door, "::after").display : null,
    doorDot: door ? getComputedStyle(door, "::before").content : null,
    doorDotShown: door ? getComputedStyle(door, "::before").display !== "none" : null,
    said: shown.map((t) => t.innerText.replace(/\s+/g, " ").trim()),
    barHeight: Math.round(box(bar).h),
    barGround: getComputedStyle(bar).backgroundColor,
    gap: box(bar).y - (box(screen).y + box(screen).h),
    // Texts that have lost their end to the bar's ellipsis.
    cutShort: [...bar.querySelectorAll("[id^=panel-text-]")].filter((t) => t.scrollHeight > t.clientHeight + 1).map((t) => t.id.replace("panel-text-", "")),
    // Text wider than the bar it is in: nothing wraps it and nothing clips it,
    // so it runs out from under the panel's rounded edge.
    barSpill: bar.scrollWidth - bar.clientWidth,
    pagesShown: pages ? getComputedStyle(pages).display !== "none" : false,
    pageSmallest: pageButtons.length ? Math.min(...pageButtons.flatMap((b) => [b.getBoundingClientRect().width, b.getBoundingClientRect().height])) : null,
    pageSpill: pageButtons.length ? Math.max(...pageButtons.map((b) => b.getBoundingClientRect().right)) - bar.getBoundingClientRect().right : null,
    wide: el.hasAttribute("data-panel-wide"),
    // How much of the screenshot is out of sight to the side. There is never
    // meant to be any: the picture is as wide as the panel, whatever that is.
    slides: Math.round(screen.scrollWidth - el.clientWidth),
    corner: getComputedStyle(el).borderTopLeftRadius,
    left: el.getBoundingClientRect().left,
    right: el.getBoundingClientRect().right,
    bottom: el.getBoundingClientRect().bottom,
    // The screen's width, not window.innerWidth: on a phone a page that has
    // been pushed wider than the screen reports the *pushed* width there, so
    // a panel measured against it fits however far it sticks out.
    viewport: { w: document.documentElement.clientWidth, h: window.innerHeight },
  }
})

const hit = (page, id) => page.locator(`[data-plugin-panel] [data-panel-hit="${id}"]`)

// ONLY=/fltr runs one page's checks and leaves the others out.
const ONLY = process.env.ONLY
for (const [path, t] of Object.entries(PANELS).filter(([p]) => !ONLY || p === ONLY)) {
  const at = (label) => `${path}: ${label}`

  // ---- the panel itself, with a pointer, reduced motion requested ---------
  await stretch(at("with a pointer"), { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" }, async (page) => {
    await page.goto(BASE + path, { waitUntil: "networkidle" })
    await page.mouse.move(5, 5)

    check(at("the panel is in the hero"), await page.locator("main[data-plugin] > section:first-of-type [data-plugin-panel]").count() === 1)

    // The pills are the way between the three plugin pages. The hero changed
    // under them; they must not have.
    const pills = await page.locator("[data-plugin-rail] [data-pill]").evaluateAll((els) => els.map((e) => e.dataset.pill))
    check(at("the rail still carries shft, drft and fltr, in order"), pills.join() === "shft,drft,fltr", pills.join())

    let s = await read(page)
    check(at(`opens on the ${t.first.id} page, with its screenshot alone`),
      s.view === t.first.id && s.visibleShots.join() === t.first.shot, `${s.view}: ${s.visibleShots.join()}`)
    check(at("nothing is ringed until something is pointed at"), s.spot === "" && s.ring === null, `spot "${s.spot}"`)
    check(at("the bar starts by saying what to do"), s.said.length === 1 && t.idle.test(s.said[0]), s.said.join(" | "))
    check(at(`the ${t.first.id} page has its ${t.first.spots} controls`), s.spots === t.first.spots, `${s.spots}`)
    check(at("the page tabs that lead somewhere are marked as doors"), s.doors.join() === t.first.doors.join(), s.doors.join())
    check(at("a door carries its dot"), s.doorDot !== null && s.doorDot !== "none", `${s.doorDot}`)
    check(at("reduced motion: the door's ping is removed, not paused"), s.doorPing === "none", `${s.doorPing}`)
    check(at("reduced motion: the screenshots swap without a fade"), /^(0s)(, 0s)*$/.test(s.shotTransition), s.shotTransition)
    check(at("the bar is drawn in the plugin's own colours"), s.barGround === t.ground, s.barGround)
    check(at("the bar sits directly under the screenshot, with no gap"), Math.abs(s.gap) < 0.6, `${s.gap.toFixed(1)}px`)
    check(at("with a pointer, the page buttons stay out of the bar"), s.pagesShown === false)
    check(at("with a pointer, a control's target is the control and nothing more"),
      await hit(page, t.knob.id).evaluate((n) => getComputedStyle(n.firstElementChild).display === "none"))
    if (t.deadEnd) check(at("a tab with no page behind it is not a door"),
      (await hit(page, t.deadEnd).count()) === 1 && (await hit(page, t.deadEnd).getAttribute("data-panel-opens")) === null)
    const idleBar = s.barHeight

    // -- pointing at a knob
    await hit(page, t.knob.id).hover()
    await page.waitForTimeout(150)
    s = await read(page)
    check(at("hovering a knob rings it"), s.spot === t.knob.id && s.ring !== null, `spot "${s.spot}"`)
    if (s.ring) {
      const [W, H] = t.knob.of
      const cx = (s.ring.x + s.ring.w / 2 - s.screen.x) / s.screen.w
      const cy = (s.ring.y + s.ring.h / 2 - s.screen.y) / s.screen.h
      const w = s.ring.w / s.screen.w
      check(at("the ring sits on the knob, at the knob's size"),
        Math.abs(cx - t.knob.x / W) < 0.004 && Math.abs(cy - t.knob.y / H) < 0.004 && Math.abs(w - t.knob.size / W) < 0.004,
        `centre ${cx.toFixed(4)},${cy.toFixed(4)} (want ${(t.knob.x / W).toFixed(4)},${(t.knob.y / H).toFixed(4)}), width ${w.toFixed(4)} (want ${(t.knob.size / W).toFixed(4)})`)
      check(at(`the ring is ${t.knob.square ? "a box" : "round"}, in the colour of the ${t.knob.square ? "character" : "knob's section"}`),
        (s.ring.round === "50%") === !t.knob.square && s.ring.colour === t.knob.tone, `${s.ring.round}, ${s.ring.colour}`)
    }
    check(at("the bar names the knob, says what it does, and gives one thing to try"),
      s.said.length === 1 && s.said[0].toUpperCase().startsWith(t.knob.name) && s.said[0].includes(t.knob.what) && s.said[0].includes(t.knob.tip),
      s.said.join(" | "))
    check(at("the bar keeps its height when it fills"), s.barHeight === idleBar, `${idleBar} -> ${s.barHeight}`)

    // -- the pointer leaves
    await page.mouse.move(5, 5)
    await page.waitForTimeout(150)
    s = await read(page)
    check(at("the bar keeps the last control when the pointer leaves"), s.spot === t.knob.id && s.said[0]?.includes(t.knob.what), s.said.join(" | "))

    // -- from the keyboard
    await hit(page, t.other.id).focus()
    await page.waitForTimeout(150)
    s = await read(page)
    check(at("focusing a control from the keyboard does what hovering it does"),
      s.spot === t.other.id && s.said[0]?.toUpperCase().startsWith(t.other.name), `spot "${s.spot}": ${s.said.join(" | ")}`)

    // -- a page tab
    await hit(page, t.door.id).hover()
    await page.waitForTimeout(150)
    s = await read(page)
    check(at("hovering a page tab says where it leads, and does not go there"),
      s.view === t.first.id && s.said[0]?.includes(t.door.tip), `${s.view}: ${s.said.join(" | ")}`)
    await hit(page, t.door.id).click()
    await page.waitForTimeout(200)
    s = await read(page)
    check(at(`clicking ${t.door.name} opens the ${t.door.view} page`), s.view === t.door.view, s.view)
    check(at(`the ${t.door.view} page shows its own screenshot, alone`), s.visibleShots.join() === t.door.shot, s.visibleShots.join())
    check(at(`the ${t.door.view} page has its ${t.door.spots} controls`), s.spots === t.door.spots, `${s.spots}`)
    check(at("the bar is still on the tab that was clicked, now without an invitation to click it"),
      s.spot === t.door.id && s.said[0]?.toUpperCase().startsWith(t.door.name) && !s.said[0].includes(t.door.tip), s.said.join(" | "))
    check(at("the tab of the page now showing is no longer a door"), !s.doors.includes(t.door.view), s.doors.join())
    check(at("the bar keeps its height from page to page"), s.barHeight === idleBar, `${idleBar} -> ${s.barHeight}`)

    await hit(page, t.there.id).hover()
    await page.waitForTimeout(150)
    s = await read(page)
    check(at(`the ${t.door.view} page's own controls answer`),
      s.said[0]?.toUpperCase().startsWith(t.there.name) && s.said[0].includes(t.there.what), s.said.join(" | "))
    if (t.thereTone) check(at(`on the ${t.door.view} page the ring takes that page's colour`), s.ring?.colour === t.thereTone, `${s.ring?.colour}`)

    await page.locator(`[data-plugin-panel] [data-panel-hit="${t.back.id}"]`).focus()
    await page.keyboard.press("Enter")
    await page.waitForTimeout(200)
    s = await read(page)
    check(at("Enter on a page tab goes back the way a click would"),
      s.view === t.back.view && s.visibleShots.join() === t.first.shot, `${s.view}: ${s.visibleShots.join()}`)

    // -- every door, in turn
    for (const e of t.every ?? []) {
      await hit(page, e.door).click()
      await page.waitForTimeout(200)
      s = await read(page)
      check(at(`${e.door} opens the ${e.view} page, with its screenshot alone`),
        s.view === e.view && s.visibleShots.join() === `${path}/tour-${e.view}.webp`, `${s.view}: ${s.visibleShots.join()}`)
      check(at(`the ${e.view} page has its ${e.spots} controls`), s.spots === e.spots, `${s.spots}`)
      check(at(`the ${e.view} page leads to every other page and not to itself`),
        s.doors.length === t.every.length - 1 && !s.doors.includes(e.view), s.doors.join())
      await hit(page, e.own.id).hover()
      await page.waitForTimeout(120)
      s = await read(page)
      check(at(`on the ${e.view} page, ${e.own.id} answers as ${e.own.name}`), s.said[0]?.toUpperCase().startsWith(e.own.name), s.said.join(" | "))
      const img = await page.locator(`[data-plugin-panel] img[src="${path}/tour-${e.view}.webp"]`).evaluate((i) => ({ w: i.naturalWidth, h: i.naturalHeight }))
      check(at(`the ${e.view} screenshot loaded, at the size its boxes were measured on`), img.w === t.knob.of[0] && img.h === t.knob.of[1], `${img.w}x${img.h}`)
    }

    if (t.nested) {
      await hit(page, t.nested.via).click()
      await page.waitForTimeout(150)
      await hit(page, t.nested.key).click()
      await page.waitForTimeout(200)
      s = await read(page)
      check(at(`the ${t.nested.key} key opens the ${t.nested.view} page`),
        s.view === t.nested.view && s.visibleShots.join() === t.nested.shot, `${s.view}: ${s.visibleShots.join()}`)
      await hit(page, t.nested.renamed.id).hover()
      await page.waitForTimeout(150)
      s = await read(page)
      check(at(`on the ${t.nested.view} page a control answers to the name it has there`),
        s.said[0]?.toUpperCase().startsWith(t.nested.renamed.name), s.said.join(" | "))
      await hit(page, t.nested.key).click()
      await page.waitForTimeout(200)
      s = await read(page)
      check(at(`the same key leads back to the ${t.nested.home} page`), s.view === t.nested.home, s.view)
    }
  })

  // ---- what the panel replaced ------------------------------------------------
  await stretch(at("the rest of the page"), { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" }, async (page) => {
    await page.goto(BASE + path, { waitUntil: "networkidle" })

    // The clip the panel replaced is parked: not in the hero, not under it,
    // and nothing in the hero links to where it would be.
    const hero = page.locator("main[data-plugin] > section:first-of-type")
    check(at("the hero clip is nowhere on the page"),
      await page.locator(`video[src*='${t.clip}'], img[src*='${t.clip}']`).count() === 0)
    check(at("no clip section under the hero"), await page.locator("[data-hero-loop]").count() === 0)
    check(at("no link to a clip that isn't there"), await page.locator("[data-hero-watch]").count() === 0)

    // Only what can be seen: the bar keeps every control's text in the page
    // for the height it lends, and innerText leaves hidden text out.
    const text = await page.locator("main[data-plugin]").innerText()
    check(at("the intro section is gone"), !t.intro.some((re) => re.test(text)))
    const said = (text.match(new RegExp(t.sentence.source, "gi")) || []).length
    check(at("its sentence is said once, in the hero"), said === 1 && t.sentence.test(await hero.innerText()), `${said} times`)
  })

  // ---- it waits to be pointed at ------------------------------------------
  // Motion allowed here, since that is the state in which something could
  // move by itself.
  await stretch(at("left alone"), { viewport: { width: 1280, height: 800 } }, async (page) => {
    await page.goto(BASE + path, { waitUntil: "networkidle" })
    await page.mouse.move(5, 5)
    await page.waitForTimeout(6000)
    const s = await read(page)
    check(at("nothing happens by itself"), s.view === t.first.id && s.spot === "" && t.idle.test(s.said[0] ?? ""), `${s.view}, spot "${s.spot}"`)
    check(at("with motion allowed, the door pings"), s.doorPing !== "none", `${s.doorPing}`)
  })

  // ---- it fits ------------------------------------------------------------
  // The screenshot and its bar are read together, so both have to be on the
  // first screen without scrolling. 1000x723 is a small laptop window.
  for (const [width, height] of [[1000, 723], [1280, 800], [1440, 900]]) await stretch(at(`${width}x${height}`), { viewport: { width, height }, reducedMotion: "reduce" }, async (page) => {
    await page.goto(BASE + path, { waitUntil: "networkidle" })
    const s = await read(page)
    check(at(`${width}x${height}: the whole panel is on the first screen`), s.bottom <= s.viewport.h,
      `panel ends at ${Math.round(s.bottom)}, window is ${s.viewport.h}`)
    check(at(`${width}x${height}: the screenshot is still big enough to read`), s.screen.w >= 340, `${Math.round(s.screen.w)}px wide`)
    check(at(`${width}x${height}: the screenshot is all there, with nothing to slide`), s.slides <= 1, `${s.slides}px out of sight`)
    check(at(`${width}x${height}: the panel is ${t.wide ? "wide" : "not wide"}`), s.wide === Boolean(t.wide))
    if (t.wide) {
      // Half the hero would show a 1280px interface at about 550. It takes
      // most of the row instead, and the copy keeps enough to be read in.
      const copy = await page.locator("main[data-plugin] > section:first-of-type > div:first-child").evaluate((n) => n.getBoundingClientRect().width)
      check(at(`${width}x${height}: a wide panel takes more of the hero than the copy beside it`), s.screen.w > copy * 1.5 && copy >= 240,
        `panel ${Math.round(s.screen.w)}px, copy ${Math.round(copy)}px`)
    }
    // The bar is a caption: two lines of text on a panel of ordinary width,
    // three on the narrow one a small window leaves. It was once five.
    const lines = width >= 1280 ? 2 : 3
    check(at(`${width}x${height}: the bar is ${lines} lines tall, and no more`), s.barHeight <= lines * 17.5 + 24,
      `${s.barHeight}px`)
    check(at(`${width}x${height}: every control's text fits the bar whole`), s.cutShort.length === 0, s.cutShort.slice(0, 5).join(", "))
  })

  // ---- touched rather than pointed at ---------------------------------------
  // 320 is the narrowest phone still in use; 375 is the common one.
  for (const width of [320, 375]) await stretch(at(`${width}px`), { viewport: { width, height: 667 }, reducedMotion: "reduce", hasTouch: true, isMobile: true }, async (mobile) => {
    await mobile.goto(BASE + path, { waitUntil: "networkidle" })
    let s = await read(mobile)
    check(at(`${width}px: the panel is no wider than the screen`), s.left >= 0 && s.right <= s.viewport.w,
      `${Math.round(s.left)}..${Math.round(s.right)} of ${s.viewport.w}`)
    check(at(`${width}px: the screenshot is all there, with nothing to slide sideways`), s.slides <= 1 && Math.abs(s.screen.w - (s.right - s.left)) <= 1,
      `${s.slides}px out of sight, picture ${Math.round(s.screen.w)}px in a ${Math.round(s.right - s.left)}px panel`)
    if (t.wide) {
      // The whole of a 1280px interface: it has the screen from edge to edge.
      check(at(`${width}px: a wide panel runs from one edge of the screen to the other`),
        Math.abs(s.left) <= 0.5 && Math.abs(s.right - s.viewport.w) <= 0.5, `${s.left}..${s.right} of ${s.viewport.w}`)
      check(at(`${width}px: and squares its corners to meet them`), s.corner === "0px", s.corner)
      // Its doors are cells a few millimetres across: a dot on each would
      // cover what it marks, and the buttons in the bar do the job.
      check(at(`${width}px: the doors carry no dot`), s.doorDotShown === false, `${s.doorDotShown}`)
    } else {
      check(at(`${width}px: the panel keeps to the page's margin`), s.left >= 16 && s.right <= s.viewport.w - 16, `${s.left}..${s.right} of ${s.viewport.w}`)
    }
    check(at(`${width}px: the bar says to tap, not to hover`), s.said.length === 1 && /tap any control/i.test(s.said[0]), s.said.join(" | "))
    check(at(`${width}px: the page buttons are in the bar, inside it, 44px or more each way`),
      s.pagesShown && s.pageSpill <= 0 && s.pageSmallest >= 44, `shown ${s.pagesShown}, spill ${s.pageSpill}, smallest ${s.pageSmallest}`)
    const idleBar = s.barHeight

    // A knob here is 20 to 30px across. Its target grows toward 44px, but
    // only into room its neighbours are not using - measured on every pair of
    // controls that do not already overlap (a badge on a knob, anything on
    // the tube), since those have no gap between them to share.
    const targets = await mobile.locator("[data-plugin-panel]").evaluate((el, knob) => {
      const rect = (n) => { const r = n.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height } }
      const meet = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5
      const all = [...el.querySelectorAll("[data-panel-hit]")].map((n) => ({ id: n.dataset.panelHit, own: rect(n), reach: rect(n.firstElementChild) }))
      const shared = []
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        if (!meet(all[i].own, all[j].own) && meet(all[i].reach, all[j].reach)) shared.push(`${all[i].id}/${all[j].id}`)
      }
      const k = all.find((a) => a.id === knob)
      return { shared, shrunk: all.filter((a) => a.reach.w < a.own.w - 0.5 || a.reach.h < a.own.h - 0.5).map((a) => a.id), knob: k }
    }, t.knob.id)
    check(at(`${width}px: no two controls share a touch target`), targets.shared.length === 0, targets.shared.slice(0, 4).join(", "))
    check(at(`${width}px: no target is smaller than its control`), targets.shrunk.length === 0, targets.shrunk.slice(0, 4).join(", "))
    check(at(`${width}px: a knob's target is bigger than the knob`),
      targets.knob.reach.w > targets.knob.own.w + 4 && targets.knob.reach.w <= 44.5,
      `${targets.knob.own.w.toFixed(1)}px knob, ${targets.knob.reach.w.toFixed(1)}px target`)

    await mobile.locator(`[data-panel-page="${t.door.view}"]`).tap()
    await mobile.waitForTimeout(200)
    s = await read(mobile)
    check(at(`${width}px: a page button opens its page`), s.view === t.door.view && s.visibleShots.join() === t.door.shot, `${s.view}: ${s.visibleShots.join()}`)

    await hit(mobile, t.there.id).tap()
    await mobile.waitForTimeout(200)
    s = await read(mobile)
    check(at(`${width}px: tapping a knob does what hovering it does`),
      s.spot === t.there.id && s.said[0]?.toUpperCase().startsWith(t.there.name), `spot "${s.spot}": ${s.said.join(" | ")}`)
    check(at(`${width}px: the bar's text stays inside the bar`), s.barSpill <= 0, `${s.barSpill}px past the edge`)
    check(at(`${width}px: the bar keeps its height`), s.barHeight === idleBar, `${idleBar} -> ${s.barHeight}`)
    check(at(`${width}px: every control's text fits the bar whole`), s.cutShort.length === 0, s.cutShort.slice(0, 5).join(", "))
  })
}

// ---- every picture on fltr's page is there ----------------------------------
// fltr's pictures are all cut from the panel's four screenshots, and before
// them the page had none: a missing one is drawn as an empty panel
// (role="img"), which is what this looks for.
if (!ONLY || ONLY === "/fltr") await stretch("/fltr: pictures", { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" }, async (page) => {
  const missing = []
  page.on("response", (r) => { if (/\/fltr\//.test(r.url()) && r.status() >= 400) missing.push(r.url().replace(BASE, "")) })
  await page.goto(BASE + "/fltr", { waitUntil: "networkidle" })
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) } })
  await page.waitForLoadState("networkidle")
  const blocks = await page.locator("main[data-plugin]").evaluate((main) => {
    const sections = [...main.querySelectorAll("section")].filter((s) => s.querySelector("h2") && s.querySelector("p") && !s.id)
    return sections.map((s) => ({
      title: s.querySelector("h2").innerText,
      img: s.querySelector("img")?.getAttribute("src") ?? null,
      loaded: (s.querySelector("img")?.naturalWidth ?? 0) > 0,
    }))
  })
  const features = blocks.filter((b) => b.img !== null || /characters|chord and harmony|two sounds|two cores|modulation|push|draws/i.test(b.title))
  check("/fltr: seven feature sections, each with a title", features.length === 7 && features.every((b) => b.title.trim().length > 0),
    features.map((b) => b.title || "(no title)").join(" | "))
  check("/fltr: each has its picture, loaded", features.every((b) => b.img && b.loaded), features.filter((b) => !b.loaded).map((b) => b.title).join(" | "))
  check("/fltr: no two sections share a picture", new Set(features.map((b) => b.img)).size === features.length, features.map((b) => b.img).join(", "))
  check("/fltr: nothing on the page is drawn as missing", await page.locator('main[data-plugin] [role="img"]').count() === 0)
  check("/fltr: no picture failed to load", missing.length === 0, missing.join(", "))
  const og = await page.locator('meta[property="og:image"]').getAttribute("content")
  const share = og ? await page.request.get(og.startsWith("http") ? og.replace(/^https?:\/\/[^/]+/, BASE) : BASE + og) : null
  check("/fltr: the share image exists", Boolean(share?.ok()) && /image\/png/.test(share.headers()["content-type"] ?? ""), `${og}: ${share?.status()}`)
  const text = await page.locator("main[data-plugin]").innerText()
  check("/fltr: the page counts the characters the plugin has", /nine characters/i.test(text) && !/twelve/i.test(text))
  check("/fltr: and none that came off the grid", !/disperse|liquid|shatter|smear/i.test(text))
  const heroText = await page.locator("main[data-plugin] > section:first-of-type").innerText()
  check("/fltr: the hero says macOS and Windows", /macos\s*&\s*windows/i.test(heroText), heroText.replace(/\s+/g, " ").slice(-120))
  check("/fltr: the page says what it runs as on Windows", /on Windows as VST3 and a standalone app/i.test(text))
  check("/fltr: and nowhere says it does not", !/not yet|macos at launch|does it run on windows/i.test(text))
})

await browser.close()
process.exit(failures.length ? 1 : 0)
