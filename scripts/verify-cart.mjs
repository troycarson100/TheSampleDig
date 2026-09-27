#!/usr/bin/env node
// Drives the real cart drawer and checkout summary in Chromium.
//
//   npm run dev                     # in another terminal
//   node scripts/verify-cart.mjs
//
// Runs under plain node (unlike verify-plugin-pricing.mjs / the old
// verify-plugins-index.mjs, which need tsx to import lib/products.ts) - so
// every expected number here is read off the live page (a price the page
// itself advertises, or a line's own displayed price), never a literal
// copied out of lib/products.ts or lib/plugins.ts. That also means these
// checks stay meaningful if the actual prices ever change.
//
// Ownership-dependent states (an owned plugin, a dropped localStorage id) are
// deliberately out of scope here - they need a signed-in session and seeded
// Purchase rows, which do not belong in a script anyone can run cold with
// nothing but a dev server. Those are verified by hand against the local
// database; see the Task 8 report.
import { chromium } from "playwright"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

const PLUGINS = ["shft", "drft", "fltr"]
const STORAGE_KEY = "sampleroll_cart_v1"
const DIALOG = '[role="dialog"][aria-label="Your cart"]'

function dollarsIn(text) {
  return [...text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]))
}

async function readCart(page) {
  return page.evaluate((key) => {
    try { return JSON.parse(window.localStorage.getItem(key) || "[]") } catch { return null }
  }, STORAGE_KEY)
}

/** Everything the drawer is currently saying, read straight off the DOM. */
async function drawerState(page) {
  const dialog = page.locator(DIALOG)
  if ((await dialog.count()) !== 1) return { visible: false }
  const text = await dialog.innerText()
  const lineHandles = await dialog.locator('li:has(button[aria-label^="Remove "])').all()
  const items = []
  for (const li of lineHandles) {
    const liText = await li.innerText()
    const aria = await li.locator('button[aria-label^="Remove "]').getAttribute("aria-label")
    const id = PLUGINS.find((p) => aria?.includes(p)) ?? null
    // The line always shows its own price first, then its struck msrp second
    // (see CartDrawer.tsx's .linePrice wrapper) - the first $ figure in the
    // line's text is always what the line itself costs, bundle or not.
    items.push({ id, price: dollarsIn(liText)[0] ?? null })
  }
  const bundleLine = text.includes("Bundle — all three")
  // CSS uppercases the "Total" label (text-transform), so innerText comes
  // back as "TOTAL" - matched case-insensitively rather than hardcoding the
  // transformed casing.
  const totalMatch = text.match(/total\D*(\d+)/i)
  return { visible: true, text, items, bundleLine, total: totalMatch ? Number(totalMatch[1]) : null }
}

const browser = await chromium.launch()

// --- 1. A Buy button adds one item and opens the drawer --------------------
{
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await page.locator("#shft-buy button").click()
  await page.waitForTimeout(200)

  const cart = await readCart(page)
  check("Buy button: cart holds exactly [\"shft\"]", JSON.stringify(cart) === '["shft"]', JSON.stringify(cart))

  const state = await drawerState(page)
  check("Buy button: drawer opens", state.visible)
  check("Buy button: exactly one line, for shft",
    state.items?.length === 1 && state.items[0].id === "shft", JSON.stringify(state.items))
  check("Buy button: no bundle line for a single item", !state.bundleLine)
  check("Buy button: total equals that single item's own price",
    state.total !== null && state.total === state.items?.[0]?.price,
    `total=${state.total} price=${state.items?.[0]?.price}`)

  await context.close()
}

// --- 2. Rail pill adds all three; drawer's lines, bundle line and total ----
// then removing one, then emptying it out entirely (the empty state).
{
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })

  // The bundle price this run's build actually advertises - an independent
  // reading (PluginChrome renders it straight from PRICING, with no cart
  // involved) used below as the oracle for what cartTotals SHOULD produce,
  // rather than a number typed into this script by hand.
  const advertisedBundlePrice = dollarsIn(await page.locator("[data-bundle-pill]").innerText())[0]

  await page.locator("[data-bundle-pill]").click()
  await page.waitForTimeout(200)

  const cart = await readCart(page)
  check("Rail pill: cart holds all three, in PLUGIN_ORDER",
    JSON.stringify(cart) === JSON.stringify(PLUGINS), JSON.stringify(cart))

  const full = await drawerState(page)
  check("Rail pill: drawer opens", full.visible)
  check("Rail pill: all three lines present",
    full.items?.length === 3 && PLUGINS.every((p) => full.items.some((i) => i.id === p)),
    JSON.stringify(full.items))
  check("Rail pill: bundle line present", full.bundleLine)
  // The check this task's brief asks to prove can fail: total must be the
  // bundle price, not the sum of the three singles. Breaking cartTotals to
  // always return the subtotal makes this one specific check fail while
  // "bundle line present" above keeps passing (that line renders off
  // bundleApplied, a separate field) - see the Task 8 report for the
  // before/after run.
  check("Rail pill: total is the advertised bundle price, not the sum of singles",
    full.total === advertisedBundlePrice, `total=${full.total} advertised=${advertisedBundlePrice}`)
  const sumOfThree = full.items.reduce((s, i) => s + i.price, 0)
  check("Rail pill: bundle total is less than the sum of the three singles",
    full.total < sumOfThree, `total=${full.total} sum=${sumOfThree}`)

  // Remove one: the bundle line must disappear and the total must fall back
  // to the sum of what's left, not stay at the bundle price.
  await page.locator('button[aria-label="Remove fltr from your cart"]').click()
  await page.waitForTimeout(200)
  const two = await drawerState(page)
  check("Removing fltr: bundle line disappears", !two.bundleLine)
  check("Removing fltr: exactly shft and drft remain",
    two.items?.length === 2 && ["shft", "drft"].every((p) => two.items.some((i) => i.id === p)),
    JSON.stringify(two.items))
  const sumOfTwo = two.items.reduce((s, i) => s + i.price, 0)
  check("Removing fltr: total returns to the sum of the two remaining singles",
    two.total === sumOfTwo, `total=${two.total} sum=${sumOfTwo}`)

  // Empty it out completely: the drawer stays open (removing never closes
  // it) and switches to the empty state.
  await page.locator('button[aria-label="Remove shft from your cart"]').click()
  await page.waitForTimeout(150)
  await page.locator('button[aria-label="Remove drft from your cart"]').click()
  await page.waitForTimeout(200)
  const empty = await drawerState(page)
  check("Empty cart: drawer stays open", empty.visible)
  check("Empty cart: no lines and no bundle line", empty.items?.length === 0 && !empty.bundleLine)
  check("Empty cart: shows the empty-cart copy",
    empty.text.includes("Your cart is where plugins wait until you check out."))
  check("Empty cart: \"Browse plugins\" points at /shft",
    (await page.locator(`${DIALOG} a[href="/shft"]`).count()) >= 1)

  await context.close()
}

// --- 3. Persistence across a reload -----------------------------------------
{
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await page.locator("#shft-buy button").click()
  await page.waitForTimeout(200)
  await page.goto(BASE + "/drft", { waitUntil: "networkidle" })
  await page.locator("#drft-buy button").click()
  await page.waitForTimeout(200)
  const before = await drawerState(page)

  await page.locator(`${DIALOG} button[aria-label="Close cart"]`).click()
  await page.waitForTimeout(150)
  await page.reload({ waitUntil: "networkidle" })

  const cartAfterReload = await readCart(page)
  check("Persistence: localStorage still holds both ids after a reload",
    Array.isArray(cartAfterReload) && cartAfterReload.length === 2 &&
    ["shft", "drft"].every((p) => cartAfterReload.includes(p)),
    JSON.stringify(cartAfterReload))
  check("Persistence: drawer starts closed after a reload (no open() call yet)",
    (await page.locator(DIALOG).count()) === 0)

  // Reopen without mutating the cart: clicking the already-in-it drft Buy
  // button again is a no-op add (see lib/use-cart.ts's `add`) that still
  // opens the drawer, so this reads back exactly what survived the reload.
  await page.locator("#drft-buy button").click()
  await page.waitForTimeout(200)
  const after = await drawerState(page)
  check("Persistence: reopened drawer shows the same two lines and total as before the reload",
    after.items?.length === 2 && after.total === before.total &&
    ["shft", "drft"].every((p) => after.items.some((i) => i.id === p)),
    JSON.stringify({ before: before.items, beforeTotal: before.total, after: after.items, afterTotal: after.total }))

  await context.close()
}

// --- 4. Focus trap, Escape closes it, focus returns to the opener ----------
{
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  const opener = page.locator("#shft-buy button")
  await opener.click()
  await page.waitForTimeout(200)
  check("Escape scenario: drawer is open to begin with", (await page.locator(DIALOG).count()) === 1)

  const closeBtn = page.locator(`${DIALOG} button[aria-label="Close cart"]`)
  check("Focus: opening the drawer moves focus to its close button",
    await closeBtn.evaluate((el) => el === document.activeElement))

  // Not on the brief's required list, but CartDrawer.tsx explicitly implements
  // a Tab trap, and it is cheap to actually prove rather than assume: from the
  // first focusable control, Shift+Tab must land on the LAST one inside the
  // dialog, not stay put and not escape it. `inert` on the rest of <body>
  // would not by itself produce this - only the trap's own wrap-around does.
  const lastFocusable = page.locator(`${DIALOG} a[href], ${DIALOG} button:not([disabled])`).last()
  await page.keyboard.press("Shift+Tab")
  check("Focus trap: Shift+Tab from the first control wraps to the last one",
    await lastFocusable.evaluate((el) => el === document.activeElement))

  await page.keyboard.press("Escape")
  await page.waitForTimeout(200)
  check("Escape: closes the drawer", (await page.locator(DIALOG).count()) === 0)
  check("Escape: focus returns to whatever opened it",
    await opener.evaluate((el) => el === document.activeElement))

  await context.close()
}

// --- 5. Checkout page's summary matches the drawer --------------------------
{
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await page.locator("[data-bundle-pill]").click()
  await page.waitForTimeout(200)
  const drawer = await drawerState(page)

  await page.goto(BASE + "/checkout", { waitUntil: "networkidle" })
  const summary = page.locator('aside[aria-labelledby="checkout-summary-title"]')
  check("Checkout: order summary is present", (await summary.count()) === 1)
  const summaryText = await summary.innerText()

  check("Checkout summary: lists all three plugins, matching the drawer",
    PLUGINS.every((p) => summaryText.includes(p)))
  check("Checkout summary: bundle line presence matches the drawer",
    summaryText.includes("Bundle — all three") === drawer.bundleLine)
  const dueMatch = summaryText.match(/amount due\D*(\d+)/i)
  const due = dueMatch ? Number(dueMatch[1]) : null
  check("Checkout summary: amount due matches the drawer's total",
    due !== null && due === drawer.total, `due=${due} drawer total=${drawer.total}`)

  await context.close()
}

await browser.close()
process.exit(failures.length ? 1 : 0)
