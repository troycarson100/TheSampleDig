# Storefront Nav and Ticker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the ticker and the rail separate jobs — the ticker carries fltr's introductory price with a real countdown, the rail keeps the bundle — and add a Plugins hover dropdown covering the whole range.

**Architecture:** One pure function in `lib/plugins.ts` decides whether the intro window is live; a dumb `Countdown` component renders the clock; `PluginChrome` decides what the ticker says; a new `PluginsMenu` renders the dropdown from the same catalog and ownership hook every other surface uses.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, CSS Modules, `node:test` via `npx tsx --test`, Playwright as plain Node scripts.

**Spec:** `docs/superpowers/specs/2026-09-26-storefront-nav-and-ticker-design.md`

**Branch:** `feat/plugin-pages-redesign` (continues the storefront redesign; already checked out)

---

## Global Constraints

### Values — copy exactly

- `PRICING.fltr` is `{ price: 19, msrp: 49 }`. Every figure reads from `PRICING`; no price literal in JSX.
- The intro deadline comes from `NEXT_PUBLIC_FLTR_INTRO_ENDS`, an ISO date string. **Unset by default** — fltr's launch is gated on its Phase 5 and has no date.
- Ticker height goes from `min-height: 40px` to `64px`.
- Bundle CTA gradient stays `linear-gradient(90deg, #a6633c 0%, #d9a040 100%)`.
- Chrome colours are constant on every page: `--chrome-ground: #efe9dc`, `--chrome-ink: #24211d`, `--strip-ground: #14110e`, `--strip-ink: #efe9dc`.

### The one rule that governs every surface

**Never offer someone what they already own, and never offer anything on unknown ownership.**
`usePluginOwnership()` returns `{ loading, signedIn, owned, ownedCount, missing, error }`. While
`loading || error`, render navigation only — no purchase control, no bundle row, no owned marks.
This rule already governs the sale strip, the rail and every buy button; the dropdown joins them.

### Ticker branch order — part of the contract

Evaluate in exactly this order. Any other order offers a bundle to a partial owner when the
clock expires:

| # | Condition | Ticker |
|---|---|---|
| 1 | `loading \|\| error` | reserved-height placeholder, nothing offered |
| 2 | owns all three | no strip at all |
| 3 | does **not** own fltr **and** `introWindow().live` | the fltr countdown |
| 4 | owns one or two | existing "complete the rack" / "N left" |
| 5 | owns nothing | existing bundle offer |

Branch 3 above branch 4 is deliberate: only fltr's price is time-limited, so a shft owner sees
the countdown while it runs, then gets the "two left" nudge back when it expires.

### Type

- Labels and eyebrows: `var(--font-ibm-mono)`, uppercase, 11px, `letter-spacing: 0.14em`.
- Prices and countdown numerals: `var(--font-ibm-mono)` with `font-variant-numeric: tabular-nums` — without it the clock jitters as digits change.
- Body: `var(--font-geist-sans)`. Note `app/globals.css:44` sets a **monospace body font sitewide**; any new component wanting sans must say so.

### Quality floor

Responsive to 375px with no horizontal page scroll; visible keyboard focus on every
interactive element; `prefers-reduced-motion: reduce` respected. Hover alone never gates
functionality — keyboard and touch must reach everything.

### Verification convention

- Unit: `npx tsx --test lib/<name>.test.ts`, `node:test` + `node:assert/strict`, matching the
  16 existing suites. There is no `test` script.
- Browser: plain Node + Playwright scripts following `scripts/verify-plugin-chrome.mjs`, with a
  `check(label, condition, detail)` helper and `process.exit(failures.length ? 1 : 0)`.
- Scripts importing a `.ts` module need `NODE_OPTIONS=--experimental-strip-types node …` or `npx tsx …`.

### Definition of done for every task

`npm run lint` shows no new problems (297 pre-existing on this branch, all from `main`),
`npx tsc --noEmit` is clean, `npm run build` exits 0, and the task's own checks pass.

---

## File Structure

```
lib/plugins.ts                    MOD  FLTR_INTRO_ENDS, IntroWindow, introWindow() — the only
                                       place the deadline is interpreted
lib/plugins.test.ts               NEW  introWindow across unset / malformed / future / past / boundary

components/Countdown.tsx          NEW  dumb clock: given a Date, render the blocks. Decides nothing.
components/countdown.module.css   NEW

components/PluginChrome.tsx       MOD  taller strip, branch 3 added in the documented order
components/plugin-chrome.module.css MOD  .strip 40px -> 64px, countdown block styling

components/PluginsMenu.tsx        NEW  the dropdown panel + its trigger behaviour
components/plugins-menu.module.css NEW
components/SiteNav.tsx            MOD  desktop Plugins item becomes the trigger; drawer expands inline

scripts/verify-storefront-nav.mjs NEW  dropdown + ticker states in a real browser
```

Responsibility split worth stating: **`introWindow()` decides whether the window is live,
`Countdown` renders a clock, `PluginChrome` decides what to say.** Keeping those apart is what
makes the deadline logic unit-testable without a browser and the clock reusable without dragging
ownership rules along.

---

### Task 1: The intro window

**Files:**
- Modify: `lib/plugins.ts`
- Create: `lib/plugins.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FLTR_INTRO_ENDS: string | null`, `interface IntroWindow { endsAt: Date | null; live: boolean }`, `introWindow(now?: Date): IntroWindow`.

- [ ] **Step 1: Write the failing test**

Create `lib/plugins.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { introWindow } from "./plugins"

const NOW = new Date("2026-10-01T12:00:00.000Z")

test("introWindow: an unset deadline is never live", () => {
  const w = introWindow(NOW, null)
  assert.equal(w.endsAt, null)
  assert.equal(w.live, false)
})

test("introWindow: a malformed deadline is never live", () => {
  const w = introWindow(NOW, "next tuesday")
  assert.equal(w.endsAt, null)
  assert.equal(w.live, false)
})

test("introWindow: a future deadline is live and reports its date", () => {
  const w = introWindow(NOW, "2026-10-31T12:00:00.000Z")
  assert.equal(w.live, true)
  assert.equal(w.endsAt?.toISOString(), "2026-10-31T12:00:00.000Z")
})

test("introWindow: a past deadline is not live, but still reports its date", () => {
  const w = introWindow(NOW, "2026-09-01T12:00:00.000Z")
  assert.equal(w.live, false)
  assert.equal(w.endsAt?.toISOString(), "2026-09-01T12:00:00.000Z")
})

// The boundary is the moment the offer ends, so it is already over.
test("introWindow: exactly at the deadline is not live", () => {
  const w = introWindow(NOW, NOW.toISOString())
  assert.equal(w.live, false)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test lib/plugins.test.ts`
Expected: FAIL — `introWindow` is not exported.

- [ ] **Step 3: Implement it in `lib/plugins.ts`**

Append:

```ts
/** When fltr's introductory price ends, as an ISO date string. Unset until fltr
 *  ships — its launch is gated on Phase 5, so there is no date to hardcode.
 *  Setting this is what turns the countdown on.
 *  NEXT_PUBLIC_ because the clock ticks in the browser. */
export const FLTR_INTRO_ENDS: string | null = process.env.NEXT_PUBLIC_FLTR_INTRO_ENDS ?? null

export interface IntroWindow {
  /** The deadline, or null when unset or unparseable. */
  endsAt: Date | null
  /** True only when a valid deadline exists and is still in the future. */
  live: boolean
}

/**
 * The single place the intro deadline is interpreted. Unset, malformed and past
 * dates all resolve to `live: false`, which is what makes the ticker fall back to
 * the bundle offer rather than render a dead or negative clock.
 *
 * `raw` is injectable so the behaviour can be tested without touching env.
 */
export function introWindow(now: Date = new Date(), raw: string | null = FLTR_INTRO_ENDS): IntroWindow {
  if (!raw) return { endsAt: null, live: false }
  const endsAt = new Date(raw)
  if (Number.isNaN(endsAt.getTime())) return { endsAt: null, live: false }
  return { endsAt, live: endsAt.getTime() > now.getTime() }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx --test lib/plugins.test.ts`
Expected: 5 pass.

Then run the whole suite to confirm nothing else moved: `npx tsx --test lib/*.test.ts`
Expected: 151 (146 existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add lib/plugins.ts lib/plugins.test.ts
git commit -m "feat: fltr intro-price window, configured and unset by default"
```

---

### Task 2: The countdown clock

A dumb component. Given a target date it renders number-over-label blocks and nothing else — it
makes no decision about whether a countdown *should* appear.

**Files:**
- Create: `components/Countdown.tsx`
- Create: `components/countdown.module.css`

**Interfaces:**
- Consumes: nothing.
- Produces: `<Countdown endsAt={Date} onExpire?={() => void} className?={string} />`

- [ ] **Step 1: Write `components/Countdown.tsx`**

Two traps are handled here deliberately. A time computed during SSR never matches the client's
first render, so nothing time-dependent may reach the server output. And a clock repainting every
second is motion, so reduced-motion viewers get a minute-resolution clock with no seconds block.

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import styles from "./countdown.module.css"

interface Parts { days: number; hours: number; minutes: number; seconds: number }

function partsUntil(endsAt: Date, now: number): Parts {
  const ms = Math.max(0, endsAt.getTime() - now)
  const total = Math.floor(ms / 1000)
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, "0")

export default function Countdown({
  endsAt,
  onExpire,
  className = "",
}: {
  endsAt: Date
  onExpire?: () => void
  className?: string
}) {
  // null until mounted: the server must not render a time, or hydration mismatches.
  const [now, setNow] = useState<number | null>(null)
  const [coarse, setCoarse] = useState(false)
  const expired = useRef(false)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    setCoarse(reduce)
    setNow(Date.now())

    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (!expired.current && t >= endsAt.getTime()) {
        expired.current = true
        onExpire?.()
      }
    }
    // A repainting clock is motion: coarse viewers get minute resolution.
    const id = setInterval(tick, reduce ? 60_000 : 1_000)
    return () => clearInterval(id)
  }, [endsAt, onExpire])

  // Stable placeholder before mount — same box, no time.
  if (now === null) {
    return <div className={`${styles.clock} ${className}`} aria-hidden data-countdown-placeholder />
  }

  const p = partsUntil(endsAt, now)
  const blocks: [number, string][] = coarse
    ? [[p.days, "days"], [p.hours, "hrs"], [p.minutes, "min"]]
    : [[p.days, "days"], [p.hours, "hrs"], [p.minutes, "min"], [p.seconds, "sec"]]

  return (
    <div className={`${styles.clock} ${className}`} data-countdown>
      {blocks.map(([value, label], i) => (
        <div key={label} className={styles.block}>
          <span className={styles.value}>{pad(value)}</span>
          <span className={styles.label}>{label}</span>
          {i < blocks.length - 1 && <span className={styles.sep} aria-hidden>:</span>}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write `components/countdown.module.css`**

```css
.clock {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 34px;
}
.block { position: relative; display: flex; flex-direction: column; align-items: center; min-width: 30px; }
.value {
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 19px; font-weight: 600; line-height: 1.05;
  /* Without tabular figures the clock jitters as digits change width. */
  font-variant-numeric: tabular-nums;
}
.label {
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
  opacity: 0.6; margin-top: 3px;
}
.sep {
  position: absolute; top: 0; right: -7px;
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 15px; opacity: 0.4;
}

@media (max-width: 640px) {
  .clock { gap: 7px; }
  .value { font-size: 16px; }
  .block { min-width: 24px; }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run lint && npx tsc --noEmit`
Expected: no new problems. Nothing renders it yet — Task 3 is its first consumer. Do not build a demo page.

- [ ] **Step 4: Commit**

```bash
git add components/Countdown.tsx components/countdown.module.css
git commit -m "feat: hydration-safe countdown clock with reduced-motion resolution"
```

---

### Task 3: The taller ticker

**Files:**
- Modify: `components/PluginChrome.tsx` (the `SaleStrip` function, around lines 20–62)
- Modify: `components/plugin-chrome.module.css` (`.strip`, around line 29)

**Interfaces:**
- Consumes: `introWindow()` from `@/lib/plugins` (Task 1); `<Countdown endsAt onExpire className />` from `@/components/Countdown` (Task 2); `usePluginOwnership()`; `PRICING`.
- Produces: nothing other tasks depend on.

**Read `components/PluginChrome.tsx` first.** `SaleStrip` currently takes
`{ loading, error, ownedCount, missing }`. It gains `owned` so it can ask whether this visitor
owns fltr specifically.

- [ ] **Step 1: Grow the strip**

In `components/plugin-chrome.module.css`, change `.strip`'s `min-height: 40px` to `64px`. Leave
everything else in that rule as it is. Add, near the existing strip rules:

```css
/* The clock sits inline with the label and price, slightly raised so its
   small labels do not drag the row's optical centre down. */
.stripClock { margin: 0 4px; }
.stripNew {
  color: #d9a040;
  font-weight: 600;
}
```

- [ ] **Step 2: Add the countdown branch in the documented order**

Replace `SaleStrip`'s body so the branches evaluate in exactly this order. **Branch 3 must sit
above branch 4** — written the other way, an expired clock falls through to the bundle offer for
a partial owner, who cannot be sold a bundle.

```tsx
function SaleStrip({ loading, error, owned, ownedCount, missing }: {
  loading: boolean
  error: boolean
  owned: Record<PluginId, boolean>
  ownedCount: number
  missing: PluginId[]
}) {
  // Re-render when the clock runs out so the strip falls through to the next
  // branch for this visitor, without a reload.
  const [, setExpiredAt] = useState<number | null>(null)
  const intro = introWindow()

  // 1. Unknown ownership: reserve the height, offer nothing.
  if (loading || error) return <div className={styles.strip} data-sale-strip aria-hidden />

  // 2. Owns everything: there is nothing honest to advertise.
  if (ownedCount === PLUGIN_ORDER.length) return null

  // 3. fltr's intro price is the only genuinely time-limited price on the site,
  //    so it outranks the partial-owner nudge while it is running.
  if (!owned.fltr && intro.live && intro.endsAt) {
    return (
      <div className={styles.strip} data-sale-strip data-strip-variant="intro">
        <Link href={PLUGINS.fltr.href} className={styles.stripInner}>
          <span className={styles.stripNew}>New</span>
          <span className={styles.stripLabel}>{PLUGINS.fltr.name} intro price</span>
          <span className={styles.stripPrice}>${PRICING.fltr.price}</span>
          <s className={styles.stripWas}>${PRICING.fltr.msrp}</s>
          <Countdown
            endsAt={intro.endsAt}
            onExpire={() => setExpiredAt(Date.now())}
            className={styles.stripClock}
          />
          <span className={styles.stripLabel}>Get {PLUGINS.fltr.name}</span>
          <span className={styles.stripArrow} aria-hidden>→</span>
        </Link>
      </div>
    )
  }

  // 4. Owns one or two: offer only what is missing, at single price.
  if (ownedCount > 0) {
    const total = missing.reduce((sum, id) => sum + PRICING[id].price, 0)
    const href = missing.length === 1 ? PLUGINS[missing[0]].href : "/plugins"
    return (
      <div className={styles.strip} data-sale-strip data-strip-variant="partial">
        <Link href={href} className={styles.stripInner}>
          <span className={styles.stripLabel}>
            {missing.length === 1 ? "Complete the rack" : `${countWord(missing.length)} left`}
          </span>
          <span className={styles.stripNames}>{nameList(missing)}</span>
          <span className={styles.stripPrice}>${total}</span>
          <span className={styles.stripArrow} aria-hidden>→</span>
        </Link>
      </div>
    )
  }

  // 5. Owns nothing: the bundle.
  const save = PRICING.bundle.compareAt - PRICING.bundle.price
  return (
    <div className={styles.strip} data-sale-strip data-strip-variant="bundle">
      <Link href="/plugins#bundle" className={styles.stripInner}>
        <span className={styles.stripLabel}>All three plugins</span>
        <span className={styles.stripPrice}>${PRICING.bundle.price}</span>
        <s className={styles.stripWas}>${PRICING.bundle.compareAt}</s>
        <span className={styles.stripSave}>Save ${save}</span>
        <span className={styles.stripArrow} aria-hidden>→</span>
      </Link>
    </div>
  )
}
```

Add the imports this needs: `useState` from react, `Countdown`, and `introWindow` from
`@/lib/plugins`. Update `PluginChrome`'s call site to pass `owned` through from
`usePluginOwnership()`.

The `data-strip-variant` attributes exist so the verify script can assert which branch rendered
rather than matching on prose.

- [ ] **Step 3: Check it renders both ways**

The dev server is usually on :3000 — check with
`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/shft` before starting one.

With `NEXT_PUBLIC_FLTR_INTRO_ENDS` unset, load `/shft`: the strip shows the bundle offer, no
clock. Then set it to a date roughly a month out in `.env.local`, restart the dev server, and
reload: the strip shows the countdown with four blocks. Screenshot both at 1280px and view them —
confirm the 64px strip does not crowd the rail beneath it and the clock reads cleanly on the dark
ground.

- [ ] **Step 4: Commit**

```bash
git add components/PluginChrome.tsx components/plugin-chrome.module.css
git commit -m "feat: fltr intro countdown in the ticker, above the partial-owner nudge"
```

---

### Task 4: The Plugins dropdown

**Files:**
- Create: `components/PluginsMenu.tsx`
- Create: `components/plugins-menu.module.css`
- Modify: `components/SiteNav.tsx` (desktop item around line 144; drawer item around line 273)

**Interfaces:**
- Consumes: `pluginList()`, `PLUGINS`, `PluginId` from `@/lib/plugins`; `PRICING`; `usePluginOwnership()`; `PluginGlyph` from `@/components/plugin-page/PluginGlyph`.
- Produces: `<PluginsMenu active={boolean} className?={string} />` for the desktop nav, and `<PluginsMenuRows onNavigate?={() => void} />` for the mobile drawer.

**Read the house patterns first:** `components/SiteAlertsPopover.tsx`, `components/SiteSettingsMenu.tsx`
and `components/CrateTrackActionsMenu.tsx` already solve open/close, outside-click and escape in
this codebase. Follow their conventions rather than inventing a new one.

**Hover alone excludes keyboard and touch users**, so the trigger is a real button that opens on
hover *and* focus, and the panel is keyboard-navigable.

- [ ] **Step 1: Write `components/PluginsMenu.tsx`**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import PluginGlyph from "@/components/plugin-page/PluginGlyph"
import styles from "@/components/plugins-menu.module.css"
import { pluginList, PLUGINS, type PluginId } from "@/lib/plugins"
import { PRICING } from "@/lib/products"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"

/** The rows themselves, shared by the desktop panel and the mobile drawer. */
export function PluginsMenuRows({ onNavigate }: { onNavigate?: () => void }) {
  const { loading, error, owned, ownedCount } = usePluginOwnership()
  // Until ownership resolves these are plain navigation: no owned marks, and no
  // bundle row, because offering the bundle to an owner sells them what they have.
  const known = !loading && !error

  return (
    <>
      {pluginList().map((p) => {
        const isOwned = known && owned[p.id]
        return (
          <Link
            key={p.id}
            href={isOwned ? "/products" : p.href}
            className={styles.row}
            role="menuitem"
            data-menu-row={p.id}
            style={{ ["--row-accent" as string]: p.accent }}
            onClick={onNavigate}
          >
            <PluginGlyph id={p.id} className={styles.rowGlyph} />
            <span className={styles.rowText}>
              <span className={styles.rowName}>{p.name}</span>
              <span className={styles.rowCategory}>{isOwned ? "owned — download" : p.category}</span>
            </span>
          </Link>
        )
      })}

      {known && ownedCount === 0 && (
        <>
          <span className={styles.divider} role="separator" />
          <Link
            href="/plugins#bundle"
            className={styles.bundleRow}
            role="menuitem"
            data-menu-row="bundle"
            onClick={onNavigate}
          >
            <span className={styles.rowText}>
              <span className={styles.rowName}>all three</span>
              <span className={styles.rowCategory}>every plugin, one price</span>
            </span>
            <span className={styles.bundlePrice}>${PRICING.bundle.price}</span>
          </Link>
        </>
      )}
    </>
  )
}

const CLOSE_DELAY_MS = 120

/** Desktop nav trigger + floating panel. */
export default function PluginsMenu({ active, className = "" }: { active: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()

  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }
  // A short delay so the diagonal travel from trigger to panel does not dismiss it.
  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }, [])

  // Close on route change — the panel must not survive navigation.
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => () => cancelClose(), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus() }
    }
    const onClickAway = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onClickAway)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onClickAway)
    }
  }, [open])

  /** Arrow keys move between rows; Home/End jump to the ends. */
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    const rows = Array.from(
      wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    )
    if (rows.length === 0) return
    const i = rows.indexOf(document.activeElement as HTMLElement)
    if (e.key === "ArrowDown") { e.preventDefault(); rows[(i + 1) % rows.length]?.focus() }
    else if (e.key === "ArrowUp") { e.preventDefault(); rows[(i - 1 + rows.length) % rows.length]?.focus() }
    else if (e.key === "Home") { e.preventDefault(); rows[0]?.focus() }
    else if (e.key === "End") { e.preventDefault(); rows[rows.length - 1]?.focus() }
  }

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onMouseEnter={() => { cancelClose(); setOpen(true) }}
      onMouseLeave={scheduleClose}
      onFocus={() => { cancelClose(); setOpen(true) }}
      onKeyDown={onPanelKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${active ? styles.triggerActive : ""} ${className}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="plugins-menu-panel"
        // On touch the first tap opens rather than navigating.
        onClick={() => setOpen((o) => !o)}
      >
        Plugins
      </button>

      <div
        id="plugins-menu-panel"
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        role="menu"
        aria-label="Plugins"
        data-plugins-menu
        hidden={!open}
      >
        <PluginsMenuRows onNavigate={() => setOpen(false)} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `components/plugins-menu.module.css`**

The panel is chrome, so it uses the constant chrome palette rather than any page theme.

```css
.wrap { position: relative; display: inline-flex; }

.trigger {
  background: none; border: none; cursor: pointer; padding: 0 2px;
  font: inherit; color: inherit;
}
.trigger:focus-visible { outline: 2px solid #a6633c; outline-offset: 3px; border-radius: 3px; }
.triggerActive { font-weight: 600; }

.panel {
  position: absolute; top: calc(100% + 10px); left: 50%; transform: translateX(-50%);
  z-index: 60; min-width: 260px; padding: 8px;
  background: #efe9dc; color: #24211d;
  border: 1px solid rgba(36, 33, 29, 0.16); border-radius: 12px;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.22);
  /* Sans deliberately: globals.css sets a monospace body font sitewide. */
  font-family: var(--font-geist-sans), system-ui, sans-serif;
}

.row, .bundleRow {
  display: flex; align-items: center; gap: 11px;
  padding: 9px 11px; border-radius: 8px; text-decoration: none; color: inherit;
}
.row:hover, .row:focus-visible { background: rgba(36, 33, 29, 0.07); }
.row:focus-visible, .bundleRow:focus-visible { outline: 2px solid var(--row-accent, #a6633c); outline-offset: -2px; }
.rowGlyph { color: var(--row-accent); flex: none; }
.rowText { display: flex; flex-direction: column; min-width: 0; }
.rowName { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.rowCategory {
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase; opacity: 0.6; margin-top: 2px;
}

.divider { display: block; height: 1px; margin: 7px 9px; background: rgba(36, 33, 29, 0.14); }

.bundleRow {
  justify-content: space-between;
  background: linear-gradient(90deg, #a6633c 0%, #d9a040 100%);
  color: #1c140f;
}
.bundleRow .rowName { font-weight: 700; }
.bundleRow .rowCategory { opacity: 0.75; }
.bundlePrice {
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums;
}

@media (max-width: 420px) {
  .panel { min-width: 0; width: calc(100vw - 24px); left: 0; transform: none; }
}
```

- [ ] **Step 3: Wire it into `components/SiteNav.tsx`**

Desktop: replace the `<Link href="/plugins">Plugins</Link>` at roughly line 144 with
`<PluginsMenu active={onPluginPage} className={navLinkBase} />`, keeping the existing
`navLinkStyle` treatment so it still looks like its neighbours.

Mobile drawer: keep the existing `/plugins` link, and render `<PluginsMenuRows onNavigate={closeMenu} />`
directly beneath it, indented, so the drawer expands inline instead of floating a panel. Do not
mount the desktop `PluginsMenu` in the drawer — a hover panel inside a drawer is unreachable.

`onPluginPage` already exists in that file and covers all three plugin routes.

- [ ] **Step 4: Check it by hand before the script**

With the dev server up: hover Plugins and confirm the panel opens; tab to it and confirm it opens
on focus; press Escape and confirm focus returns to the trigger; arrow through the rows. Then
narrow to 375px and confirm the drawer expands inline and the panel never overflows the viewport.
Screenshot the open panel at 1280px and view it.

- [ ] **Step 5: Commit**

```bash
git add components/PluginsMenu.tsx components/plugins-menu.module.css components/SiteNav.tsx
git commit -m "feat: Plugins dropdown covering the range and the bundle"
```

---

### Task 5: Verification

**Files:**
- Create: `scripts/verify-storefront-nav.mjs`

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
// Drives the real nav dropdown and ticker in Chromium.
//
//   npm run dev                     # in another terminal
//   node scripts/verify-storefront-nav.mjs
//
// The intro-countdown checks need NEXT_PUBLIC_FLTR_INTRO_ENDS set to a future
// date in .env.local and the dev server restarted; without it the script checks
// the unset behaviour instead and says so.
import { chromium, devices } from "playwright"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
await page.goto(BASE + "/shft", { waitUntil: "networkidle" })

// --- dropdown ---------------------------------------------------------------
const trigger = page.locator('button[aria-controls="plugins-menu-panel"]')
check("trigger present", await trigger.count() === 1)
check("panel starts closed", await trigger.getAttribute("aria-expanded") === "false")

await trigger.hover()
await page.waitForTimeout(200)
check("opens on hover", await trigger.getAttribute("aria-expanded") === "true")
for (const id of ["shft", "drft", "fltr"]) {
  check(`panel lists ${id}`, await page.locator(`[data-menu-row="${id}"]`).count() === 1)
}
check("panel offers the bundle to a signed-out visitor",
  await page.locator('[data-menu-row="bundle"]').count() === 1)

await page.keyboard.press("Escape")
await page.waitForTimeout(120)
check("Escape closes it", await trigger.getAttribute("aria-expanded") === "false")
check("Escape returns focus to the trigger",
  await page.evaluate(() => document.activeElement?.getAttribute("aria-controls")) === "plugins-menu-panel")

await trigger.focus()
await page.waitForTimeout(150)
check("opens on keyboard focus", await trigger.getAttribute("aria-expanded") === "true")
await page.keyboard.press("ArrowDown")
check("ArrowDown moves into the rows",
  await page.evaluate(() => document.activeElement?.getAttribute("role")) === "menuitem")

// --- ticker -----------------------------------------------------------------
const variant = await page.locator("[data-sale-strip]").getAttribute("data-strip-variant")
const hasClock = await page.locator("[data-countdown]").count() === 1
if (process.env.NEXT_PUBLIC_FLTR_INTRO_ENDS) {
  check("intro set: ticker shows the countdown", variant === "intro", `variant=${variant}`)
  check("intro set: the clock renders", hasClock)
} else {
  console.log("  note  NEXT_PUBLIC_FLTR_INTRO_ENDS unset — checking fallback behaviour")
  check("intro unset: ticker falls back to the bundle", variant === "bundle", `variant=${variant}`)
  check("intro unset: no clock renders", !hasClock)
}

const stripBox = await page.locator("[data-sale-strip]").boundingBox()
check("strip is 64px tall", stripBox && Math.abs(stripBox.height - 64) <= 2, `h=${stripBox?.height}`)
check("no hydration or render errors in console", errors.length === 0, errors.slice(0, 2).join(" | "))
await page.close()

// --- narrow -----------------------------------------------------------------
const mobile = await browser.newPage({ ...devices["iPhone SE"] })
await mobile.goto(BASE + "/shft", { waitUntil: "networkidle" })
check("375px: page does not scroll sideways",
  await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
await mobile.close()

await browser.close()
process.exit(failures.length ? 1 : 0)
```

- [ ] **Step 2: Run it both ways**

With `NEXT_PUBLIC_FLTR_INTRO_ENDS` unset: `node scripts/verify-storefront-nav.mjs` — every check
passes and the fallback branch is exercised.

Then set it to a future date in `.env.local`, restart the dev server, and run again — the intro
branch is exercised instead. Report both runs.

- [ ] **Step 3: Prove the checks can fail**

Temporarily set `NEXT_PUBLIC_FLTR_INTRO_ENDS` to a **past** date and re-run: the ticker must fall
back to the bundle and the strip must carry `data-strip-variant="bundle"`, not `intro`. This is
the branch that proves an expired clock does not strand the ticker. Restore afterwards.

- [ ] **Step 4: Ownership states**

The script runs signed-out. Seed `Purchase` rows against the local database as in the previous
increment's final verification and confirm by hand:

| Owns | Dropdown | Ticker |
|---|---|---|
| nothing | three rows + bundle row | countdown if live, else bundle |
| fltr only | fltr row reads "owned — download", no bundle row | "two left", never the countdown |
| shft only | shft row reads owned, no bundle row | countdown if live, else "two left" |
| all three | three owned rows, no bundle row | no strip at all |

Clean up every seeded row and say so.

- [ ] **Step 5: Full gates**

```
npx tsx --test lib/*.test.ts          # 151
node scripts/verify-plugin-chrome.mjs # 36 — the strip grew, confirm nothing regressed
NODE_OPTIONS=--experimental-strip-types node scripts/verify-plugins-index.mjs   # 11
npx tsx scripts/verify-plugin-pricing.mjs                                       # 7
node scripts/verify-shft-social.mjs
npx tsc --noEmit                      # 0
npm run build                         # exit 0
npm run lint                          # 297, none new
```

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-storefront-nav.mjs
git commit -m "test: verification for the nav dropdown and countdown ticker"
```

---

## Owner actions

- Set `NEXT_PUBLIC_FLTR_INTRO_ENDS` to an ISO date when fltr ships. Until then the countdown never
  renders and the ticker behaves exactly as it does today.
- When that date passes, raise `PRICING.fltr.price` and the Stripe price object **together**.
  Nothing in the code does this for you, deliberately — so the failure mode is a deal running
  long, not a page quoting a price Stripe is not charging.

## Self-review

**Spec coverage.** Intro config and `introWindow` → Task 1. Countdown component, hydration safety
and reduced motion → Task 2. Taller strip and the five-branch order → Task 3. Dropdown, ownership
rules, keyboard and touch, mobile drawer → Task 4. Unit tests, browser checks, ownership matrix →
Tasks 1 and 5. Every spec section maps to a task.

**Type consistency.** `introWindow(now?, raw?)` returns `IntroWindow { endsAt, live }` in Task 1
and is consumed with exactly that shape in Task 3. `<Countdown endsAt onExpire className />` is
defined in Task 2 and called identically in Task 3. `PluginsMenuRows` is a named export and
`PluginsMenu` the default, both used as declared in Task 4. `usePluginOwnership()` is destructured
consistently as `{ loading, error, owned, ownedCount, missing }` everywhere.

**Deliberately not included.** The `/plugins` redirect, the cart, the checkout page and the
interactive hero all belong to specs A and C. `data-strip-variant` is added purely so the verify
script asserts on branch identity rather than prose.
