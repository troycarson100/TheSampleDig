# Cart and Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the bundle a home in a slide-out cart, and identify the buyer before Stripe so a returning customer cannot be charged for plugins they already own.

**Architecture:** One pure function owns the pricing rule. A client hook owns cart state and refuses to hold anything the visitor owns. A drawer renders it, a checkout page identifies the buyer, and one API route re-checks ownership server-side before building a multi-line-item Stripe session. The grant path gains the ability to grant an arbitrary set.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, CSS Modules, Prisma, Stripe, `node:test` via `npx tsx --test`, Playwright as plain Node scripts.

**Spec:** `docs/superpowers/specs/2026-09-26-cart-and-checkout-design.md`

**Branch:** `feat/plugin-pages-redesign` (already checked out)

---

## Global Constraints

### Values — copy exactly

- `PRICING`: shft `{29, 49}`, drft `{29, 49}`, fltr `{19, 49}`, bundle `{price: 59, compareAt: 147}`.
- The bundle price applies **only** when every plugin in `PLUGIN_ORDER` is in the cart. There is no two-item price.
- Cart items have **no quantities** — you cannot own two of a plugin. The cart is a set.
- `bundleApplied` derives from `PLUGIN_ORDER.length`, never a literal `3`.
- No price literal in JSX or metadata; every figure reads from `PRICING`.

### The rule that governs everything

**Never offer or sell someone what they already own, and never act on unknown ownership.**
`usePluginOwnership()` returns `{ loading, signedIn, owned, ownedCount, missing, error }`.
While `loading || error`, the cart drops nothing and no purchase control renders. The server
re-checks ownership independently — **the client's cart is never trusted.**

### What already exists — do not rebuild it

`lib/plugin-purchase-grant.ts` already finds-or-creates a user for a buyer with no account,
stamps `emailVerified` at creation (the password is random bytes, so the only way in is a
link to that address), leaves `passwordSetAt` null so the receipt offers "set a password"
via `lib/set-password.ts`, and `/api/plugins/claim` lets `/thanks` show keys using the Stripe
session id as the credential.

**This plan adds no account-creation path and changes nothing about verification.** Buying
without an account still works exactly as it does today. What is added is identity *before*
payment instead of after.

### Traps this codebase has actually hit

- `app/globals.css:44` sets `body { font-family: IBM Plex Mono }` **sitewide**. Any component
  wanting sans must declare it on its own wrapper.
- A sitewide `.theme-vinyl nav a` rule reaches into any `<nav>`; `.theme-vinyl` is on `<body>`.
- **Enumerate every `styles.X` against every `.X {`, both directions, before finishing any
  task that touches a stylesheet.** Six rounds across this branch shipped `undefined` class
  names because someone spot-checked instead of enumerating.
- Lint baseline on this branch is **298** problems, all inherited from `main`. A return to
  297 is suspicious, not an improvement.

### Verification convention

- Unit: `npx tsx --test lib/<name>.test.ts`, `node:test` + `node:assert/strict`, matching the
  17 existing suites. There is no `test` script. Current total: **151**.
- Browser: plain Node + Playwright following `scripts/verify-plugin-chrome.mjs`, with a
  `check(label, condition, detail)` helper and `process.exit(failures.length ? 1 : 0)`.
- Scripts importing a `.ts` module need `NODE_OPTIONS=--experimental-strip-types node …` or `npx tsx …`.

### Definition of done for every task

`npx tsc --noEmit` clean, `npm run build` exit 0, lint showing nothing new, and the checks
that task's own steps say should pass, passing.

---

## File Structure

```
lib/cart-pricing.ts            NEW  cartTotals() — the $59 rule. Pure: no React, no storage.
lib/cart-pricing.test.ts       NEW
lib/use-cart.ts                NEW  client state, localStorage, ownership-aware
lib/cart-ownership.ts          NEW  pure: which of these ids does this buyer own
lib/cart-ownership.test.ts     NEW

components/CartDrawer.tsx      NEW  the slide-out
components/cart-drawer.module.css NEW
components/CartProvider.tsx    NEW  context so the drawer and every Buy button share one cart

app/checkout/page.tsx          NEW  order summary + sign in or email
app/checkout/CheckoutForm.tsx  NEW
app/checkout/checkout.module.css NEW

app/api/cart/checkout/route.ts NEW  server-side ownership re-check + multi-line-item session
app/api/cart/owned/route.ts    NEW  what does this email already own (rate-limited)

lib/plugin-purchase-grant.ts   MOD  grant an arbitrary set from metadata.products
lib/plugin-checkout-logic.ts   MOD  CancelPath gains "/checkout"
components/plugin-page/BuyButton.tsx MOD  add to cart and open, instead of going to Stripe
components/PluginChrome.tsx    MOD  bundle CTAs open the cart
components/PluginsMenu.tsx     MOD  bundle row opens the cart
lib/site-alerts.ts             MOD  bundle alert points at the cart
app/plugins/page.tsx           MOD  redirect to /shft

DELETED: app/plugins/PluginsStore.tsx, app/plugins/plugins.module.css,
         app/api/bundle/checkout/route.ts, lib/bundle-eligibility.ts (folded into cart-ownership)

scripts/verify-cart.mjs        NEW
```

**Responsibility split worth stating:** `cart-pricing` knows the money rule and nothing else.
`cart-ownership` knows what a buyer owns and nothing else. `use-cart` holds state. The route
composes all three and is the only place that trusts none of them. Keeping these apart is
what makes the money rule unit-testable without a browser or a database.

---

### Task 1: The pricing rule

**Files:**
- Create: `lib/cart-pricing.ts`, `lib/cart-pricing.test.ts`

**Interfaces:**
- Consumes: `PLUGIN_ORDER`, `PluginId`, `PLUGINS` from `@/lib/plugins`; `PRICING` from `@/lib/products`.
- Produces: `CartLine`, `CartTotals`, `cartTotals(ids: readonly PluginId[]): CartTotals`.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { cartTotals } from "./cart-pricing"
import { PRICING } from "./products"

test("cartTotals: an empty cart is all zeroes and no bundle", () => {
  const t = cartTotals([])
  assert.deepEqual(t.lines, [])
  assert.equal(t.subtotal, 0)
  assert.equal(t.total, 0)
  assert.equal(t.saving, 0)
  assert.equal(t.bundleApplied, false)
})

test("cartTotals: one item is its own price, no bundle", () => {
  const t = cartTotals(["shft"])
  assert.equal(t.subtotal, PRICING.shft.price)
  assert.equal(t.total, PRICING.shft.price)
  assert.equal(t.bundleApplied, false)
  assert.equal(t.saving, 0)
})

test("cartTotals: two items are the sum of singles — there is no two-item price", () => {
  const t = cartTotals(["shft", "fltr"])
  assert.equal(t.subtotal, PRICING.shft.price + PRICING.fltr.price)
  assert.equal(t.total, t.subtotal)
  assert.equal(t.bundleApplied, false)
})

test("cartTotals: all three applies the bundle price and reports the saving", () => {
  const t = cartTotals(["shft", "drft", "fltr"])
  assert.equal(t.bundleApplied, true)
  assert.equal(t.total, PRICING.bundle.price)
  assert.equal(t.subtotal, PRICING.shft.price + PRICING.drft.price + PRICING.fltr.price)
  assert.equal(t.saving, t.subtotal - PRICING.bundle.price)
})

test("cartTotals: duplicate ids collapse rather than double-charging", () => {
  const t = cartTotals(["shft", "shft", "drft"])
  assert.equal(t.lines.length, 2)
  assert.equal(t.subtotal, PRICING.shft.price + PRICING.drft.price)
})

test("cartTotals: lines follow PLUGIN_ORDER regardless of the order added", () => {
  const t = cartTotals(["fltr", "shft", "drft"])
  assert.deepEqual(t.lines.map((l) => l.id), ["shft", "drft", "fltr"])
})

test("cartTotals: msrpTotal is the combined list price, for the struck figure", () => {
  const t = cartTotals(["shft", "drft", "fltr"])
  assert.equal(t.msrpTotal, PRICING.shft.msrp + PRICING.drft.msrp + PRICING.fltr.msrp)
  assert.equal(t.msrpTotal, PRICING.bundle.compareAt)
})
```

That last assertion is worth having: it proves `$147` really is the three MSRPs, not a
number someone typed.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test lib/cart-pricing.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement it**

```ts
import { PLUGIN_ORDER, type PluginId } from "./plugins"
import { PRICING } from "./products"

export interface CartLine {
  id: PluginId
  price: number
  msrp: number
}

export interface CartTotals {
  lines: CartLine[]
  /** Sum of single prices, before any bundle discount. */
  subtotal: number
  /** True only when every plugin is present. Derived from PLUGIN_ORDER, never a literal. */
  bundleApplied: boolean
  /** subtotal, or the bundle price when bundleApplied. */
  total: number
  /** subtotal - total. Zero unless the bundle applied. */
  saving: number
  /** Combined list price, for the struck figure. */
  msrpTotal: number
}

/**
 * The cart's money rule, in one pure place.
 *
 * Items sit at their own price; the bundle price replaces the subtotal only
 * when every plugin is present. There is deliberately no two-item price — the
 * two-plugin bundle was retired, and reintroducing one here by accident is the
 * failure this function exists to make impossible.
 *
 * Input is de-duplicated and ordered by PLUGIN_ORDER, so the drawer's order
 * never depends on the order things were clicked.
 */
export function cartTotals(ids: readonly PluginId[]): CartTotals {
  const present = new Set(ids)
  const lines: CartLine[] = PLUGIN_ORDER.filter((id) => present.has(id)).map((id) => ({
    id,
    price: PRICING[id].price,
    msrp: PRICING[id].msrp,
  }))

  const subtotal = lines.reduce((sum, l) => sum + l.price, 0)
  const msrpTotal = lines.reduce((sum, l) => sum + l.msrp, 0)
  const bundleApplied = lines.length === PLUGIN_ORDER.length
  const total = bundleApplied ? PRICING.bundle.price : subtotal

  return { lines, subtotal, bundleApplied, total, saving: subtotal - total, msrpTotal }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx --test lib/cart-pricing.test.ts` — 7 pass.
Then `npx tsx --test lib/*.test.ts` — expect 158 (151 + 7).

- [ ] **Step 5: Commit**

```bash
git add lib/cart-pricing.ts lib/cart-pricing.test.ts
git commit -m "feat: the cart's pricing rule, as one pure function"
```

---

### Task 2: Ownership filtering

Pure, and the thing the server will trust instead of the client.

**Files:**
- Create: `lib/cart-ownership.ts`, `lib/cart-ownership.test.ts`
- Delete: `lib/bundle-eligibility.ts`, `lib/bundle-eligibility.test.ts` (generalised into this)

**Interfaces:**
- Consumes: `PLUGIN_PRODUCTS`, `PluginProduct` from `@/lib/plugin-products`.
- Produces:
  ```ts
  export interface CartCheck {
    /** Requested ids that are real plugins, de-duplicated, in PLUGIN_PRODUCTS order. */
    requested: PluginProduct[]
    /** Of those, the ones already owned. */
    owned: PluginProduct[]
    /** Of those, the ones that may actually be sold. */
    sellable: PluginProduct[]
    /** True when there is nothing left to sell. */
    empty: boolean
  }
  export function checkCart(requestedIds: readonly string[], ownedIds: readonly string[]): CartCheck
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { checkCart } from "./cart-ownership"

test("checkCart: a visitor who owns nothing may buy everything asked for", () => {
  const r = checkCart(["shft", "drft"], [])
  assert.deepEqual(r.requested, ["shft", "drft"])
  assert.deepEqual(r.owned, [])
  assert.deepEqual(r.sellable, ["shft", "drft"])
  assert.equal(r.empty, false)
})

test("checkCart: owned items are separated out, not silently sold again", () => {
  const r = checkCart(["shft", "drft", "fltr"], ["drft"])
  assert.deepEqual(r.owned, ["drft"])
  assert.deepEqual(r.sellable, ["shft", "fltr"])
  assert.equal(r.empty, false)
})

test("checkCart: a cart of only owned items is empty and sells nothing", () => {
  const r = checkCart(["shft"], ["shft", "drft"])
  assert.deepEqual(r.sellable, [])
  assert.equal(r.empty, true)
})

test("checkCart: unknown ids are discarded rather than trusted", () => {
  // A stale localStorage value or a crafted request must not reach Stripe.
  const r = checkCart(["shft", "not-a-plugin", "bundle"], [])
  assert.deepEqual(r.requested, ["shft"])
  assert.deepEqual(r.sellable, ["shft"])
})

test("checkCart: duplicates collapse", () => {
  const r = checkCart(["shft", "shft"], [])
  assert.deepEqual(r.sellable, ["shft"])
})

test("checkCart: results follow PLUGIN_PRODUCTS order regardless of input order", () => {
  const r = checkCart(["fltr", "shft"], [])
  assert.deepEqual(r.sellable, ["shft", "fltr"])
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test lib/cart-ownership.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement it**

```ts
import { PLUGIN_PRODUCTS, isPluginProduct, type PluginProduct } from "./plugin-products"

export interface CartCheck {
  requested: PluginProduct[]
  owned: PluginProduct[]
  sellable: PluginProduct[]
  empty: boolean
}

/**
 * What may actually be sold to this buyer.
 *
 * Both arguments are untrusted strings: the cart comes from localStorage or a
 * request body, and anything that is not a real plugin id is discarded rather
 * than passed along. Owned items are separated instead of dropped silently, so
 * callers can tell the buyer why their cart changed.
 *
 * Replaces bundle-eligibility: the question is no longer "may they buy the
 * bundle" but "which of these do they already have".
 */
export function checkCart(requestedIds: readonly string[], ownedIds: readonly string[]): CartCheck {
  const asked = new Set(requestedIds.filter(isPluginProduct))
  const has = new Set(ownedIds.filter(isPluginProduct))

  const requested = PLUGIN_PRODUCTS.filter((id) => asked.has(id))
  const owned = requested.filter((id) => has.has(id))
  const sellable = requested.filter((id) => !has.has(id))

  return { requested, owned, sellable, empty: sellable.length === 0 }
}
```

- [ ] **Step 4: Run it, then retire the old module**

Run: `npx tsx --test lib/cart-ownership.test.ts` — 6 pass.

Then delete `lib/bundle-eligibility.ts` and `lib/bundle-eligibility.test.ts`. **Check what
imports them first** (`grep -rn bundle-eligibility app lib`).

`app/api/bundle/checkout/route.ts` imports it, and Task 8 — not Task 6 — deletes that route.
Leaving the import broken until then would put `tsc` and `npm run build` in the red for six
tasks, while every task's definition of done requires a green build. So **repoint that route at
`checkCart` in this task**: replace its `bundleEligibility(...)` call with `checkCart(PLUGIN_PRODUCTS, ownedIds)`
and keep its existing 409 behaviour — refuse when anything is owned. It is three lines, it keeps
the tree green, and Task 8 deletes the route outright.

If anything else imports the deleted module, stop and report rather than leaving the tree broken.

Run: `npx tsx --test lib/*.test.ts` — expect 159 (158 + 6 new − 5 removed).

- [ ] **Step 5: Commit**

```bash
git add lib/cart-ownership.ts lib/cart-ownership.test.ts
git rm lib/bundle-eligibility.ts lib/bundle-eligibility.test.ts
git commit -m "feat: cart ownership filtering, generalising bundle eligibility"
```

---

### Task 3: Cart state

**Files:**
- Create: `lib/use-cart.ts`, `components/CartProvider.tsx`
- Modify: `app/layout.tsx` (mount the provider)

**Interfaces:**
- Consumes: `PLUGIN_ORDER`, `PluginId`; `cartTotals`, `CartTotals` (Task 1); `usePluginOwnership()`.
- Produces: `<CartProvider>`, and `useCart(): Cart` where

```ts
export interface Cart {
  ids: PluginId[]
  totals: CartTotals
  add(id: PluginId): void
  remove(id: PluginId): void
  addAll(): void
  clear(): void
  isOpen: boolean
  open(): void
  close(): void
  /** Ids removed because ownership resolved and the visitor already owns them. */
  dropped: PluginId[]
  /** Dismiss the dropped notice. */
  clearDropped(): void
}
```

A **provider**, not a bare hook: every Buy button, the rail pill, the dropdown row and the
drawer must share one cart. Independent hook instances would each hold their own.

- [ ] **Step 1: Write `lib/use-cart.ts`**

```ts
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { cartTotals, type CartTotals } from "@/lib/cart-pricing"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"

const STORAGE_KEY = "sampleroll_cart_v1"

const isPluginId = (v: unknown): v is PluginId =>
  typeof v === "string" && (PLUGIN_ORDER as readonly string[]).includes(v)

/** Stored state is untrusted: a removed plugin or a tampered value must not reach checkout. */
function readStored(): PluginId[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isPluginId) : []
  } catch {
    return []
  }
}

function writeStored(ids: PluginId[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)) } catch { /* private mode */ }
}

export interface Cart {
  ids: PluginId[]
  totals: CartTotals
  add(id: PluginId): void
  remove(id: PluginId): void
  addAll(): void
  clear(): void
  isOpen: boolean
  open(): void
  close(): void
  dropped: PluginId[]
  clearDropped(): void
}

export function useCartState(): Cart {
  // Empty on the server and on the first client render, then hydrated from
  // storage in an effect — reading localStorage during render would mismatch.
  const [ids, setIds] = useState<PluginId[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [dropped, setDropped] = useState<PluginId[]>([])
  const { loading, error, owned } = usePluginOwnership()

  useEffect(() => { setIds(readStored()) }, [])
  useEffect(() => { writeStored(ids) }, [ids])

  // Drop anything the visitor turns out to own. Only once ownership is actually
  // known: acting on loading or error would silently empty a legitimate cart.
  useEffect(() => {
    if (loading || error) return
    setIds((current) => {
      const keep = current.filter((id) => !owned[id])
      if (keep.length === current.length) return current
      setDropped(current.filter((id) => owned[id]))
      return keep
    })
  }, [loading, error, owned])

  const add = useCallback((id: PluginId) => {
    setIds((c) => (c.includes(id) ? c : [...c, id]))
  }, [])
  const remove = useCallback((id: PluginId) => setIds((c) => c.filter((x) => x !== id)), [])
  const addAll = useCallback(() => setIds([...PLUGIN_ORDER]), [])
  const clear = useCallback(() => setIds([]), [])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const clearDropped = useCallback(() => setDropped([]), [])

  const totals = useMemo(() => cartTotals(ids), [ids])

  return { ids, totals, add, remove, addAll, clear, isOpen, open, close, dropped, clearDropped }
}
```

**Note:** `add` deliberately does not itself refuse an owned plugin — the ownership effect is
the single place that decision lives, so there is one rule rather than two that can disagree.
Buy buttons never render for an owned plugin anyway.

- [ ] **Step 2: Write `components/CartProvider.tsx`**

```tsx
"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useCartState, type Cart } from "@/lib/use-cart"

const CartContext = createContext<Cart | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  return <CartContext.Provider value={useCartState()}>{children}</CartContext.Provider>
}

/** One shared cart. Throws rather than silently handing back an isolated one. */
export function useCart(): Cart {
  const cart = useContext(CartContext)
  if (!cart) throw new Error("useCart must be used inside <CartProvider>")
  return cart
}
```

- [ ] **Step 3: Mount it in `app/layout.tsx`**

Wrap the existing body content in `<CartProvider>`. Read the file first — it already nests
`SessionProvider` and others; add this inside them, not around them, since the cart depends
on ownership which depends on the session.

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit` (clean) and `npm run build` (exit 0). Nothing renders the cart yet;
Task 4 is its first consumer. **Do not build a demo page.**

- [ ] **Step 5: Commit**

```bash
git add lib/use-cart.ts components/CartProvider.tsx app/layout.tsx
git commit -m "feat: shared cart state, ownership-aware and storage-backed"
```

---

### Task 4: The drawer

**Files:**
- Create: `components/CartDrawer.tsx`, `components/cart-drawer.module.css`
- Modify: `app/layout.tsx` (render it once, inside the provider)

**Interfaces:**
- Consumes: `useCart()` (Task 3); `PLUGINS`; `PluginGlyph`; `PRICING`.
- Produces: `<CartDrawer />`, rendered once globally.

**Accessibility is the substance of this task, not polish.** The dropdown in the previous
increment shipped with no blur-close and a key handler that froze page scrolling; both
reached a final review. A drawer is a dialog and has a stricter contract.

- [ ] **Step 1: Write the component**

Requirements the code must satisfy — every one is testable in Task 8:

- `role="dialog"`, `aria-modal="true"`, and an `aria-label` naming it.
- On open: focus moves into the drawer (the close button). On close: focus returns to
  whatever opened it.
- `Escape` closes it.
- Focus is trapped while open — Tab from the last control returns to the first.
- The rest of the page is `inert` (or `aria-hidden` plus a focus guard) while open.
- The slide respects `prefers-reduced-motion: reduce`.
- Renders nothing at all when `isOpen` is false — not a hidden-but-focusable subtree, which
  is what made the drawer's menu rows reachable-but-hidden in the previous increment.

Structure: a header naming it and a close control; a line per `totals.lines` entry with the
plugin's `PluginGlyph`, name, category, `$price` struck `$msrp`, and a remove button labelled
for assistive tech (`Remove shft from your cart`, not a bare `×`); then, when
`totals.bundleApplied`, one line reading `Bundle — all three` with `−$${totals.saving}`;
then the total; then a link to `/checkout` reading `Checkout →`.

When `dropped.length > 0`, a notice above the lines: these were removed because you already
own them, naming them, with a dismiss calling `clearDropped()`.

Empty state: say what the cart is for and link to `/shft`. Never a blank panel.

- [ ] **Step 2: Write the stylesheet**

Fixed to the right edge, full height, above the chrome (`z-index` higher than the rail's 40
and the dropdown panel's 60 — use 80), with a scrim behind it. Chrome palette, since the
drawer is chrome and appears over all three plugin grounds: `#efe9dc` ground, `#24211d` ink,
the house gradient on the checkout CTA. Labels and prices `var(--font-ibm-mono)` with
`tabular-nums`; **declare the sans stack on the panel** for names and body, because
`globals.css:44` sets a monospace body font sitewide.

Width `min(420px, 100vw)`; at narrow widths it is full-bleed. Lines scroll within the panel
(`overflow-y: auto`), the total and CTA stay pinned — a cart that pushes its own checkout
button off-screen is the classic failure here.

- [ ] **Step 3: Render it once in `app/layout.tsx`**

Inside `<CartProvider>`, as a sibling of the page content — not inside any page, so it
survives navigation.

- [ ] **Step 4: Enumerate and verify**

Enumerate every `styles.X` against every `.X {`, both directions, and put the numbers in your
report. Then `npx tsc --noEmit`, `npm run build`, and lint showing nothing new.

Nothing adds to the cart yet — Task 5 wires that. To see the drawer, temporarily call
`open()` from the browser console rather than adding a test button to the app.

- [ ] **Step 5: Commit**

```bash
git add components/CartDrawer.tsx components/cart-drawer.module.css app/layout.tsx
git commit -m "feat: the cart drawer"
```

---

### Task 5: Everything that sells now goes through the cart

**Files:**
- Modify: `components/plugin-page/BuyButton.tsx`, `components/PluginChrome.tsx`,
  `components/PluginsMenu.tsx`, `lib/site-alerts.ts`

**Interfaces:**
- Consumes: `useCart()`.
- Produces: no new exports. Behaviour change only.

- [ ] **Step 1: Buy buttons add and open**

`BuyButton` currently POSTs to `/api/<id>/checkout` and redirects to Stripe. Replace that
path with `add(id)` then `open()`. Keep every other state exactly as it is: the `loading`
placeholder, the owned "You own X — download" link, and the disabled state. The label becomes
`Add · $29` style rather than `Buy · $29` — it no longer goes straight to payment and must
not claim to.

`trackMeta("InitiateCheckout", …)` moves out of here: adding to a cart is not initiating
checkout. Fire it from the checkout page instead (Task 7). **Say in your report that you
moved it**, so the analytics change is visible rather than silent.

The per-plugin routes `/api/{shft,drft,fltr}/checkout` stay for now — Task 8 decides their
fate once nothing calls them.

- [ ] **Step 2: The bundle CTAs open the cart with everything in it**

In `PluginChrome`, the sale strip's bundle variant and the rail's bundle pill both currently
link to `/plugins#bundle`. Both become buttons calling `addAll()` then `open()`.

Keep them keyboard-accessible: a `button`, not a div with a click handler, and keep the
existing focus-visible treatment. The strip's non-bundle variants are unchanged.

In `PluginsMenu`, the bundle row does the same, and closes the dropdown as it opens the cart.

- [ ] **Step 3: The site alert**

`lib/site-alerts.ts`'s `three-plugin-bundle` entry has `href: "/plugins"`, which Task 8
redirects. Point it at `/shft` — an alert is a link, not a button, and cannot open the cart.
Adjust its `ctaLabel` so it does not promise a cart it cannot open.

- [ ] **Step 4: Verify by hand**

Dev server usually on :3000. Confirm: a Buy button adds one item and opens the drawer; the
rail pill adds all three; the dropdown row adds all three and closes the dropdown; an owned
plugin still shows its download link and no Add button; adding twice does not duplicate a
line.

Then `node scripts/verify-plugin-chrome.mjs` (36), `node scripts/verify-storefront-nav.mjs`
(16), `npx tsc --noEmit`, `npm run build`.

**`scripts/verify-plugins-index.mjs` will now fail** — it asserts on `/plugins`, whose buy
controls just changed and which Task 8 deletes. Note it and move on; do not patch that script
here, and do not delete it.

- [ ] **Step 5: Commit**

```bash
git add components/plugin-page/BuyButton.tsx components/PluginChrome.tsx \
        components/PluginsMenu.tsx lib/site-alerts.ts
git commit -m "feat: buy controls and bundle CTAs route through the cart"
```

---

### Task 6: The server side

**This is the money path.** A mistake here charges someone for something they own, or grants
the wrong products.

**Files:**
- Create: `app/api/cart/checkout/route.ts`, `app/api/cart/owned/route.ts`
- Modify: `lib/plugin-purchase-grant.ts` (~line 157), `lib/plugin-checkout-logic.ts`

**Interfaces:**
- Consumes: `checkCart` (Task 2); `cartTotals` (Task 1); `createPluginCheckoutSession`, `buyerFromSession`, `readAffiliateCodeFromCookie` from `@/lib/plugin-checkout`; `PLUGIN_GRANTS`, `isPluginProduct`.
- Produces: `POST /api/cart/checkout`, `POST /api/cart/owned`, and `metadata.products` understood by the grant path.

- [ ] **Step 1: Teach the grant path to grant an arbitrary set**

`lib/plugin-purchase-grant.ts` around line 157 loops `PLUGIN_GRANTS[product]`. Add, just
above it, a list resolved from metadata:

```ts
// A cart purchase names its own products; every older session shape names a
// single product or the bundle and still resolves through PLUGIN_GRANTS.
// metadata is attacker-adjacent input, so each entry is validated rather than
// trusted — an unrecognised value is dropped, never granted.
const fromMetadata = (session.metadata?.products ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(isPluginProduct)

const grants = fromMetadata.length > 0 ? fromMetadata : PLUGIN_GRANTS[product]
```

then loop `grants`. **Change nothing else in that function** — licence minting, the receipt,
the duplicate alert, the affiliate referral and `emailVerified` all keep working as they are.

- [ ] **Step 2: Extend `CancelPath`**

In `lib/plugin-checkout-logic.ts`, add `"/checkout"` to the `CancelPath` union so a cancelled
cart purchase returns to the checkout page rather than a plugin page.

Run `npx tsx --test lib/plugin-checkout-logic.test.ts` — its existing assertions must still pass.

- [ ] **Step 3: Write `app/api/cart/owned/route.ts`**

What does this email already own? Used by the checkout page before payment.

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { PLUGIN_PRODUCTS } from "@/lib/plugin-products"
import { SlidingWindowLimiter } from "@/lib/resend-rate-limit"

// Telling an anonymous visitor which plugins an address owns reveals that the
// address has an account. That is the price of not silently altering someone's
// cart, and it is bounded: nothing is revealed beyond the plugins asked about,
// and the rate limit makes enumeration impractical.
const limiter = new SlidingWindowLimiter({ limit: 10, windowMs: 60_000 })

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (!limiter.take(ip)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ owned: [] })
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ owned: [] })

  const purchases = await prisma.purchase.findMany({
    where: { userId: user.id, product: { in: [...PLUGIN_PRODUCTS] } },
    select: { product: true },
  })
  return NextResponse.json({ owned: purchases.map((p) => p.product) })
}
```

Read `lib/resend-rate-limit.ts` first and match its actual constructor and method names — the
shape above is illustrative of intent, not necessarily its API.

- [ ] **Step 4: Write `app/api/cart/checkout/route.ts`**

The rules this route enforces, in order:

1. Resolve the buyer: a session if there is one, otherwise the posted email. **Neither is
   optional** — with neither, return `400`, because an unidentifiable buyer is the hole this
   whole spec exists to close.
2. Look up what that buyer owns, by user id or by email.
3. `checkCart(postedIds, ownedIds)`. If `owned.length > 0`, return
   `409 { reason: "already_owned", owns: check.owned }` — **the client's cart is never
   trusted.** If `empty`, return `409 { reason: "empty" }`.
4. Build line items from `check.sellable`: when it is every plugin, one line item at the
   bundle price id; otherwise one line item per plugin at its own price id.
5. If any required price id is unset, return the existing `503 "Checkout opens at launch."`
   rather than charging something wrong.
6. Create the session with `metadata.products = check.sellable.join(",")`, `cancelPath:
   "/checkout"`, and `paid` from `cartTotals(check.sellable).total` so the `/thanks` pixel
   value matches what was charged.

Follow `app/api/bundle/checkout/route.ts` for the surrounding shape — affiliate cookie,
attribution metadata, error handling — and reuse `createPluginCheckoutSession`. It takes a
single `priceId` today; extend it to accept either a price id or a list of line items rather
than writing a second session builder. Say in your report which you did and why.

- [ ] **Step 5: Verify**

Run `npx tsx --test lib/*.test.ts` — expect 159, unchanged by this task.

Then exercise the route directly with `curl` against the dev server for each case, and paste
the real responses into your report:
- no session and no email → 400
- an email that owns nothing, cart of two → 200 with a Stripe url
- an email that owns one of the two → 409 `already_owned` naming it
- a cart of only owned items → 409 `empty`
- all three → 200, and confirm the session has **one** line item, not three

`npx tsc --noEmit`, `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add app/api/cart lib/plugin-purchase-grant.ts lib/plugin-checkout-logic.ts lib/plugin-checkout.ts
git commit -m "feat: cart checkout with a server-side ownership re-check"
```

---

### Task 7: The checkout page

**Files:**
- Create: `app/checkout/page.tsx`, `app/checkout/CheckoutForm.tsx`, `app/checkout/checkout.module.css`

**Interfaces:**
- Consumes: `useCart()`; `cartTotals`; `POST /api/cart/owned`; `POST /api/cart/checkout`; `useSession` from `next-auth/react`.
- Produces: the `/checkout` route.

Layout follows the reference: **order summary on the right, identification on the left.**

- [ ] **Step 1: The summary side**

From `cart.totals`: a line per item with the plugin's glyph, name, category and price struck
against MSRP; the `Bundle — all three  −$X` line when `bundleApplied`; then `Amount due` with
the total, struck against `msrpTotal`.

An empty cart does not render a form — it says the cart is empty and links to `/shft`.

- [ ] **Step 2: The identification side**

Two states, chosen by whether `useSession()` has a session:

**Signed in:** show which account, and a control to use a different one. No email field —
ownership is already known exactly.

**Not signed in:** a sign-in link carrying `callbackUrl=/checkout`, and beneath it an email
field plus a confirm-email field. **The confirm field is load-bearing**: licence keys are
delivered by email and there is no verification step to catch a typo. Reject a mismatch
before submitting and say which field is wrong.

On blur of a valid, matching email, POST it to `/api/cart/owned`. If it owns anything in the
cart, remove those items and show a plain notice naming them — *"You already own drft, so
we've taken it out of your cart."* This happens **before** payment, which is the entire point.

Handle `429` by saying the check is unavailable and letting them continue — the server
re-checks at checkout regardless, so a rate-limited lookup must not block a legitimate sale.

- [ ] **Step 3: Submit**

Fire `trackMeta("InitiateCheckout", { value: cart.totals.total, currency: "USD", content_type: "product" })`
here — this is where checkout actually begins, and it is the event moved out of `BuyButton`
in Task 5.

POST the ids and the email (when not signed in) to `/api/cart/checkout`. On `200`, redirect
to the Stripe url. On `409 already_owned`, remove the named items, show the notice, and let
them retry without losing the rest of the cart. On `409 empty`, say everything in the cart is
already theirs and link to `/products`. On `503`, show the "Opens at launch" state the other
buy controls use.

- [ ] **Step 4: Verify**

`npx tsc --noEmit`, `npm run build`, lint showing nothing new. Enumerate `styles.X` against
`.X {` both directions.

Then drive it: an empty cart shows the empty state; a two-item cart shows the sum with no
bundle line; adding the third shows the bundle line and $59; mismatched confirm-email is
rejected; an email owning something in the cart triggers the removal notice before payment;
signed-in shows the account and no email field. **Screenshot at 1280px and 375px and view
them.**

- [ ] **Step 5: Commit**

```bash
git add app/checkout
git commit -m "feat: the checkout page, identifying the buyer before Stripe"
```

---

### Task 8: Retire /plugins, and verify the whole thing

**Files:**
- Modify: `app/plugins/page.tsx`
- Delete: `app/plugins/PluginsStore.tsx`, `app/plugins/plugins.module.css`,
  `app/api/bundle/checkout/route.ts`, `scripts/verify-plugins-index.mjs`
- Create: `scripts/verify-cart.mjs`

- [ ] **Step 1: Redirect `/plugins`**

Replace `app/plugins/page.tsx` entirely:

```tsx
import { redirect } from "next/navigation"

// The cart is the bundle's home now, so this page has nothing left to show.
// Kept as a redirect rather than deleted: the URL is in sent email, in the
// site alert history, and indexed.
export default function PluginsPage() {
  redirect("/shft")
}
```

Delete `PluginsStore.tsx` and `plugins.module.css`. Then **grep for every remaining
`/plugins` reference** (`grep -rn '"/plugins' app components lib scripts`) and repoint each —
`app/products/page.tsx`, `app/thanks/ThanksPage.tsx`, `app/prelaunch/PrelaunchContent.tsx`,
`app/offers/page.tsx` and `SiteNav` all mention it. Report the full list and what you did
with each. `/offers` currently redirects to `/plugins`, which would now be two hops: point it
straight at `/shft`.

- [ ] **Step 2: Delete the bundle route**

Nothing should call `/api/bundle/checkout` once Task 5 rewired the CTAs. Confirm with a grep
before deleting, and check whether `lib/plugin-checkout-logic.test.ts` references `"bundle"`
as a `CompProduct` — it may, legitimately, since comp codes still grant bundles. **Do not
remove `"bundle"` from `COMP_PRODUCTS`**; an admin can still mint a bundle comp code.

- [ ] **Step 3: Delete `scripts/verify-plugins-index.mjs`**

It asserts on a page that no longer exists. Deleting it is correct — but say so explicitly in
your report, because silently removing a gate looks identical to hiding a failure.

- [ ] **Step 4: Write `scripts/verify-cart.mjs`**

Following the house pattern. Cover: adding from a Buy button; adding all three from the rail
pill; the drawer's lines, bundle line and total; removing an item makes the bundle line
disappear and the total return to the sum of singles; persistence across reload; the empty
state; `Escape` closes the drawer and focus returns to whatever opened it; focus is trapped
while open; the checkout page's summary matches the drawer.

**Prove the checks can fail**: break the bundle rule (make `cartTotals` always return the
subtotal), confirm the bundle-line check FAILS, restore, confirm it passes. Put that evidence
in your report — four verify scripts on this branch have shipped assertions that could not fail.

- [ ] **Step 5: Ownership states**

Seed `Purchase` rows against the local database. Confirm: an owned plugin shows a download
link and no Add control; an owned id planted directly in `localStorage` is dropped on load
with the notice; the checkout route refuses a crafted request containing an owned id even
though the UI would not send one. **Clean up every seeded row and say so.** A pre-existing
`shft` purchase on `local-admin@example.com` dated 2026-08-18 belongs to the owner — leave it.

- [ ] **Step 6: The money path in Stripe test mode**

With test keys: a two-item cart charges the sum of singles; a three-item cart charges $59 in
**one** line item; the webhook grants exactly the purchased set; the receipt lists them;
`/thanks` shows the keys. Report the real Stripe amounts, not what you expect them to be.

- [ ] **Step 7: Full gates**

```
npx tsx --test lib/*.test.ts                        # 159
node scripts/verify-cart.mjs
node scripts/verify-plugin-chrome.mjs               # 36
node scripts/verify-storefront-nav.mjs              # 16
npx tsx scripts/verify-plugin-pricing.mjs           # 7
node scripts/verify-shft-social.mjs
node scripts/verify-plugin-ownership.mjs
npx tsc --noEmit                                    # 0
npm run build                                       # exit 0
npm run lint                                        # 298 baseline, nothing new
```

- [ ] **Step 8: Commit**

```bash
git add -A app/plugins app/api scripts lib components
git commit -m "feat: retire /plugins now the cart is the bundle's home"
```

---

## Owner actions

- No new Stripe configuration: the cart uses the per-plugin price ids and the bundle price id
  that already exist, under the names renamed in the first increment.
- Decide whether `/offers` still earns its redirect now that `/plugins` also redirects.

## Self-review

**Spec coverage.** `cartTotals` → Task 1. `checkCart` and retiring bundle-eligibility → Task 2.
Cart state, storage validation, ownership dropping → Task 3. Drawer and its dialog contract →
Task 4. Buy buttons and bundle CTAs → Task 5. Multi-line-item session, server-side re-check,
arbitrary grant, `CancelPath` → Task 6. Checkout page, email lookup, enumeration rate limit →
Tasks 6 and 7. `/plugins` redirect and CTA repointing → Tasks 5 and 8. Verification → Task 8.
Every spec section maps to a task.

**Type consistency.** `CartTotals` is defined in Task 1 and consumed unchanged in Tasks 3, 4
and 7. `CartCheck`/`checkCart` defined in Task 2, consumed in Task 6. `Cart` and `useCart()`
defined in Task 3, consumed in Tasks 4, 5 and 7. `metadata.products` is written in Task 6
step 4 and read in Task 6 step 1 — same task, same format, comma-joined.

**Known ordering hazard, stated deliberately.** Task 5 breaks
`scripts/verify-plugins-index.mjs`, and Task 8 deletes it. That gap is intentional and both
tasks say so; an implementer who "fixes" that script in Task 5 will have wasted the work.
