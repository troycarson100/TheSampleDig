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

// ===========================================================================
// Promo codes
//
// What a code is worth is Stripe's answer, and this script cannot count on any
// particular code existing in whatever Stripe account the dev server points
// at. So the sections that need a *good* code stub /api/cart/promo's reply and
// test everything the site does with it; the section that needs a *bad* code
// uses the real route, since "no such code" is true of every account. The
// arithmetic itself is unit-tested in lib/cart-promo.test.ts.
// ===========================================================================
const PROMO_KEY = "sampleroll_cart_promo_v1"
const TWENTY_OFF = { code: "SAVE20", percentOff: 20, amountOffCents: null, minimumCents: null, restricted: false }

/** "$47.20" / "$59" / "−$11.80" -> cents, or null when there is no figure. */
function centsIn(text) {
  const m = text.match(/\$(\d+)(?:\.(\d{2}))?/)
  return m ? Number(m[1]) * 100 + Number(m[2] ?? 0) : null
}

/** Answers /api/cart/promo with `offer`, recording what was asked. */
async function stubPromo(page, offer, asked = []) {
  await page.route("**/api/cart/promo", async (route) => {
    asked.push(route.request().postDataJSON())
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ offer }) })
  })
  return asked
}

async function storedPromo(page) {
  return page.evaluate((key) => {
    try { return JSON.parse(window.localStorage.getItem(key) || "null") } catch { return "unreadable" }
  }, PROMO_KEY)
}

const focusIsOn = (locator) => locator.evaluate((el) => el === document.activeElement)

// --- 6. A code applied in the drawer ---------------------------------------
{
  const context = await browser.newContext()
  const page = await context.newPage()
  const asked = await stubPromo(page, TWENTY_OFF)
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  const bundleCents = dollarsIn(await page.locator("[data-bundle-pill]").innerText())[0] * 100
  await page.locator("[data-bundle-pill]").click()
  await page.waitForTimeout(200)

  const dialog = page.locator(DIALOG)
  const promo = dialog.locator("[data-promo]")
  check("Promo: the box is closed until it is asked for",
    (await promo.getAttribute("data-promo")) === "closed" && (await dialog.locator("input").count()) === 0)

  await dialog.getByRole("button", { name: "Have a promo code?" }).click()
  const input = dialog.locator('input[name="promoCode"]')
  check("Promo: opening the box puts the cursor in it", await focusIsOn(input))

  // Typed the way a pasted code arrives: wrong case, stray space.
  await input.fill("  save20 ")
  await input.press("Enter")
  await dialog.locator('[data-promo="applied"]').waitFor({ timeout: 5000 }).catch(() => {})

  check("Promo: Enter asks about the code, trimmed, and sends nothing else",
    asked.length === 1 && JSON.stringify(asked[0]) === '{"code":"save20"}', JSON.stringify(asked))
  const applied = await promo.innerText()
  check("Promo: the applied line shows the code as Stripe has it, and what it is worth",
    (await promo.getAttribute("data-promo")) === "applied" && applied.includes("SAVE20") && applied.includes("20% off"), applied)

  const expectedOff = Math.round(bundleCents * 0.2)
  const worth = centsIn(await promo.locator("[data-promo-worth]").innerText())
  check("Promo: it takes 20% off the bundle price", worth === expectedOff, `took ${worth}, expected ${expectedOff}`)
  const total = centsIn(await dialog.locator("[data-cart-total]").innerText())
  check("Promo: the drawer's total is the bundle price less the discount",
    total === bundleCents - expectedOff, `total ${total}, expected ${bundleCents - expectedOff}`)

  const remove = dialog.getByRole("button", { name: "Remove promo code SAVE20" })
  check("Promo: focus lands on Remove, inside the dialog, not on nothing", await focusIsOn(remove))
  check("Promo: Checkout is still the last control in the drawer",
    (await dialog.locator("a[href], button:not([disabled]), input").last().getAttribute("href")) === "/checkout")
  check("Promo: the code is kept with the cart", (await storedPromo(page))?.code === "SAVE20", JSON.stringify(await storedPromo(page)))

  await remove.click()
  await page.waitForTimeout(150)
  check("Removing the code: the total goes back to the bundle price",
    centsIn(await dialog.locator("[data-cart-total]").innerText()) === bundleCents)
  check("Removing the code: the box closes again, with focus on its link",
    (await promo.getAttribute("data-promo")) === "closed" &&
    await focusIsOn(dialog.getByRole("button", { name: "Have a promo code?" })))
  check("Removing the code: nothing is left in storage", (await storedPromo(page)) === null, JSON.stringify(await storedPromo(page)))

  await context.close()
}

// --- 7. The same code at checkout, and a code that has stopped working ------
{
  const context = await browser.newContext()
  const page = await context.newPage()
  await stubPromo(page, TWENTY_OFF)
  // Nobody owns anything here: keeps this section off the local database.
  await page.route("**/api/cart/owned", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ owned: [] }) }))
  const sent = []
  await page.route("**/api/cart/checkout", async (route) => {
    sent.push(route.request().postDataJSON())
    await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ reason: "promo_invalid" }) })
  })

  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  const bundleCents = dollarsIn(await page.locator("[data-bundle-pill]").innerText())[0] * 100
  const discounted = bundleCents - Math.round(bundleCents * 0.2)
  await page.locator("[data-bundle-pill]").click()
  await page.waitForTimeout(200)
  const dialog = page.locator(DIALOG)
  await dialog.getByRole("button", { name: "Have a promo code?" }).click()
  await dialog.locator('input[name="promoCode"]').fill("SAVE20")
  await dialog.getByRole("button", { name: "Apply" }).click()
  await dialog.locator('[data-promo="applied"]').waitFor({ timeout: 5000 }).catch(() => {})

  // A full page load, not a client-side navigation: the code has to come back
  // out of storage, which is also what a reload or a return visit does.
  await page.goto(BASE + "/checkout", { waitUntil: "networkidle" })
  const summary = page.locator('aside[aria-labelledby="checkout-summary-title"]')
  const promo = summary.locator("[data-promo]")
  check("Checkout: a code applied in the drawer is already applied here",
    (await promo.getAttribute("data-promo")) === "applied" && (await promo.innerText()).includes("SAVE20"))
  check("Checkout: amount due is the discounted total",
    centsIn(await summary.locator("[data-amount-due]").innerText()) === discounted,
    `${await summary.locator("[data-amount-due]").innerText()} vs ${discounted}`)
  const submit = page.locator('form button[type="submit"]').filter({ hasText: "Continue to payment" })
  check("Checkout: the button names the same discounted total",
    centsIn(await submit.innerText()) === discounted, await submit.innerText())
  check("Checkout: arriving with a code does not move focus onto it",
    !(await focusIsOn(summary.getByRole("button", { name: "Remove promo code SAVE20" }))))

  await page.locator("#checkout-email").fill("promo-check@example.com")
  await page.locator("#checkout-confirm-email").fill("promo-check@example.com")
  await submit.click()
  await page.locator('[role="alert"]').filter({ hasText: "promo code" }).waitFor({ timeout: 5000 }).catch(() => {})

  check("Checkout: the order is sent with the code, and nothing about what it is worth",
    sent.length === 1 && sent[0].promoCode === "SAVE20" &&
    !Object.keys(sent[0]).some((k) => !["ids", "email", "promoCode"].includes(k)),
    JSON.stringify(sent))
  check("Refused code: the buyer is told, in words",
    (await page.locator('[role="alert"]').filter({ hasText: "promo code" }).count()) === 1)
  check("Refused code: it comes off the order",
    (await promo.getAttribute("data-promo")) === "closed" && (await storedPromo(page)) === null)
  check("Refused code: amount due and the button go back to the full total",
    centsIn(await summary.locator("[data-amount-due]").innerText()) === bundleCents &&
    centsIn(await submit.innerText()) === bundleCents,
    `${await summary.locator("[data-amount-due]").innerText()} / ${await submit.innerText()}`)
  check("Refused code: the buyer is still on the checkout page", page.url() === BASE + "/checkout", page.url())

  // Second attempt, now without a code: nothing about one may be sent.
  await submit.click()
  await page.waitForTimeout(400)
  check("Checkout: an order with no code sends no promoCode at all",
    sent.length === 2 && !("promoCode" in sent[1]), JSON.stringify(sent[1]))

  await context.close()
}

// --- 8. A code that does not exist, against the real route ------------------
{
  const context = await browser.newContext()
  const page = await context.newPage()
  const lookups = []
  page.on("request", (r) => { if (r.url().includes("/api/cart/promo")) lookups.push(r.postDataJSON()) })
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await page.locator("#shft-buy button").click()
  await page.waitForTimeout(200)
  const dialog = page.locator(DIALOG)
  const before = centsIn(await dialog.locator("[data-cart-total]").innerText())
  await dialog.getByRole("button", { name: "Have a promo code?" }).click()
  const input = dialog.locator('input[name="promoCode"]')

  await input.fill("ZZNOTACODE9")
  await dialog.getByRole("button", { name: "Apply" }).click()
  const alert = dialog.locator('[role="alert"]')
  await alert.waitFor({ timeout: 10000 }).catch(() => {})
  // Read through a guard, not straight off the locator: if the code was
  // wrongly accepted there is no alert and no box, and an unguarded read
  // would end the run on a timeout instead of on the checks below that say
  // what went wrong.
  const said = async () => ((await alert.count()) ? alert.innerText() : "")
  check("Unknown code: the server is asked", lookups.length === 1, JSON.stringify(lookups))
  check("Unknown code: says it isn't valid, and marks the box",
    (await said()).includes("isn't valid") &&
    (await input.count()) === 1 && (await input.getAttribute("aria-invalid")) === "true")
  check("Unknown code: the total does not change",
    centsIn(await dialog.locator("[data-cart-total]").innerText()) === before)
  check("Unknown code: nothing is stored", (await storedPromo(page)) === null)
  check("Unknown code: the cursor is back in the box, to try again",
    (await input.count()) === 1 && await focusIsOn(input))

  // Not a code at all: refused on the page, without spending one of the ten
  // lookups a minute the server allows.
  if ((await input.count()) === 1) {
    await input.fill("50% off!")
    await dialog.getByRole("button", { name: "Apply" }).click()
    await page.waitForTimeout(400)
  }
  check("Not a code: refused without asking the server", lookups.length === 1, JSON.stringify(lookups))
  check("Not a code: still says it isn't valid", (await said()).includes("isn't valid"))

  await context.close()
}

// --- 9. A code belongs to an order, not to the visitor ----------------------
{
  const context = await browser.newContext()
  const page = await context.newPage()
  // Twenty off, but only on orders bigger than any single plugin.
  await stubPromo(page, { ...TWENTY_OFF, minimumCents: 100000 })
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await page.locator("#shft-buy button").click()
  await page.waitForTimeout(200)
  const dialog = page.locator(DIALOG)
  const before = centsIn(await dialog.locator("[data-cart-total]").innerText())
  await dialog.getByRole("button", { name: "Have a promo code?" }).click()
  await dialog.locator('input[name="promoCode"]').fill("SAVE20")
  await dialog.getByRole("button", { name: "Apply" }).click()
  await dialog.locator('[data-promo="applied"]').waitFor({ timeout: 5000 }).catch(() => {})

  const promo = dialog.locator("[data-promo]")
  check("Order under the code's minimum: says what the minimum is",
    (await promo.innerText()).includes("$1000"), await promo.innerText())
  check("Order under the code's minimum: takes nothing off",
    centsIn(await dialog.locator("[data-cart-total]").innerText()) === before &&
    (await promo.locator("[data-promo-worth]").count()) === 0)

  // Empty the cart, then start another order.
  await page.locator('button[aria-label="Remove shft from your cart"]').click()
  await page.waitForTimeout(200)
  check("Emptied cart: the code goes with the order", (await storedPromo(page)) === null, JSON.stringify(await storedPromo(page)))
  await dialog.locator('button[aria-label="Close cart"]').click()
  await page.waitForTimeout(150)
  await page.locator("#shft-buy button").click()
  await page.waitForTimeout(200)
  check("Next order: starts with no code on it",
    (await page.locator(`${DIALOG} [data-promo]`).getAttribute("data-promo")) === "closed")

  await context.close()
}

// ===========================================================================
// What was taken out, offered back
//
// Ownership is stubbed in every section here: /api/plugins/ownership answers
// for whoever is signed in, and the local database's rows are not this
// script's to depend on (or to touch). The arithmetic is unit-tested in
// lib/cart-suggestions.test.ts; this is what the drawer does with it.
// ===========================================================================
const OFFER = `${DIALOG} [data-cart-offer]`

/** Answers /api/plugins/ownership: `owned` is the ids the visitor owns, or
    "error" for a request that fails. */
async function stubOwnership(page, owned) {
  await page.route("**/api/plugins/ownership", (route) => owned === "error"
    ? route.fulfill({ status: 500, body: "" })
    : route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ signedIn: owned.length > 0, owned: Object.fromEntries(PLUGINS.map((p) => [p, owned.includes(p)])) }),
      }))
}

/** What the offer under the cart says: the plugins in it, what each would
    add, and the bundle card, if there is one. */
async function offerState(page) {
  const offer = page.locator(OFFER)
  if ((await offer.count()) === 0) return { shown: false, items: [], bundle: null }
  const items = []
  for (const li of await offer.locator("[data-cart-offer-item]").all()) {
    const text = await li.innerText()
    items.push({ id: await li.getAttribute("data-cart-offer-item"), text, figures: dollarsIn(text) })
  }
  const card = offer.locator("[data-cart-offer-bundle]")
  const bundle = (await card.count()) ? { text: await card.innerText(), figures: dollarsIn(await card.innerText()) } : null
  return { shown: true, items, bundle }
}

// --- 10. Taking one out of all three ----------------------------------------
{
  const context = await browser.newContext()
  const page = await context.newPage()
  await stubOwnership(page, [])
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  const bundlePrice = dollarsIn(await page.locator("[data-bundle-pill]").innerText())[0]
  await page.locator("[data-bundle-pill]").click()
  await page.waitForTimeout(200)

  let o = await offerState(page)
  check("Offer: nothing is offered while nothing has been taken out", !o.shown)

  await page.locator('button[aria-label="Remove fltr from your cart"]').click()
  await page.waitForTimeout(200)
  const two = await drawerState(page)
  o = await offerState(page)
  check("Offer: fltr is offered back once it is taken out", o.shown && o.items.map((i) => i.id).join() === "fltr", JSON.stringify(o.items))
  const fltr = o.items[0]
  const sumOfTwo = two.items.reduce((s, i) => s + i.price, 0)
  check("Offer: it says it completes the bundle", /completes the bundle/i.test(fltr?.text ?? ""), fltr?.text)
  check("Offer: and costs only what takes the order to the bundle price",
    fltr?.figures[0] === bundlePrice - sumOfTwo, `${fltr?.figures.join(", ")} (bundle ${bundlePrice}, cart ${sumOfTwo})`)
  check("Offer: with its own price struck beside it", fltr?.figures[1] > fltr?.figures[0], fltr?.figures.join(", "))
  check("Offer: one missing, so no second bundle card", o.bundle === null)
  check("Offer: the cart's own figure is untouched by it", two.total === sumOfTwo, `total ${two.total}, lines ${sumOfTwo}`)

  await page.locator(`${OFFER} button[aria-label="Add fltr to your cart"]`).click()
  await page.waitForTimeout(200)
  const back = await drawerState(page)
  check("Offer: adding it back keeps the drawer open", back.visible)
  check("Offer: adding it back puts all three in the cart, at the bundle price",
    back.items.length === 3 && back.bundleLine && back.total === bundlePrice, `${back.items.length} lines, total ${back.total}`)
  check("Offer: and it is no longer offered", !(await offerState(page)).shown)
  check("Offer: the cart in storage has it too", JSON.stringify(await readCart(page)) === JSON.stringify(PLUGINS))
  await context.close()
}

// --- 11. Taking two out, then all of them -------------------------------------
{
  const context = await browser.newContext()
  const page = await context.newPage()
  await stubOwnership(page, [])
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  const bundlePrice = dollarsIn(await page.locator("[data-bundle-pill]").innerText())[0]
  await page.locator("[data-bundle-pill]").click()
  await page.waitForTimeout(200)
  const prices = Object.fromEntries((await drawerState(page)).items.map((i) => [i.id, i.price]))

  for (const id of ["fltr", "drft"]) {
    await page.locator(`button[aria-label="Remove ${id} from your cart"]`).click()
    await page.waitForTimeout(150)
  }
  let o = await offerState(page)
  check("Two out: both are offered, in the range's order", o.items.map((i) => i.id).join() === "drft,fltr", o.items.map((i) => i.id).join())
  check("Two out: each at its own price", o.items.every((i) => i.figures[0] === prices[i.id] && !/completes/i.test(i.text)),
    o.items.map((i) => i.text.replace(/\s+/g, " ")).join(" | "))
  const extra = bundlePrice - prices.shft
  const saving = prices.drft + prices.fltr - extra
  check("Two out: the bundle is offered", o.bundle !== null)
  check("Two out: at its price, what it adds to the cart, and what it saves",
    o.bundle?.figures.join() === [bundlePrice, extra, saving].join(), `${o.bundle?.text.replace(/\s+/g, " ")} (want ${bundlePrice}, ${extra}, ${saving})`)

  await page.locator(`${OFFER} [data-cart-offer-bundle] button`).click()
  await page.waitForTimeout(200)
  const all = await drawerState(page)
  check("Two out: the bundle's button puts all three back", all.items.length === 3 && all.total === bundlePrice, `${all.items.length}, ${all.total}`)
  check("Two out: and the offer is gone", !(await offerState(page)).shown)

  for (const id of PLUGINS) {
    await page.locator(`button[aria-label="Remove ${id} from your cart"]`).click()
    await page.waitForTimeout(150)
  }
  const empty = await drawerState(page)
  o = await offerState(page)
  check("All out: the empty cart still says it is empty", empty.text.includes("Your cart is where plugins wait until you check out."))
  check("All out: and offers all three back, and the bundle", o.items.length === 3 && o.bundle?.figures[0] === bundlePrice,
    `${o.items.length} items, bundle ${o.bundle?.figures.join(", ")}`)
  check("All out: nothing in the offer is mistaken for a cart line", empty.items.length === 0)
  await context.close()
}

// --- 12. Never offering what someone owns, or might --------------------------
{
  // Owns drft: it is never offered, and the bundle - which could never apply
  // to them - is not mentioned.
  const context = await browser.newContext()
  const page = await context.newPage()
  await stubOwnership(page, ["drft"])
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await page.locator("#shft-buy button").click()
  await page.waitForTimeout(200)
  // drft is in the stored cart too: ownership drops it, which is not the
  // visitor taking it out, and must not turn it into an offer.
  await page.evaluate(() => { window.localStorage.setItem("sampleroll_cart_v1", JSON.stringify(["shft", "drft", "fltr"])) })
  await page.reload({ waitUntil: "networkidle" })
  await page.locator("[data-cart-button]").click()
  await page.waitForTimeout(200)
  check("Owns drft: ownership takes it out of the cart", !(await drawerState(page)).items.some((i) => i.id === "drft"))
  await page.locator('button[aria-label="Remove fltr from your cart"]').click()
  await page.waitForTimeout(200)
  const o = await offerState(page)
  const one = await drawerState(page)
  check("Owns drft: fltr is offered back at its own price", o.items.map((i) => i.id).join() === "fltr" && !/completes/i.test(o.items[0]?.text ?? ""),
    o.items.map((i) => i.text.replace(/\s+/g, " ")).join(" | "))
  check("Owns drft: drft is never offered, though it was in the cart", !o.items.some((i) => i.id === "drft"), o.items.map((i) => i.id).join())
  check("Owns drft: the bundle is not mentioned", o.bundle === null && !/bundle|all three/i.test(one.text), one.text.replace(/\s+/g, " "))
  await context.close()
}
{
  // Ownership unknown: nothing is offered at all, even what was just taken out.
  const context = await browser.newContext()
  const page = await context.newPage()
  await stubOwnership(page, "error")
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await page.evaluate(() => { window.localStorage.setItem("sampleroll_cart_v1", JSON.stringify(["shft", "fltr"])) })
  await page.reload({ waitUntil: "networkidle" })
  await page.locator("[data-cart-button]").click()
  await page.waitForTimeout(200)
  await page.locator('button[aria-label="Remove fltr from your cart"]').click()
  await page.waitForTimeout(200)
  check("Ownership unknown: nothing is offered", !(await offerState(page)).shown)
  await context.close()
}

// ===========================================================================
// A member's own code, applied without being typed
//
// The code comes from the account (/api/cart/offer, stubbed as a signed-in
// member's answer) or from the link in the offer email (?promo=). What Stripe
// makes of it is /api/cart/promo, stubbed as before. The code's own rules -
// who gets one, what it is worth, when it runs out - are unit-tested in
// lib/member-offer-logic.test.ts.
// ===========================================================================
const MEMBER_KEY = "sampleroll_member_code_v1"
const TEN_OFF = (code) => ({ code, percentOff: null, amountOffCents: 1000, minimumCents: null, restricted: false })
const LATER = () => new Date(Date.now() + 20 * 86_400_000).toISOString()

/** Answers /api/cart/offer as a signed-in member with `code`, or as anyone else. */
async function stubMemberOffer(page, code) {
  await page.route("**/api/cart/offer", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ offer: code ? { code, expiresAt: LATER() } : null }),
  }))
}

/** Answers /api/cart/promo: the codes in `good` are $10 off, anything else is
    not a code. Records what was asked. */
async function stubPromoCodes(page, good, asked = []) {
  await page.route("**/api/cart/promo", async (route) => {
    const { code } = route.request().postDataJSON()
    asked.push(code)
    if (good.includes(code)) await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ offer: TEN_OFF(code) }) })
    else await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ reason: "not_valid" }) })
  })
  return asked
}

async function promoState(page) {
  const promo = page.locator(`${DIALOG} [data-promo]`)
  if ((await promo.count()) === 0) return { state: "none", text: "" }
  return { state: await promo.getAttribute("data-promo"), text: (await promo.innerText()).replace(/\s+/g, " ") }
}

/** One section on a context of its own. Something that cannot be done at all -
    a button that is not there - fails the section and the run goes on, rather
    than ending it and leaving every later check unreported. */
async function section(label, body) {
  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  try { await body(page) } catch (e) { check(`${label}: ran to the end`, false, String(e?.message ?? e).split("\n")[0]) }
  finally { await context.close() }
}

// --- 13. Signed in: the code goes on when something goes in the cart --------
await section("Member, signed in", async (page) => {
  await stubOwnership(page, [])
  await stubMemberOffer(page, "SR10ABC234")
  const asked = await stubPromoCodes(page, ["SR10ABC234"])
  await page.goto(BASE + "/fltr", { waitUntil: "networkidle" })
  check("Member, signed in: nothing is asked about while the cart is empty", asked.length === 0, asked.join())

  await page.locator("#fltr-buy button").click()
  await page.locator(`${DIALOG} [data-promo="applied"]`).waitFor({ timeout: 5000 }).catch(() => {})
  let p = await promoState(page)
  const fltr = (await drawerState(page)).items.find((i) => i.id === "fltr")
  check("Member, signed in: adding fltr puts their code on the order by itself", p.state === "applied" && p.text.includes("SR10ABC234"), p.text)
  check("Member, signed in: it says it was applied for them", /applied for you/i.test(p.text), p.text)
  check("Member, signed in: and the order is $10 less",
    centsIn(await page.locator(`${DIALOG} [data-cart-total]`).innerText()) === fltr.price * 100 - 1000,
    `${await page.locator(`${DIALOG} [data-cart-total]`).innerText()} for a $${fltr.price} fltr`)

  // Taken off by hand: it stays off for this order.
  await page.locator(`${DIALOG} button[aria-label="Remove promo code SR10ABC234"]`).click()
  await page.waitForTimeout(400)
  await page.locator(`${DIALOG} button[aria-label="Close cart"]`).click()
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await page.locator("#shft-buy button").click()
  await page.waitForTimeout(800)
  p = await promoState(page)
  check("Member, signed in: a code taken off stays off for the rest of that order", p.state === "closed", p.text)

  // A new order gets it back.
  for (const id of ["fltr", "shft"]) {
    await page.locator(`button[aria-label="Remove ${id} from your cart"]`).click()
    await page.waitForTimeout(150)
  }
  await page.locator(`${DIALOG} button[aria-label="Close cart"]`).click()
  await page.locator("#shft-buy button").click()
  await page.locator(`${DIALOG} [data-promo="applied"]`).waitFor({ timeout: 5000 }).catch(() => {})
  p = await promoState(page)
  check("Member, signed in: the next order gets it back - on any plugin, not only fltr", p.state === "applied" && p.text.includes("SR10ABC234"), p.text)

  await page.goto(BASE + "/checkout", { waitUntil: "networkidle" })
  const summary = await page.locator('[data-promo]').first()
  check("Member, signed in: and checkout shows it applied too",
    (await summary.getAttribute("data-promo")) === "applied" && (await summary.innerText()).includes("SR10ABC234"))
})

// --- 14. Following the link in the email ------------------------------------
await section("From the email", async (page) => {
  await stubOwnership(page, [])
  await stubMemberOffer(page, null)
  await stubPromoCodes(page, ["SR10LNK234"])
  await page.goto(BASE + "/fltr?promo=SR10LNK234&utm_source=email", { waitUntil: "networkidle" })
  const url = new URL(page.url())
  check("From the email: the code is taken out of the address", !url.searchParams.has("promo"), page.url())
  check("From the email: and nothing else in it is", url.searchParams.get("utm_source") === "email" && url.pathname === "/fltr", page.url())
  const stored = await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) || "null"), MEMBER_KEY)
  check("From the email: the code is remembered for this visitor", stored?.code === "SR10LNK234", JSON.stringify(stored))

  await page.locator("#fltr-buy button").click()
  await page.locator(`${DIALOG} [data-promo="applied"]`).waitFor({ timeout: 5000 }).catch(() => {})
  const p = await promoState(page)
  check("From the email: without signing in, it goes on the order by itself", p.state === "applied" && p.text.includes("SR10LNK234"), p.text)

  // Still there on a later visit.
  await page.goto(BASE + "/drft", { waitUntil: "networkidle" })
  await page.locator("[data-cart-button]").click()
  await page.waitForTimeout(300)
  check("From the email: still on the order on another page", (await promoState(page)).text.includes("SR10LNK234"))
})

// --- 15. A code Stripe refuses (used, or expired) ----------------------------
await section("Refused code", async (page) => {
  await stubOwnership(page, [])
  await stubMemberOffer(page, "SR10USED23")
  const asked = await stubPromoCodes(page, [])
  await page.goto(BASE + "/fltr", { waitUntil: "networkidle" })
  await page.locator("#fltr-buy button").click()
  await page.waitForTimeout(1200)
  const p = await promoState(page)
  check("Refused code: nothing goes on the order", p.state === "closed", p.text)
  check("Refused code: and no error is shown for a code nobody typed", !/isn.t valid/i.test(p.text), p.text)
  check("Refused code: it is asked about once, not over and over", asked.filter((c) => c === "SR10USED23").length === 1, asked.join())
})

// --- 16. A code that could not be asked about ---------------------------------
// Stripe down, or too many tries: not a refusal, so the code is kept for
// later - but not asked about again on every change to the cart.
await section("Unanswered code", async (page) => {
  await stubOwnership(page, [])
  await stubMemberOffer(page, "SR10WAIT23")
  const asked = []
  await page.route("**/api/cart/promo", async (route) => {
    asked.push(route.request().postDataJSON().code)
    await route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
  })
  await page.goto(BASE + "/fltr", { waitUntil: "networkidle" })
  await page.locator("#fltr-buy button").click()
  await page.waitForTimeout(800)
  await page.locator(`${DIALOG} button[aria-label="Close cart"]`).click()
  await page.locator("[data-bundle-pill]").click()
  await page.waitForTimeout(1000)
  check("Unanswered code: nothing goes on the order", (await promoState(page)).state === "closed")
  check("Unanswered code: it is not asked about again each time the cart changes", asked.length === 1, asked.join())
  const kept = await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) || "null"), MEMBER_KEY)
  check("Unanswered code: and it is kept for another visit", kept?.code === "SR10WAIT23", JSON.stringify(kept))
})

// --- 17. An empty cart suggests where to start ------------------------------
await section("Empty cart, owns nothing", async (page) => {
  await stubOwnership(page, [])
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  const bundlePrice = dollarsIn(await page.locator("[data-bundle-pill]").innerText())[0]
  await page.locator("[data-cart-button]").click()
  await page.locator(OFFER).waitFor({ timeout: 5000 }).catch(() => {})
  const o = await offerState(page)
  const text = (await page.locator(DIALOG).innerText()).replace(/\s+/g, " ")
  check("Empty cart, owns nothing: every plugin is suggested, in the range's order", o.items.map((i) => i.id).join() === PLUGINS.join(), o.items.map((i) => i.id).join())
  check("Empty cart, owns nothing: and the bundle", o.bundle?.figures[0] === bundlePrice, o.bundle?.text)
  check("Empty cart, owns nothing: headed as a place to start", /start with one of these/i.test(text), text)
  const below = await page.locator(DIALOG).evaluate((d) => {
    const link = [...d.querySelectorAll("a")].find((a) => /browse plugins/i.test(a.textContent ?? ""))
    const offer = d.querySelector("[data-cart-offer]")
    return link && offer ? offer.getBoundingClientRect().top >= link.getBoundingClientRect().bottom : false
  })
  check("Empty cart, owns nothing: the suggestions sit under Browse plugins", below)

  await page.locator(`${OFFER} button[aria-label="Add drft to your cart"]`).click()
  await page.waitForTimeout(250)
  const after = await drawerState(page)
  check("Empty cart, owns nothing: adding one puts it in the cart, and the drawer stays open",
    after.visible && after.items.map((i) => i.id).join() === "drft", JSON.stringify(after.items))
})

await section("Empty cart, owns drft", async (page) => {
  await stubOwnership(page, ["drft"])
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await page.locator("[data-cart-button]").click()
  await page.locator(OFFER).waitFor({ timeout: 5000 }).catch(() => {})
  const o = await offerState(page)
  check("Empty cart, owns drft: only what they don't own is suggested", o.items.map((i) => i.id).join() === "shft,fltr", o.items.map((i) => i.id).join())
  check("Empty cart, owns drft: and no bundle", o.bundle === null)
})

await section("Empty cart, owns everything", async (page) => {
  await stubOwnership(page, [...PLUGINS])
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await page.locator("[data-cart-button]").click()
  await page.waitForTimeout(800)
  check("Empty cart, owns everything: nothing is suggested", !(await offerState(page)).shown)
})

await section("Empty cart, ownership unknown", async (page) => {
  await stubOwnership(page, "error")
  await page.goto(BASE + "/shft", { waitUntil: "networkidle" })
  await page.locator("[data-cart-button]").click()
  await page.waitForTimeout(800)
  check("Empty cart, ownership unknown: nothing is suggested", !(await offerState(page)).shown)
})

await browser.close()
process.exit(failures.length ? 1 : 0)
