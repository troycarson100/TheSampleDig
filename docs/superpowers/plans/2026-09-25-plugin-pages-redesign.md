# Plugin Pages Redesign + FLTR Launch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn three unrelated plugin pages into one storefront — a persistent sale strip and sticky plugin rail above every plugin page, shft and drft rebuilt onto a shared template, and a third plugin, FLTR, added and sold.

**Architecture:** A marketing catalog (`lib/plugins.ts`) is the single source of truth for plugin order, copy, theme and art. A chrome component renders the sale strip and rail above every plugin page. A template component family renders all three product pages, themed by CSS custom properties, with each page's content living in a `content.ts` data module. Commerce moves from a two-plugin bundle with a crossgrade to three singles plus an all-three bundle.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, CSS Modules, Prisma, Stripe, Playwright (as plain Node scripts, not a test framework).

**Spec:** `docs/superpowers/specs/2026-09-25-plugin-pages-redesign-design.md`

**Branch:** `feat/plugin-pages-redesign` (already created)

---

## Global Constraints

Every task's requirements implicitly include this section.

### Commerce values — copy these exactly

- shft: price `29`, msrp `49`
- drft: price `29`, msrp `49`
- fltr: price `19`, msrp `49` (introductory price, no announced end date)
- bundle: price `59`, compareAt `147`, msrp `147` — all three plugins
- **`crossgrade` does not exist.** Any identifier named `crossgrade` is to be deleted, never updated.
- Every displayed price reads from `PRICING`. No price literal may appear in JSX or metadata.
- Prices are struck against MSRP, matching the existing house convention.

### Naming

- The third plugin is **`FLTR`** — id `"fltr"`, route `/fltr`, assets under `public/fltr/`.
- The plugin's own UI currently reads `sift`. That is a separate rename, **out of scope**. Do not add code referencing `sift`.
- Plugin display names are lowercase: `shft`, `drft`, `fltr`.

### Visual direction

Derived from the plugins' own front panels, not from the reference site's fashion-serif treatment.

**Palette — three grounds, one house.**

| Token | shft | drft | fltr |
|---|---|---|---|
| `--plugin-ground` | `#efe9dc` | `#e0c69f` | `#0d1117` |
| `--plugin-ink` | `#24211d` | `#1c140f` | `#e6edf3` |
| `--plugin-accent` | `#a6633c` | `#ef1f71` | `#4fd1c5` |
| `--plugin-accent-2` | `#d9a040` | `#d99a2b` | `#8b7fd4` |

Chrome is constant on every page regardless of the page's ground:
`--chrome-ground: #efe9dc`, `--chrome-ink: #24211d`, `--strip-ground: #14110e`, `--strip-ink: #efe9dc`.
Bundle CTA uses the existing house "hot" gradient `linear-gradient(90deg, #a6633c 0%, #d9a040 100%)`.

**Type — no new fonts. Both are already loaded in `app/layout.tsx`.**

| Role | Face | Treatment |
|---|---|---|
| Plugin name (display) | `var(--font-geist-sans)` | weight 800, `letter-spacing: -0.04em`, lowercase, `clamp(3.5rem, 9vw, 7rem)` |
| Eyebrow / label | `var(--font-ibm-mono)` | uppercase, 11px, `letter-spacing: 0.14em` |
| Price / numeric | `var(--font-ibm-mono)` | `font-variant-numeric: tabular-nums` |
| Body | `var(--font-geist-sans)` | 400 / 600, 16–18px |

**Signature — the DSP glyph.** Each plugin's mark is a 16×16 inline SVG drawn from its own signal behaviour, used on the rail pill, plugin card, hero eyebrow and sticky buy bar. `fill: none`, `stroke: currentColor`, `stroke-width: 1.6`, `stroke-linecap: round`.

- shft — a stepped gate: `M0 13 V7 H3 V13 H6 V4 H9 V13 H12 V9 H16`
- drft — torn scanlines: `M0 4 H16 M0 8 H6 M9 9 H16 M0 13 H16`
- fltr — a resonant curve: `M0 11 H5 C7 11 7.4 3 9 3 C10.6 3 11 11 16 13`

**Quality floor, not negotiable, not announced in copy:** responsive to 375px, visible keyboard focus on every interactive element, `prefers-reduced-motion: reduce` disables all glyph and sheen animation.

**Motion budget:** glyphs animate once on mount and on pill hover. Nothing animates ambiently. No scroll-triggered reveals, no parallax.

### Verification convention

Two layers, both already established in this repo.

**Unit tests — `node:test`.** There are 15 existing suites in `lib/*.test.ts` using
`node:test` + `node:assert/strict`. There is no `test` script in `package.json`; they run as:

```bash
npx tsx --test lib/plugin-products.test.ts     # one suite
npx tsx --test lib/*.test.ts                   # all of them
```

Use these for anything that is pure logic: grant maps, pricing invariants, ownership
arithmetic. Follow the existing style exactly — `test("name: what it does", () => { ... })`
with `assert.equal` / `assert.deepEqual`.

**Browser checks — plain Playwright scripts.** For anything that needs a rendered page.
There is no Playwright test runner; the house pattern is a plain Node script, per
`scripts/verify-shft-social.mjs`:

```js
#!/usr/bin/env node
import { chromium } from "playwright"
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}
// ... drive the page ...
process.exit(failures.length ? 1 : 0)
```

Run with the dev server up (`npm run dev`, usually already on :3000).

"Write the failing test" means: prefer a `node:test` suite where the behaviour is pure
logic, and a verify script where it is not. Run it against the unimplemented state first
and watch it fail.

### Entitlements are not the same file as presentation

`lib/plugin-products.ts` already exists as the one source of truth for *what each purchase
grants*, written specifically to survive a third plugin. It must be updated (Task 9), and
`lib/plugins.ts` (Task 1) must not duplicate it:

| File | Answers |
|---|---|
| `lib/plugins.ts` | what a visitor sees — order, copy, theme, art |
| `lib/plugin-products.ts` | what a buyer is granted — `PLUGIN_PRODUCTS`, `PLUGIN_GRANTS`, `PRODUCT_LABEL` |
| `lib/products.ts` | what a buyer downloads — `PRICING`, assets, changelogs |

A unit test in Task 9 asserts the first two hold the same plugin ids, so they cannot drift.

### Definition of done for every task

`npm run lint` passes, and **the checks that task's own steps say should pass, pass.**

Three tasks deliberately leave checks red for a later task to close, and each says so
in its steps — do not treat these as failures:

| Task | Left red | Closed by |
|---|---|---|
| 1 | the two grep gates in `verify-plugin-pricing.mjs` | Task 12 |
| 4 | the `/fltr` checks in `verify-plugin-chrome.mjs` | Task 10 |
| 6 | the fltr card's art 404 | Task 10 |

Every other check in a task must be green before that task is complete. Task 13 is where
everything is green at once.

---

## File Structure

```
lib/plugins.ts                        marketing catalog: order, copy, theme, art. No pricing, no assets.
lib/use-plugin-ownership.ts           client hook wrapping the unified ownership endpoint
lib/products.ts                 MOD   PRICING values; adds the fltr ProductDef (downloads/licensing only)

app/api/plugins/ownership/route.ts    all three products in one response
app/api/fltr/checkout/route.ts        mirrors shft/drft
app/api/bundle/checkout/route.ts MOD  grants three products; partial owners refused
app/api/shft/ownership/route.ts  MOD  drop crossgrade
app/api/drft/ownership/route.ts  MOD  drop crossgrade

components/PluginChrome.tsx           sale strip + sticky rail
components/plugin-chrome.module.css
components/plugin-page/types.ts       PluginContent and its parts
components/plugin-page/PluginGlyph.tsx        the DSP signature mark
components/plugin-page/PluginLanding.tsx      orchestrates one product page from content
components/plugin-page/sections.tsx           Hero, Intro, Blocks, Caps, Faq, Buy
components/plugin-page/BuyButton.tsx          ownership-aware buy control
components/plugin-page/StickyBuy.tsx          sticky purchase bar
components/plugin-page/plugin-page.module.css

app/shft/content.ts   app/drft/content.ts   app/fltr/content.ts     page copy as data
app/shft/ShftLanding.tsx  app/drft/DrftLanding.tsx                  REWRITTEN to thin wrappers
app/fltr/page.tsx  app/fltr/FltrLanding.tsx                         NEW
app/plugins/PluginsStore.tsx                                        REWRITTEN

scripts/verify-plugin-chrome.mjs      rail + strip across all four pages
scripts/verify-plugin-pages.mjs       all three product pages render every section
scripts/verify-plugin-pricing.mjs     grep gate: no price literals, no crossgrade

DELETED: app/offers/OffersView.tsx, app/offers/offers.module.css
```

Responsibility split worth stating: `lib/plugins.ts` is **presentation** (what a visitor sees), `lib/products.ts` is **fulfilment** (what a buyer downloads). They are joined by id and must not absorb each other. `lib/products.ts` is already ~400 lines of changelog prose; adding theme and art to it would make it unreadable.

---

### Task 1: Marketing catalog and new pricing

**Files:**
- Create: `lib/plugins.ts`
- Modify: `lib/products.ts` (the `PRICING` block, currently lines 23–33)

**Interfaces:**
- Consumes: nothing.
- Produces: `PLUGIN_ORDER`, `PluginId`, `PluginMeta`, `PLUGINS`, `pluginList()`. `PRICING` gains `fltr`, loses `crossgrade`, and all values change.

- [ ] **Step 1: Write the failing check**

Create `scripts/verify-plugin-pricing.mjs`. This one is a static check, not a browser check — it greps the tree.

```js
#!/usr/bin/env node
// Guards the pricing invariants from the redesign spec:
//   - no crossgrade identifier survives outside docs/
//   - no price literal is typed into a component or metadata
import { execFileSync } from "node:child_process"

const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

function grep(pattern) {
  try {
    return execFileSync("grep", ["-rn", "-E", pattern, "app", "components", "lib",
      "--include=*.ts", "--include=*.tsx"], { encoding: "utf8" }).trim().split("\n").filter(Boolean)
  } catch { return [] }  // grep exits 1 when there are no matches
}

const cross = grep("crossgrade|Crossgrade|CROSSGRADE")
check("no crossgrade identifiers remain", cross.length === 0, cross.slice(0, 5).join(" | "))

const literals = grep("\\$(19|34|15|39)\\b")
check("no stale price literals remain", literals.length === 0, literals.slice(0, 5).join(" | "))

const { PRICING } = await import("../lib/products.ts")
check("shft is $29 / $49", PRICING.shft.price === 29 && PRICING.shft.msrp === 49)
check("drft is $29 / $49", PRICING.drft.price === 29 && PRICING.drft.msrp === 49)
check("fltr is $19 / $49", PRICING.fltr.price === 19 && PRICING.fltr.msrp === 49)
check("bundle is $59 / $147", PRICING.bundle.price === 59 && PRICING.bundle.compareAt === 147)
check("crossgrade is gone from PRICING", !("crossgrade" in PRICING))

process.exit(failures.length ? 1 : 0)
```

Note: run this with `npx tsx scripts/verify-plugin-pricing.mjs` so the `.ts` import resolves — `tsx` is already a devDependency.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/verify-plugin-pricing.mjs`
Expected: FAIL on every line — crossgrade identifiers exist, `$19`/`$34` literals exist, `PRICING.fltr` is undefined.

- [ ] **Step 3: Update `PRICING` in `lib/products.ts`**

Replace the existing `PRICING` block (and its comments about crossgrade) with:

```ts
// Display prices for the store pages. Stripe charges whatever the price IDs in
// the env are configured to — keep these in sync with the Stripe dashboard.
// Every price is struck against its MSRP, which is the house convention.
export const PRICING = {
  shft: { price: 29, msrp: 49 },
  drft: { price: 29, msrp: 49 },
  // Introductory price with no announced end date. Raised by editing this line.
  fltr: { price: 19, msrp: 49 },
  // All three. Struck against the combined MSRP (3 x $49), like every other
  // price on the site strikes list price — not against the three sale prices.
  bundle: { price: 59, compareAt: 147, msrp: 147 },
} as const
```

There is no crossgrade. An owner of one or two plugins buys the rest at single price.

- [ ] **Step 4: Create `lib/plugins.ts`**

```ts
// Presentation catalog for the plugin range: display order, copy, theme and art.
// Fulfilment (downloads, licence keys, changelogs) lives in lib/products.ts and
// is joined to this by id. Keep the two apart — products.ts is already long, and
// these are different axes of change.

export const PLUGIN_ORDER = ["shft", "drft", "fltr"] as const
export type PluginId = (typeof PLUGIN_ORDER)[number]

export interface PluginMeta {
  id: PluginId
  /** Lowercase, as it is set everywhere on the site. */
  name: string
  /** The line under the name in the hero, e.g. "trance gate". */
  category: string
  /** One sentence. Used on the plugin card and the hero. */
  tagline: string
  href: string
  /** Page ground colour. Drives --plugin-ground. */
  ground: string
  /** Page foreground. Drives --plugin-ink. */
  ink: string
  accent: string
  accent2: string
  art: { card: string; hero: string; heroPoster?: string }
}

export const PLUGINS: Record<PluginId, PluginMeta> = {
  shft: {
    id: "shft",
    name: "shft",
    category: "trance gate",
    tagline: "Sixteen steps chop your audio into living rhythm.",
    href: "/shft",
    ground: "#efe9dc",
    ink: "#24211d",
    accent: "#a6633c",
    accent2: "#d9a040",
    art: { card: "/shft/card.jpg", hero: "/shft/hero-v2.mp4", heroPoster: "/shft/hero-v2-poster.jpg" },
  },
  drft: {
    id: "drft",
    name: "drft",
    category: "vhs / crt fx",
    tagline: "Your sound through a dying tape machine, picture and all.",
    href: "/drft",
    ground: "#e0c69f",
    ink: "#1c140f",
    accent: "#ef1f71",
    accent2: "#d99a2b",
    art: { card: "/drft/field.jpg", hero: "/drft/hero.mp4", heroPoster: "/drft/hero-poster.jpg" },
  },
  fltr: {
    id: "fltr",
    name: "fltr",
    category: "filter in key",
    tagline: "A morphing filter that tunes itself to your track, and plays chords in it.",
    href: "/fltr",
    ground: "#0d1117",
    ink: "#e6edf3",
    accent: "#4fd1c5",
    accent2: "#8b7fd4",
    art: { card: "/fltr/hero.png", hero: "/fltr/hero.png" },
  },
}

/** The plugins in display order. Use this rather than Object.values. */
export function pluginList(): PluginMeta[] {
  return PLUGIN_ORDER.map((id) => PLUGINS[id])
}
```

- [ ] **Step 5: Run the check again**

Run: `npx tsx scripts/verify-plugin-pricing.mjs`
Expected: the four `PRICING` value checks PASS. The two grep checks still FAIL — crossgrade and price literals live in components that later tasks rewrite. That is correct; Task 12 is what turns them green.

- [ ] **Step 6: Commit**

```bash
git add lib/plugins.ts lib/products.ts scripts/verify-plugin-pricing.mjs
git commit -m "feat: marketing catalog for the plugin range, and three-plugin pricing"
```

---

### Task 2: The DSP glyph

The signature mark. One 16×16 SVG per plugin, drawn from that plugin's own signal behaviour: shft's stepped gate, drft's torn scanlines, fltr's resonant curve. Reused on the rail, cards, hero and sticky bar.

**Files:**
- Create: `components/plugin-page/PluginGlyph.tsx`
- Create: `components/plugin-page/plugin-glyph.module.css`

**Interfaces:**
- Consumes: `PluginId` from `lib/plugins.ts`.
- Produces: `<PluginGlyph id={PluginId} size?={number} animate?={boolean} className?={string} />`. Inherits colour from `currentColor`.

- [ ] **Step 1: Write the component**

```tsx
import type { PluginId } from "@/lib/plugins"
import styles from "./plugin-glyph.module.css"

// Each plugin's mark is drawn from what its DSP actually does, so the rail reads
// as three running plugins rather than three coloured dots.
const PATHS: Record<PluginId, string[]> = {
  // A stepped gate — what shft's 16-step sequencer draws.
  shft: ["M0 13 V7 H3 V13 H6 V4 H9 V13 H12 V9 H16"],
  // Scanlines with a dropout tearing the middle one.
  drft: ["M0 4 H16", "M0 8 H6", "M9 9 H16", "M0 13 H16"],
  // A resonant peak and its rolloff — what fltr's hero display draws.
  fltr: ["M0 11 H5 C7 11 7.4 3 9 3 C10.6 3 11 11 16 13"],
}

export default function PluginGlyph({
  id,
  size = 16,
  animate = false,
  className = "",
}: {
  id: PluginId
  size?: number
  animate?: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      className={`${styles.glyph} ${styles[id]} ${animate ? styles.animate : ""} ${className}`}
    >
      {PATHS[id].map((d) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      ))}
    </svg>
  )
}
```

- [ ] **Step 2: Write the stylesheet**

Each plugin animates in the way its own processing behaves: shft's gate steps through, drft's scanlines tear sideways, fltr's curve sweeps its peak. One pass on mount, and again on hover of the enclosing pill. Never ambient.

```css
.glyph { display: block; overflow: visible; }
.glyph path { transform-box: fill-box; }

/* shft: the gate pattern steps through once, left to right. */
.shft.animate path { animation: step 900ms steps(6, end) 1; }
@keyframes step { from { stroke-dasharray: 0 40; } to { stroke-dasharray: 40 0; } }

/* drft: the torn scanline slips and re-seats, like a dropout. */
.drft.animate path:nth-child(3) { animation: tear 700ms ease-out 1; }
@keyframes tear { 0% { transform: translateX(-3px); opacity: 0.3; } 100% { transform: none; opacity: 1; } }

/* fltr: the resonance peak sweeps in. */
.fltr.animate path { animation: sweep 900ms ease-out 1; }
@keyframes sweep { from { stroke-dasharray: 0 30; } to { stroke-dasharray: 30 0; } }

@media (prefers-reduced-motion: reduce) {
  .glyph path { animation: none !important; }
}
```

- [ ] **Step 3: Verify it compiles and renders**

Run: `npm run lint`
Expected: clean. The glyph has no standalone page yet; Task 4 renders it on the rail and is where it is visually checked.

- [ ] **Step 4: Commit**

```bash
git add components/plugin-page/PluginGlyph.tsx components/plugin-page/plugin-glyph.module.css
git commit -m "feat: per-plugin DSP glyph, drawn from what each plugin does"
```

---

### Task 3: Unified ownership endpoint and hook

Three plugins means the current per-plugin fetch pattern would fire three requests on every plugin page. One endpoint, one hook.

**Files:**
- Create: `app/api/plugins/ownership/route.ts`
- Create: `lib/use-plugin-ownership.ts`

**Interfaces:**
- Consumes: `PLUGIN_ORDER`, `PluginId` from `lib/plugins.ts`.
- Produces:
  - `GET /api/plugins/ownership` → `{ signedIn: boolean, owned: Record<PluginId, boolean> }`
  - `usePluginOwnership(): { loading: boolean; signedIn: boolean; owned: Record<PluginId, boolean>; ownedCount: number; missing: PluginId[] }`

- [ ] **Step 1: Write the failing check**

Create `scripts/verify-plugin-ownership.mjs`:

```js
#!/usr/bin/env node
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

const res = await fetch(`${BASE}/api/plugins/ownership`)
check("endpoint responds 200", res.status === 200, `got ${res.status}`)
const body = await res.json().catch(() => null)
check("reports signedIn", body && typeof body.signedIn === "boolean")
check("reports all three products", body?.owned &&
  ["shft", "drft", "fltr"].every((id) => typeof body.owned[id] === "boolean"),
  JSON.stringify(body?.owned))
check("signed-out visitor owns nothing",
  body?.signedIn === false && Object.values(body.owned).every((v) => v === false))

process.exit(failures.length ? 1 : 0)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/verify-plugin-ownership.mjs` (dev server up)
Expected: FAIL — `endpoint responds 200` gets 404.

- [ ] **Step 3: Write the route**

```ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"

// Which plugins does the signed-in visitor own? One request for the whole range —
// the storefront needs all of them on every plugin page, and the per-plugin
// endpoints would mean one round trip each.
export async function GET() {
  const session = await auth()
  const owned = Object.fromEntries(PLUGIN_ORDER.map((id) => [id, false])) as Record<PluginId, boolean>

  if (!session?.user?.id) {
    return NextResponse.json({ signedIn: false, owned })
  }

  const purchases = await prisma.purchase.findMany({
    where: { userId: session.user.id, product: { in: [...PLUGIN_ORDER] } },
    select: { product: true },
  })
  for (const p of purchases) {
    if (p.product in owned) owned[p.product as PluginId] = true
  }

  return NextResponse.json({ signedIn: true, owned })
}
```

- [ ] **Step 4: Write the hook**

```ts
"use client"

import { useEffect, useState } from "react"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"

const NONE = Object.fromEntries(PLUGIN_ORDER.map((id) => [id, false])) as Record<PluginId, boolean>

export interface PluginOwnership {
  loading: boolean
  signedIn: boolean
  owned: Record<PluginId, boolean>
  ownedCount: number
  /** Plugins the visitor does not own, in display order. */
  missing: PluginId[]
}

/**
 * Ownership for the whole plugin range, in one request.
 *
 * `loading` gates every ownership-dependent render. Nothing that depends on
 * ownership may render before it resolves: showing a bundle to someone who owns
 * two of three, even for one frame, offers to sell them what they already have.
 */
export function usePluginOwnership(): PluginOwnership {
  const [owned, setOwned] = useState<Record<PluginId, boolean>>(NONE)
  const [signedIn, setSignedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    fetch("/api/plugins/ownership")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d) return
        setOwned(d.owned)
        setSignedIn(Boolean(d.signedIn))
      })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

  const ownedCount = PLUGIN_ORDER.filter((id) => owned[id]).length
  const missing = PLUGIN_ORDER.filter((id) => !owned[id])
  return { loading, signedIn, owned, ownedCount, missing }
}
```

- [ ] **Step 5: Run the check again**

Run: `node scripts/verify-plugin-ownership.mjs`
Expected: all four PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/plugins/ownership lib/use-plugin-ownership.ts scripts/verify-plugin-ownership.mjs
git commit -m "feat: one ownership endpoint for the whole plugin range"
```

---

### Task 4: The shared chrome — sale strip and sticky rail

The centrepiece. Two bands under `SiteNav` on all four plugin pages, on a constant cream ground regardless of the page's own theme.

```
┌─ SiteNav ──────────────────────────────────────────────────┐
├════════════════════════════════════════════════════════════┤
│  ALL THREE PLUGINS    $59  $̶1̶4̶7̶   SAVE $88            →    │ dark #14110e, scrolls away
├────────────────────────────────────────────────────────────┤
│  ⎍ shft    ⌁ drft    ∿ fltr        ⟨ ALL THREE · $59 → ⟩   │ cream #efe9dc, STICKY
└────────────────────────────────────────────────────────────┘
```

**Files:**
- Create: `components/PluginChrome.tsx`
- Create: `components/plugin-chrome.module.css`

**Interfaces:**
- Consumes: `pluginList()`, `PluginId`, `PLUGINS` from `lib/plugins.ts`; `PRICING` from `lib/products.ts`; `usePluginOwnership()` from `lib/use-plugin-ownership.ts`; `PluginGlyph` from `components/plugin-page/PluginGlyph`.
- Produces: `<PluginChrome active?={PluginId} />`. Rendered directly under `<SiteNav />` by each plugin page.

**The sale strip is ownership-aware, and this is load-bearing.** With crossgrade gone, offering the bundle to someone who owns shft would charge them for shft a second time:

| Owns | Strip |
|---|---|
| loading | reserved height, no content — never guess |
| nothing | `ALL THREE PLUGINS · $59 · $̶1̶4̶7̶ · SAVE $88 →` to bundle checkout |
| exactly one | `TWO LEFT · drft and fltr · $48 →` to `/plugins` (no two-plugin price exists to charge) |
| exactly two | `COMPLETE THE RACK · fltr · $19 →` to that plugin's page |
| all three | strip does not render at all |

The bundle pill in the rail follows the same rule: it renders only when the visitor owns nothing, and is replaced by a quiet `my products →` link otherwise, so the rail's right edge does not jump when ownership resolves.

- [ ] **Step 1: Write the failing check**

Create `scripts/verify-plugin-chrome.mjs`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/verify-plugin-chrome.mjs`
Expected: every check FAILs — no rail exists, and `/fltr` 404s.

- [ ] **Step 3: Write `components/PluginChrome.tsx`**

```tsx
"use client"

import Link from "next/link"
import { useState } from "react"
import PluginGlyph from "@/components/plugin-page/PluginGlyph"
import styles from "@/components/plugin-chrome.module.css"
import { pluginList, PLUGINS, type PluginId } from "@/lib/plugins"
import { PRICING } from "@/lib/products"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"
import { trackMeta } from "@/lib/meta-pixel"

/** Joins names the way a sentence does: "drft and fltr". */
function nameList(ids: PluginId[]): string {
  const names = ids.map((id) => PLUGINS[id].name)
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** The dark offer band. Never offers a visitor something they already own. */
function SaleStrip({ loading, ownedCount, missing }: {
  loading: boolean
  ownedCount: number
  missing: PluginId[]
}) {
  // Owns everything: there is nothing honest to advertise.
  if (!loading && ownedCount === 3) return null

  // Reserve the height while ownership resolves, so the page does not jump.
  if (loading) return <div className={styles.strip} data-sale-strip aria-hidden />

  if (ownedCount === 0) {
    const save = PRICING.bundle.compareAt - PRICING.bundle.price
    return (
      <div className={styles.strip} data-sale-strip>
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

  // Owns one or two. Offer only what is missing, at single price.
  const total = missing.reduce((sum, id) => sum + PRICING[id].price, 0)
  const href = missing.length === 1 ? PLUGINS[missing[0]].href : "/plugins"
  return (
    <div className={styles.strip} data-sale-strip>
      <Link href={href} className={styles.stripInner}>
        <span className={styles.stripLabel}>
          {missing.length === 1 ? "Complete the rack" : "Two left"}
        </span>
        <span className={styles.stripNames}>{nameList(missing)}</span>
        <span className={styles.stripPrice}>${total}</span>
        <span className={styles.stripArrow} aria-hidden>→</span>
      </Link>
    </div>
  )
}

export default function PluginChrome({ active }: { active?: PluginId }) {
  const { loading, ownedCount, missing } = usePluginOwnership()
  const [hovered, setHovered] = useState<PluginId | null>(null)

  return (
    <div className={styles.chrome}>
      <SaleStrip loading={loading} ownedCount={ownedCount} missing={missing} />

      <nav className={styles.rail} data-plugin-rail aria-label="Plugins">
        <ul className={styles.pills}>
          {pluginList().map((p) => {
            const isActive = p.id === active
            return (
              <li key={p.id}>
                <Link
                  href={p.href}
                  className={styles.pill}
                  data-pill={p.id}
                  data-active={isActive ? "true" : "false"}
                  aria-current={isActive ? "page" : undefined}
                  style={{ ["--pill-accent" as string]: p.accent }}
                  onMouseEnter={() => setHovered(p.id)}
                  onMouseLeave={() => setHovered((h) => (h === p.id ? null : h))}
                >
                  <PluginGlyph id={p.id} animate={isActive || hovered === p.id} className={styles.pillGlyph} />
                  <span>{p.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        {!loading && ownedCount === 0 && (
          <Link
            href="/plugins#bundle"
            className={styles.bundlePill}
            data-bundle-pill
            onClick={() => trackMeta("ViewContent", { content_name: "bundle", content_type: "product" })}
          >
            All three · ${PRICING.bundle.price} <span aria-hidden>→</span>
          </Link>
        )}
        {!loading && ownedCount > 0 && (
          <Link href="/products" className={styles.ownedLink}>
            My products <span aria-hidden>→</span>
          </Link>
        )}
      </nav>
    </div>
  )
}
```

- [ ] **Step 4: Write `components/plugin-chrome.module.css`**

The chrome is constant across every page, so it defines its own colours rather than inheriting the page theme. Only `--pill-accent` comes from the plugin.

```css
.chrome {
  --chrome-ground: #efe9dc;
  --chrome-ink: #24211d;
  --strip-ground: #14110e;
  --strip-ink: #efe9dc;
  --hot: linear-gradient(90deg, #a6633c 0%, #d9a040 100%);
}

/* ---- sale strip: scrolls away ---------------------------------------- */
.strip {
  background: var(--strip-ground);
  color: var(--strip-ink);
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stripInner {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; text-decoration: none; color: inherit;
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase;
}
.stripLabel { opacity: 0.85; }
.stripNames { opacity: 0.85; text-transform: none; letter-spacing: 0.04em; }
.stripPrice { font-variant-numeric: tabular-nums; font-weight: 600; }
.stripWas { opacity: 0.5; font-variant-numeric: tabular-nums; }
.stripSave { color: #d9a040; }
.stripArrow { transition: transform 160ms ease; }
.stripInner:hover .stripArrow { transform: translateX(3px); }

/* ---- pill rail: sticky ------------------------------------------------ */
.rail {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--chrome-ground);
  border-bottom: 1px solid rgba(36, 33, 29, 0.14);
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.rail::-webkit-scrollbar { display: none; }

.pills { display: flex; gap: 8px; list-style: none; margin: 0; padding: 0; flex: 1; }

.pill {
  display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;
  padding: 7px 14px; border-radius: 999px; text-decoration: none;
  border: 1px solid rgba(36, 33, 29, 0.22);
  background: transparent; color: var(--chrome-ink);
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 13px; letter-spacing: 0.04em;
  transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
}
.pillGlyph { color: var(--pill-accent); }
.pill:hover { border-color: var(--pill-accent); }
.pill[data-active="true"] {
  background: var(--chrome-ink); color: var(--chrome-ground); border-color: var(--chrome-ink);
}
.pill:focus-visible { outline: 2px solid var(--pill-accent); outline-offset: 2px; }

.bundlePill {
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
  padding: 8px 16px; border-radius: 999px; text-decoration: none;
  background: var(--hot); color: #1c140f; font-weight: 700;
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 13px; letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.bundlePill:focus-visible { outline: 2px solid var(--chrome-ink); outline-offset: 2px; }

.ownedLink {
  white-space: nowrap; text-decoration: none; color: var(--chrome-ink); opacity: 0.7;
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 12px; letter-spacing: 0.08em;
}
.ownedLink:hover { opacity: 1; }

@media (max-width: 520px) {
  .stripInner { gap: 8px; font-size: 11px; padding: 9px 12px; }
  .stripWas, .stripSave { display: none; }
}
```

- [ ] **Step 5: Mount the chrome on the two pages that exist**

In `app/plugins/page.tsx` and `app/shft/page.tsx` and `app/drft/page.tsx`, add directly after `<SiteNav />` inside the header wrapper's sibling position:

```tsx
import PluginChrome from "@/components/PluginChrome"
// ...
<PluginChrome active="shft" />   // omit `active` on /plugins
```

`/fltr` does not exist yet — its chrome check goes green in Task 10.

- [ ] **Step 6: Run the check**

Run: `node scripts/verify-plugin-chrome.mjs`
Expected: `/plugins`, `/shft`, `/drft` PASS every check. `/fltr` still FAILs (404). That is expected until Task 10.

- [ ] **Step 7: Look at it**

Screenshot `/shft` at 1280px and at 375px and view the images. Confirm: the rail reads as one shelf across pages, the active pill is unmistakable, the bundle pill is the loudest thing in the band without being garish, and the glyphs are legible at 16px.

- [ ] **Step 8: Commit**

```bash
git add components/PluginChrome.tsx components/plugin-chrome.module.css \
        app/plugins/page.tsx app/shft/page.tsx app/drft/page.tsx \
        scripts/verify-plugin-chrome.mjs
git commit -m "feat: persistent sale strip and plugin rail above every plugin page"
```

---

### Task 5: The product page template

One component family renders all three product pages. Each page becomes a `content.ts` data module plus `<PluginLanding id content />`. This is what collapses ~900 lines of hand-built page into three thin ones, and what keeps the three consistent as they change.

**Files:**
- Create: `components/plugin-page/types.ts`
- Create: `components/plugin-page/sections.tsx`
- Create: `components/plugin-page/BuyButton.tsx`
- Create: `components/plugin-page/StickyBuy.tsx`
- Create: `components/plugin-page/PluginLanding.tsx`
- Create: `components/plugin-page/plugin-page.module.css`

**Interfaces:**
- Consumes: `PLUGINS`, `PluginId`; `PRICING`; `usePluginOwnership()`; `PluginGlyph`.
- Produces: `PluginContent`, `Media`, `FeatureBlock`, `Capability`, `FaqItem`; `<PluginLanding id={PluginId} content={PluginContent} />`; `<BuyButton id variant />`; `<StickyBuy id />`.

- [ ] **Step 1: Write `components/plugin-page/types.ts`**

```ts
/** A still or a clip. `poster` is required for video so nothing pops in black. */
export interface Media {
  kind: "image" | "video"
  src: string
  poster?: string
  alt: string
}

export interface FeatureBlock {
  title: string
  body: string
  media?: Media
}

export interface Capability {
  title: string
  body: string
}

export interface FaqItem {
  q: string
  a: string
}

/** Everything that differs between one product page and another. */
export interface PluginContent {
  hero: {
    /** Small flag above the name, e.g. "out now". */
    badge: string
    description: string
    media?: Media
  }
  intro: { title: string; body: string; media?: Media }
  blocks: FeatureBlock[]
  caps: { title: string; items: Capability[] }
  faq: FaqItem[]
  buy: { title: string; body: string }
}
```

- [ ] **Step 2: Write `components/plugin-page/BuyButton.tsx`**

Ownership-aware, and it must never offer to sell someone what they own.

```tsx
"use client"

import { useState } from "react"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import { PRICING } from "@/lib/products"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"
import { trackMeta } from "@/lib/meta-pixel"
import styles from "./plugin-page.module.css"

export default function BuyButton({ id, className = "" }: { id: PluginId; className?: string }) {
  const { loading, owned } = usePluginOwnership()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const price = PRICING[id]

  // Never render a purchase control before ownership resolves — offering an
  // owned plugin for sale, even for one frame, is the bug this guards.
  if (loading) return <span className={`${styles.buy} ${styles.buyIdle} ${className}`} aria-hidden />

  if (owned[id]) {
    return (
      <a className={`${styles.buy} ${className}`} href="/products">
        You own {PLUGINS[id].name} — download
      </a>
    )
  }

  const buy = async () => {
    setBusy(true)
    setFailed(false)
    trackMeta("InitiateCheckout", {
      value: price.price, currency: "USD", content_name: id, content_type: "product",
    })
    try {
      const res = await fetch(`/api/${id}/checkout`, { method: "POST" })
      if (res.status === 409) { window.location.reload(); return }
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data?.url === "string") { window.location.href = data.url; return }
    } catch { /* fall through to the failed state */ }
    setFailed(true)
    setBusy(false)
  }

  return (
    <button type="button" className={`${styles.buy} ${className}`} onClick={buy} disabled={busy}>
      {busy ? "…" : failed ? "Opens at launch" : (
        <>Buy · <span className={styles.buyPrice}>${price.price}</span>{" "}
        <s className={styles.buyWas}>${price.msrp}</s></>
      )}
    </button>
  )
}
```

- [ ] **Step 3: Write `components/plugin-page/StickyBuy.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import BuyButton from "./BuyButton"
import PluginGlyph from "./PluginGlyph"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"
import styles from "./plugin-page.module.css"

/** Appears once the hero has scrolled past, so the price is always reachable. */
export default function StickyBuy({ id }: { id: PluginId }) {
  const { loading, owned } = usePluginOwnership()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 640)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (loading || owned[id] || !shown) return null

  return (
    <div className={styles.sticky} data-sticky-buy>
      <span className={styles.stickyName}>
        <PluginGlyph id={id} /> {PLUGINS[id].name}
      </span>
      <BuyButton id={id} className={styles.stickyBtn} />
    </div>
  )
}
```

- [ ] **Step 4: Write `components/plugin-page/sections.tsx`**

```tsx
import PluginGlyph from "./PluginGlyph"
import BuyButton from "./BuyButton"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import type { Capability, FaqItem, FeatureBlock, Media, PluginContent } from "./types"
import styles from "./plugin-page.module.css"

/** Video where we have one, still otherwise, nothing if the asset is absent. */
export function MediaSlot({ media, className = "" }: { media?: Media; className?: string }) {
  if (!media) return null
  if (media.kind === "video") {
    return (
      <video
        className={`${styles.media} ${className}`}
        src={media.src}
        poster={media.poster}
        autoPlay muted loop playsInline
        aria-label={media.alt}
      />
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`${styles.media} ${className}`} src={media.src} alt={media.alt} />
}

export function Hero({ id, hero }: { id: PluginId; hero: PluginContent["hero"] }) {
  const p = PLUGINS[id]
  return (
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>
          <PluginGlyph id={id} animate />
          <span className={styles.badge}>{hero.badge}</span>
          <span className={styles.category}>{p.category}</span>
        </p>
        <h1 className={styles.name}>{p.name}</h1>
        <p className={styles.heroDesc}>{hero.description}</p>
        <div className={styles.heroCta}>
          <BuyButton id={id} />
          <span className={styles.heroMeta}>One-time purchase · free updates</span>
        </div>
      </div>
      <MediaSlot media={hero.media} className={styles.heroMedia} />
    </section>
  )
}

export function Intro({ intro }: { intro: PluginContent["intro"] }) {
  return (
    <section className={styles.intro}>
      <h2 className={styles.introTitle}>{intro.title}</h2>
      <p className={styles.introBody}>{intro.body}</p>
      <MediaSlot media={intro.media} />
    </section>
  )
}

export function Blocks({ blocks }: { blocks: FeatureBlock[] }) {
  return (
    <div className={styles.blocks}>
      {blocks.map((b, i) => (
        <section key={b.title} className={`${styles.block} ${i % 2 === 1 ? styles.blockAlt : ""}`}>
          <div className={styles.blockCopy}>
            <h2 className={styles.blockTitle}>{b.title}</h2>
            <p className={styles.blockBody}>{b.body}</p>
          </div>
          <MediaSlot media={b.media} className={styles.blockMedia} />
        </section>
      ))}
    </div>
  )
}

export function Caps({ caps }: { caps: { title: string; items: Capability[] } }) {
  return (
    <section className={styles.caps}>
      <h2 className={styles.capsTitle}>{caps.title}</h2>
      <ul className={styles.capsGrid}>
        {caps.items.map((c) => (
          <li key={c.title} className={styles.cap}>
            <h3 className={styles.capTitle}>{c.title}</h3>
            <p className={styles.capBody}>{c.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Faq({ faq }: { faq: FaqItem[] }) {
  return (
    <section className={styles.faq}>
      <h2 className={styles.faqTitle}>Questions</h2>
      <dl className={styles.faqList}>
        {faq.map((f) => (
          <div key={f.q} className={styles.faqItem}>
            <dt className={styles.faqQ}>{f.q}</dt>
            <dd className={styles.faqA}>{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function Buy({ id, buy }: { id: PluginId; buy: PluginContent["buy"] }) {
  return (
    <section className={styles.getStarted} id={`${id}-buy`}>
      <h2 className={styles.gsTitle}>{buy.title}</h2>
      <p className={styles.gsBody}>{buy.body}</p>
      <BuyButton id={id} />
    </section>
  )
}
```

- [ ] **Step 5: Write `components/plugin-page/PluginLanding.tsx`**

The theme is applied here, once, as custom properties on the wrapper. Every section stylesheet reads from those, so the same markup renders light shft, warm drft and dark fltr.

```tsx
import { Blocks, Buy, Caps, Faq, Hero, Intro } from "./sections"
import StickyBuy from "./StickyBuy"
import type { PluginContent } from "./types"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import styles from "./plugin-page.module.css"

export default function PluginLanding({ id, content }: { id: PluginId; content: PluginContent }) {
  const p = PLUGINS[id]
  return (
    <main
      className={styles.page}
      data-plugin={id}
      style={{
        ["--plugin-ground" as string]: p.ground,
        ["--plugin-ink" as string]: p.ink,
        ["--plugin-accent" as string]: p.accent,
        ["--plugin-accent-2" as string]: p.accent2,
      }}
    >
      <StickyBuy id={id} />
      <Hero id={id} hero={content.hero} />
      <Intro intro={content.intro} />
      <Blocks blocks={content.blocks} />
      <Caps caps={content.caps} />
      <Faq faq={content.faq} />
      <Buy id={id} buy={content.buy} />
    </main>
  )
}
```

- [ ] **Step 6: Write `components/plugin-page/plugin-page.module.css`**

Type and colour come from Global Constraints. Every section's spacing is defined once here — do not let a later per-plugin stylesheet re-specify section padding, which is how competing selectors start cancelling each other out.

```css
.page {
  background: var(--plugin-ground);
  color: var(--plugin-ink);
  --pad: clamp(20px, 5vw, 64px);
  --measure: 62ch;
}

.hero {
  display: grid; grid-template-columns: 1fr 1fr; gap: clamp(24px, 4vw, 56px);
  align-items: center; padding: clamp(48px, 8vw, 104px) var(--pad);
}
.eyebrow {
  display: flex; align-items: center; gap: 10px; margin: 0 0 20px;
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--plugin-accent);
}
.badge { border: 1px solid currentColor; border-radius: 3px; padding: 3px 7px; }
.category { color: var(--plugin-ink); opacity: 0.6; }

.name {
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  font-weight: 800; letter-spacing: -0.04em; line-height: 0.92;
  font-size: clamp(3.5rem, 9vw, 7rem); margin: 0 0 20px;
}
.heroDesc { font-size: clamp(16px, 1.6vw, 19px); line-height: 1.55; max-width: var(--measure); margin: 0 0 28px; opacity: 0.85; }
.heroCta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.heroMeta {
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.55;
}
.media { width: 100%; height: auto; display: block; border-radius: 10px; }
.heroMedia { box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28); }

.buy {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 13px 22px; border-radius: 999px; border: none; cursor: pointer;
  background: var(--plugin-ink); color: var(--plugin-ground); text-decoration: none;
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 14px; letter-spacing: 0.04em; font-variant-numeric: tabular-nums;
}
.buy:hover { background: var(--plugin-accent); color: var(--plugin-ground); }
.buy:focus-visible { outline: 2px solid var(--plugin-accent); outline-offset: 3px; }
.buy:disabled { opacity: 0.6; cursor: default; }
/* Reserves the button's footprint while ownership resolves. */
.buyIdle { min-width: 170px; min-height: 46px; background: transparent; border: 1px dashed rgba(128,128,128,0.3); }
.buyPrice { font-weight: 700; }
.buyWas { opacity: 0.5; }

.intro { padding: clamp(40px, 6vw, 88px) var(--pad); max-width: 900px; }
.introTitle { font-family: var(--font-geist-sans), system-ui, sans-serif; font-weight: 800; letter-spacing: -0.02em; font-size: clamp(1.8rem, 3.4vw, 2.6rem); margin: 0 0 16px; }
.introBody { font-size: 17px; line-height: 1.6; max-width: var(--measure); opacity: 0.85; margin: 0 0 24px; }

.blocks { display: flex; flex-direction: column; }
.block { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(24px, 4vw, 56px); align-items: center; padding: clamp(36px, 5vw, 72px) var(--pad); }
.blockAlt { direction: rtl; }
.blockAlt > * { direction: ltr; }
.blockTitle { font-family: var(--font-geist-sans), system-ui, sans-serif; font-weight: 800; letter-spacing: -0.02em; font-size: clamp(1.4rem, 2.6vw, 2rem); margin: 0 0 12px; }
.blockBody { font-size: 16px; line-height: 1.6; opacity: 0.82; max-width: var(--measure); margin: 0; }

.caps { padding: clamp(40px, 6vw, 88px) var(--pad); border-top: 1px solid color-mix(in srgb, var(--plugin-ink) 14%, transparent); }
.capsTitle { font-family: var(--font-geist-sans), system-ui, sans-serif; font-weight: 800; letter-spacing: -0.02em; font-size: clamp(1.6rem, 3vw, 2.2rem); margin: 0 0 28px; }
.capsGrid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; }
.capTitle { font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--plugin-accent); margin: 0 0 8px; }
.capBody { font-size: 15px; line-height: 1.55; opacity: 0.82; margin: 0; }

.faq { padding: clamp(40px, 6vw, 88px) var(--pad); border-top: 1px solid color-mix(in srgb, var(--plugin-ink) 14%, transparent); }
.faqTitle { font-family: var(--font-geist-sans), system-ui, sans-serif; font-weight: 800; letter-spacing: -0.02em; font-size: clamp(1.6rem, 3vw, 2.2rem); margin: 0 0 24px; }
.faqList { margin: 0; max-width: 780px; }
.faqItem { padding: 18px 0; border-bottom: 1px solid color-mix(in srgb, var(--plugin-ink) 12%, transparent); }
.faqQ { font-weight: 700; font-size: 16px; margin: 0 0 6px; }
.faqA { font-size: 15px; line-height: 1.6; opacity: 0.8; margin: 0; }

.getStarted { padding: clamp(48px, 7vw, 96px) var(--pad); text-align: center; border-top: 1px solid color-mix(in srgb, var(--plugin-ink) 14%, transparent); }
.gsTitle { font-family: var(--font-geist-sans), system-ui, sans-serif; font-weight: 800; letter-spacing: -0.03em; font-size: clamp(2rem, 4vw, 3rem); margin: 0 0 12px; }
.gsBody { font-size: 16px; line-height: 1.6; opacity: 0.82; max-width: 56ch; margin: 0 auto 24px; }

.sticky {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 45;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 10px clamp(16px, 4vw, 40px);
  background: color-mix(in srgb, var(--plugin-ground) 92%, transparent);
  backdrop-filter: blur(10px);
  border-top: 1px solid color-mix(in srgb, var(--plugin-ink) 16%, transparent);
}
.stickyName {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-ibm-mono), "IBM Plex Mono", monospace;
  font-size: 14px; color: var(--plugin-accent);
}
.stickyBtn { padding: 9px 18px; }

@media (max-width: 860px) {
  .hero, .block { grid-template-columns: 1fr; }
  .blockAlt { direction: ltr; }
}
```

- [ ] **Step 7: Verify it compiles**

Run: `npm run lint`
Expected: clean. Nothing renders the template yet — Task 7 is the first consumer.

- [ ] **Step 8: Commit**

```bash
git add components/plugin-page
git commit -m "feat: shared product page template, themed per plugin"
```

---

### Task 6: Rebuild `/plugins`

**Files:**
- Rewrite: `app/plugins/PluginsStore.tsx` (currently 288 lines, four crossgrade-shaped ownership states)
- Rewrite: `app/plugins/plugins.module.css`
- Modify: `app/plugins/page.tsx` (metadata)

**Interfaces:**
- Consumes: `pluginList()`, `PRICING`, `usePluginOwnership()`, `PluginGlyph`, `PluginChrome`.
- Produces: nothing other tasks depend on.

The four-state crossgrade logic collapses to three honest states:

| Owns | Bundle panel |
|---|---|
| nothing | all three, `$59` struck `$147`, buy the bundle |
| one or two | "Finish the rack" — cards for what is missing, at single price. No bundle button: there is no bundle price that is correct for a partial owner |
| all three | "Every plugin is yours" → link to `/products` |

- [ ] **Step 1: Write the failing check**

Append to `scripts/verify-plugin-chrome.mjs` a `/plugins`-specific section, or create `scripts/verify-plugins-index.mjs`:

```js
#!/usr/bin/env node
import { chromium } from "playwright"
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
await page.goto(BASE + "/plugins", { waitUntil: "networkidle" })

check("bundle panel present", await page.locator("#bundle").count() === 1)
const bundleText = await page.locator("#bundle").innerText()
check("bundle shows $59", bundleText.includes("59"), bundleText.slice(0, 120))
check("bundle strikes $147", bundleText.includes("147"), bundleText.slice(0, 120))
for (const id of ["shft", "drft", "fltr"]) {
  check(`${id} card present`, await page.locator(`[data-plugin-card="${id}"]`).count() === 1)
}
const body = await page.locator("main").innerText()
check("no stale $19 anywhere on the page", !/\$19\b/.test(body))
check("no stale $34 anywhere on the page", !/\$34\b/.test(body))

await browser.close()
process.exit(failures.length ? 1 : 0)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/verify-plugins-index.mjs`
Expected: FAIL — the page still shows the two-plugin `$34` bundle and has no fltr card.

- [ ] **Step 3: Rewrite `PluginsStore.tsx`**

```tsx
"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import PluginGlyph from "@/components/plugin-page/PluginGlyph"
import BuyButton from "@/components/plugin-page/BuyButton"
import styles from "./plugins.module.css"
import { trackMeta } from "@/lib/meta-pixel"
import { pluginList, PLUGINS, type PluginId } from "@/lib/plugins"
import { PRICING } from "@/lib/products"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"

/** Only the canceled state lives here. Success goes to /thanks. */
function CanceledNotice() {
  const [canceled, setCanceled] = useState(false)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("purchase") === "canceled") setCanceled(true)
  }, [])
  if (!canceled) return null
  return <div className={styles.notice}>Checkout canceled — no charge was made. The bundle is here whenever you want it.</div>
}

function BundleButton() {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const buy = async () => {
    setBusy(true); setFailed(false)
    trackMeta("InitiateCheckout", {
      value: PRICING.bundle.price, currency: "USD", content_name: "bundle", content_type: "product",
    })
    try {
      const res = await fetch("/api/bundle/checkout", { method: "POST" })
      if (res.status === 409) { window.location.reload(); return }
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data?.url === "string") { window.location.href = data.url; return }
    } catch { /* fall through */ }
    setFailed(true); setBusy(false)
  }
  return (
    <button type="button" className={styles.bundleBuy} onClick={buy} disabled={busy}>
      {busy ? "…" : failed ? "Opens at launch" : `Get all three · $${PRICING.bundle.price}`}
    </button>
  )
}

function Bundle({ loading, ownedCount, missing }: {
  loading: boolean; ownedCount: number; missing: PluginId[]
}) {
  if (loading) return <section className={styles.bundle} id="bundle" aria-busy="true" />

  if (ownedCount === 3) {
    return (
      <section className={styles.bundle} id="bundle">
        <p className={styles.bundleTag}>The whole rack</p>
        <h2 className={styles.bundleTitle}>Every plugin is yours</h2>
        <p className={styles.bundleSub}>
          Downloads and licence keys live in My Products — take them as many times as you need.
        </p>
        <Link href="/products" className={styles.bundleBuy}>Go to My Products</Link>
      </section>
    )
  }

  if (ownedCount > 0) {
    const total = missing.reduce((sum, id) => sum + PRICING[id].price, 0)
    return (
      <section className={styles.bundle} id="bundle">
        <p className={styles.bundleTag}>Finish the rack</p>
        <h2 className={styles.bundleTitle}>
          {missing.length === 1 ? "One plugin left" : "Two plugins left"}
        </h2>
        <p className={styles.bundleSub}>
          {missing.map((id) => PLUGINS[id].name).join(" and ")} — ${total} for what you are missing.
        </p>
        {/* No bundle button: a partial owner has no bundle price that is correct
            for them, and buying one would charge again for what they own. */}
      </section>
    )
  }

  const save = PRICING.bundle.compareAt - PRICING.bundle.price
  return (
    <section className={styles.bundle} id="bundle">
      <p className={styles.bundleTag}>All three plugins</p>
      <h2 className={styles.bundleTitle}>
        {pluginList().map((p) => p.name).join(" + ")}
      </h2>
      <p className={styles.bundleSub}>
        One chops your sound into rhythm, one drags it through a dying tape machine, and one
        tunes it to your track. Take all three for less than two at list price.
      </p>
      <p className={styles.priceRow}>
        <span className={styles.bigPrice}>${PRICING.bundle.price}</span>
        <s className={styles.wasPrice}>${PRICING.bundle.compareAt}</s>
        <span className={styles.saveBadge}>Save ${save}</span>
      </p>
      <BundleButton />
    </section>
  )
}

export default function PluginsStore() {
  const { loading, ownedCount, missing } = usePluginOwnership()

  return (
    <main className={styles.store}>
      <CanceledNotice />
      <div className={styles.head}>
        <h1 className={styles.title}>Plugins</h1>
        <p className={styles.sub}>
          Instruments of damage, rhythm and key. One-time purchase, free updates, macOS and Windows.
        </p>
      </div>

      <Bundle loading={loading} ownedCount={ownedCount} missing={missing} />

      <div className={styles.cards}>
        {pluginList().map((p) => (
          <article key={p.id} className={styles.card} data-plugin-card={p.id}
            style={{
              ["--card-ground" as string]: p.ground,
              ["--card-ink" as string]: p.ink,
              ["--card-accent" as string]: p.accent,
            }}>
            <Link href={p.href} className={styles.cardMedia} aria-label={`Learn more about ${p.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.cardImg} src={p.art.card} alt={`${p.name} plugin interface`} />
            </Link>
            <div className={styles.cardBody}>
              <p className={styles.cardEyebrow}>
                <PluginGlyph id={p.id} /> {p.category}
              </p>
              <h2 className={styles.cardName}>{p.name}</h2>
              <p className={styles.cardTagline}>{p.tagline}</p>
              <div className={styles.cardRow}>
                <BuyButton id={p.id} />
                <Link href={p.href} className={styles.cardMore}>Learn more →</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Rewrite `plugins.module.css`**

Drop `.cardShft` / `.cardDrft` — cards now theme from the `--card-*` custom properties set inline, so a fourth plugin needs no new CSS. Keep the existing `.store`, `.head`, `.title`, `.sub` rules. Card and bundle rules use `var(--card-ground)`, `var(--card-ink)`, `var(--card-accent)`; the bundle CTA uses the house hot gradient `linear-gradient(90deg, #a6633c 0%, #d9a040 100%)`. Price type: `var(--font-ibm-mono)` with `font-variant-numeric: tabular-nums`.

- [ ] **Step 5: Update the metadata in `app/plugins/page.tsx`**

Interpolate from `PRICING` so no price literal is typed:

```tsx
import { PRICING } from "@/lib/products"

export const metadata: Metadata = {
  title: "Plugins — shft, drft & fltr | Sample Roll",
  description:
    `Sample Roll plugins: shft, the tempo-synced trance gate; drft, the VHS / CRT circuit-bend effect; ` +
    `and fltr, a morphing filter that plays in key. All three for $${PRICING.bundle.price}. ` +
    `VST3 / AU / Standalone.`,
  openGraph: {
    title: "Sample Roll Plugins — shft, drft & fltr",
    description: `All three plugins for $${PRICING.bundle.price}.`,
    images: ["/drft/og.png"],
    type: "website",
  },
  alternates: { canonical: "/plugins" },
}
```

- [ ] **Step 6: Run the check**

Run: `node scripts/verify-plugins-index.mjs`
Expected: all PASS except the `fltr card present` check, which needs `PLUGINS.fltr` art to exist — it will pass as soon as Task 9 lands `public/fltr/hero.png`. If the image 404s the card still renders, so this check should pass now.

- [ ] **Step 7: Commit**

```bash
git add app/plugins scripts/verify-plugins-index.mjs
git commit -m "feat: rebuild the plugins index around the three-plugin bundle"
```

---

### Task 7: shft on the template

**Files:**
- Create: `app/shft/content.ts`
- Rewrite: `app/shft/ShftLanding.tsx` (currently 441 lines) to a thin wrapper
- Modify: `app/shft/page.tsx` (metadata prices)
- Keep: `app/shft/TestimonialMarquee.tsx` and `testimonial-marquee.module.css` — social proof is shft-only and stays as a component the page composes in

**Interfaces:**
- Consumes: `PluginContent` from `components/plugin-page/types`; `PluginLanding`.
- Produces: `SHFT_CONTENT: PluginContent`.

- [ ] **Step 1: Extract the existing copy into `app/shft/content.ts`**

Read the current `ShftLanding.tsx` and move its copy verbatim into the `PluginContent` shape. Do not rewrite the marketing copy — it is tested prose and rewriting it is out of scope. Structure:

```ts
import type { PluginContent } from "@/components/plugin-page/types"

export const SHFT_CONTENT: PluginContent = {
  hero: {
    badge: "out now",
    description: "<the existing heroSubtitle copy>",
    media: { kind: "video", src: "/shft/hero-v2.mp4", poster: "/shft/hero-v2-poster.jpg", alt: "shft running on a drum loop" },
  },
  intro: { title: "Draw a curve on every step", body: "<existing intro copy>" },
  blocks: [ /* each existing block: title, body, media */ ],
  caps: { title: "More than a gate", items: [ /* existing capability items */ ] },
  faq: [ /* existing FAQ entries, with the "$19 launch price" answer reworded to
            interpolate PRICING.shft rather than naming a literal */ ],
  buy: { title: "Get shft", body: "<existing get-started copy>" },
}
```

The FAQ answer that currently reads "The $19 launch price is a limited discount off $39" becomes a template string built from `PRICING.shft.price` and `PRICING.shft.msrp`, and drops the word "limited" — there is no deadline.

- [ ] **Step 2: Rewrite `ShftLanding.tsx`**

```tsx
"use client"

import PluginLanding from "@/components/plugin-page/PluginLanding"
import TestimonialMarquee from "./TestimonialMarquee"
import { SHFT_CONTENT } from "./content"

export default function ShftLanding() {
  return (
    <>
      <PluginLanding id="shft" content={SHFT_CONTENT} />
      <TestimonialMarquee />
    </>
  )
}
```

- [ ] **Step 3: Update `app/shft/page.tsx` metadata** to interpolate `PRICING.shft`, and add `<PluginChrome active="shft" />` under `<SiteNav />` if Task 4 step 5 did not already.

- [ ] **Step 4: Verify**

Run: `node scripts/verify-plugin-chrome.mjs` and screenshot `/shft` at 1280px and 375px, then view them.
Expected: chrome checks pass; every section present; the page reads as shft (cream ground, burnt-orange accent) with the new panel typography.

- [ ] **Step 5: Commit**

```bash
git add app/shft
git commit -m "refactor: shft rebuilt on the shared plugin template"
```

---

### Task 8: drft on the template

Identical in shape to Task 7. drft is the larger job: `DrftLanding.tsx` is 462 lines and carries ~12 crossgrade references, all of which are deleted rather than migrated.

**Files:**
- Create: `app/drft/content.ts`
- Rewrite: `app/drft/DrftLanding.tsx`
- Modify: `app/drft/page.tsx`
- Keep: `app/drft/DrftAbSection.tsx` (388 lines, the A/B audio comparison) and `ab-peaks.json` — drft-only, composed in alongside the template like shft's marquee

**Interfaces:**
- Consumes: `PluginContent`, `PluginLanding`.
- Produces: `DRFT_CONTENT: PluginContent`.

- [ ] **Step 1: Extract copy into `app/drft/content.ts`**, same shape as Task 7, copy verbatim.

Two copy edits required, both forced by decisions in the spec:
- The FAQ answer "The $19 launch price is a limited discount off $39" → interpolate `PRICING.drft`, drop "limited".
- Every crossgrade branch — the `crossgradeOn` FAQ append, the hero's "Own shft? Sign in for the $15 crossgrade" line, and the crossgrade-aware price in `BuyButton` — is **deleted**. `BuyButton` from the template has no crossgrade concept.

- [ ] **Step 2: Rewrite `DrftLanding.tsx`**

```tsx
"use client"

import PluginLanding from "@/components/plugin-page/PluginLanding"
import DrftAbSection from "./DrftAbSection"
import { DRFT_CONTENT } from "./content"

export default function DrftLanding() {
  return (
    <>
      <PluginLanding id="drft" content={DRFT_CONTENT} />
      <DrftAbSection />
    </>
  )
}
```

- [ ] **Step 3: Update `app/drft/page.tsx` metadata** to interpolate `PRICING.drft`.

- [ ] **Step 4: Verify**

Run: `node scripts/verify-plugin-chrome.mjs`, then `grep -rn crossgrade app/drft` — expected: no matches. Screenshot `/drft` at both widths and view.

- [ ] **Step 5: Commit**

```bash
git add app/drft
git commit -m "refactor: drft rebuilt on the shared plugin template, crossgrade removed"
```

---

### Task 9: FLTR entitlements, product definition and checkout

The entitlement layer is where a third plugin is most likely to go quietly wrong — `lib/plugin-products.ts` was written with a comment warning about exactly this. Do this task before the FLTR page.

**Files:**
- Modify: `lib/plugin-products.ts`
- Modify: `lib/duplicate-purchase-alert.ts` (the `GRANT_COUNT` map, line ~61)
- Modify: `lib/products.ts` (add the `fltr` `ProductDef`)
- Create: `app/api/fltr/checkout/route.ts`
- Create: `lib/plugin-products.test.ts`

**Interfaces:**
- Consumes: `PLUGIN_ORDER` from `lib/plugins.ts`.
- Produces: `"fltr"` as a `PluginProduct`; `PLUGIN_GRANTS.bundle === ["shft","drft","fltr"]`; `PRODUCTS.fltr`; `POST /api/fltr/checkout`.

- [ ] **Step 1: Write the failing unit test**

Create `lib/plugin-products.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { PLUGIN_PRODUCTS, PLUGIN_GRANTS, PRODUCT_LABEL, isPluginProduct } from "./plugin-products"
import { PLUGIN_ORDER } from "./plugins"
import { PRICING } from "./products"

test("fltr is a plugin product", () => {
  assert.ok(isPluginProduct("fltr"))
  assert.deepEqual([...PLUGIN_PRODUCTS], ["shft", "drft", "fltr"])
})

test("the bundle grants all three plugins", () => {
  assert.deepEqual([...PLUGIN_GRANTS.bundle], ["shft", "drft", "fltr"])
})

test("every plugin grants exactly itself", () => {
  for (const id of PLUGIN_PRODUCTS) assert.deepEqual([...PLUGIN_GRANTS[id]], [id])
})

test("every sellable thing has a label", () => {
  assert.equal(PRODUCT_LABEL.fltr, "fltr")
  assert.equal(PRODUCT_LABEL.bundle, "shft + drft + fltr")
})

// The guard that stops presentation and entitlements drifting apart.
test("the presentation catalog and the entitlement list hold the same plugins", () => {
  assert.deepEqual([...PLUGIN_ORDER].sort(), [...PLUGIN_PRODUCTS].sort())
})

test("every plugin has a price, and the bundle undercuts buying them singly", () => {
  const singles = PLUGIN_PRODUCTS.reduce((sum, id) => sum + PRICING[id].price, 0)
  assert.ok(PRICING.bundle.price < singles, `bundle ${PRICING.bundle.price} vs singles ${singles}`)
  assert.equal(PRICING.bundle.compareAt, PLUGIN_PRODUCTS.reduce((s, id) => s + PRICING[id].msrp, 0))
})
```

That last assertion is worth having: it proves `$147` really is 3 × `$49` rather than a number someone typed.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test lib/plugin-products.test.ts`
Expected: FAIL — `isPluginProduct("fltr")` is false and `PLUGIN_GRANTS.bundle` has two entries.

- [ ] **Step 3: Update `lib/plugin-products.ts`**

```ts
export const PLUGIN_PRODUCTS = ["shft", "drft", "fltr"] as const
// ...
export const PLUGIN_GRANTS: Record<CompProduct, readonly PluginProduct[]> = {
  shft: ["shft"],
  drft: ["drft"],
  fltr: ["fltr"],
  bundle: ["shft", "drft", "fltr"],
}

export const PRODUCT_LABEL: Record<CompProduct, string> = {
  shft: "shft",
  drft: "drft",
  fltr: "fltr",
  bundle: "shft + drft + fltr",
}
```

`COMP_PRODUCTS` also gains `"fltr"`: `["shft", "drft", "fltr", "bundle"] as const`.

- [ ] **Step 4: Update `GRANT_COUNT` in `lib/duplicate-purchase-alert.ts`**

```ts
const GRANT_COUNT: Record<CompProduct, number> = { shft: 1, drft: 1, fltr: 1, bundle: 3 }
```

Leaving `bundle: 2` here would under-report a fully duplicate bundle purchase in the owner alert. Run `npx tsx --test lib/duplicate-purchase-alert.test.ts` afterwards — if any existing assertion hardcodes a bundle grant of 2, update it to 3, because the behaviour genuinely changed.

- [ ] **Step 5: Add the FLTR `ProductDef` to `lib/products.ts`**

Follow the drft pattern exactly — module-level env-overridable keys with the filename derived via `basename()`, so a new build can never be served under an old filename:

```ts
const FLTR_INSTALLER_KEY = process.env.FLTR_INSTALLER_KEY || "fltr/fltr-1.0.0.pkg"
const FLTR_MANUAL_KEY    = process.env.FLTR_MANUAL_KEY    || "fltr/fltr-manual-v1.0.pdf"
```

```ts
fltr: {
  id: "fltr",
  name: "fltr",
  version: "1.0.0",
  blurb: "Morphing filter that plays in key — macOS (VST3 / AU / Standalone).",
  changelog: [
    { version: "1.0.0", notes: [
      "First release. Twelve filter characters over two cores, with a Shape control that morphs each one's response.",
      "Chord and Harmony turn whatever passes through into a chord in your key, following a root and one of 14 scales.",
      "Four modulation sources — Follow, Move, Draw and Macro — routed by dragging them onto whatever they should move.",
      "The Push layer tunes the filter to the scale, feeds it back into itself, and freezes it.",
      "Your licence key is on this page, just below the download buttons. One key covers 3 machines.",
    ] },
  ],
  assets: [
    { id: "installer", label: "fltr installer — macOS", key: FLTR_INSTALLER_KEY, filename: basename(FLTR_INSTALLER_KEY) },
    { id: "manual", label: "User manual (PDF)", key: FLTR_MANUAL_KEY, filename: basename(FLTR_MANUAL_KEY) },
  ],
},
```

**No Windows installer entry.** Per the spec's open question, FLTR is macOS-only until confirmed otherwise. Adding a Windows asset that does not exist would hand buyers a broken download. If Windows lands, add a third asset and the `WindowsInstallNote` renders itself (`/products` already keys off an asset with id `installer-win`).

- [ ] **Step 6: Write `app/api/fltr/checkout/route.ts`**

Copy `app/api/drft/checkout/route.ts` verbatim and change the product id, the price env var (`STRIPE_FLTR_PRICE_ID`), the `PRICING.fltr.price`, and the `cancelPath` to `/fltr`. Delete any crossgrade branch the source route has — there is no crossgrade.

- [ ] **Step 7: Run the tests**

Run: `npx tsx --test lib/plugin-products.test.ts lib/duplicate-purchase-alert.test.ts`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/plugin-products.ts lib/plugin-products.test.ts lib/duplicate-purchase-alert.ts \
        lib/products.ts app/api/fltr
git commit -m "feat: fltr as a sellable product, granted by the three-plugin bundle"
```

---

### Task 10: The FLTR page

**Files:**
- Create: `app/fltr/page.tsx`
- Create: `app/fltr/FltrLanding.tsx`
- Create: `app/fltr/content.ts`
- Requires: `public/fltr/hero.png` — **supplied by Troy** (the plugin UI screenshot)

**Interfaces:**
- Consumes: `PluginLanding`, `PluginContent`, `PluginChrome`, `PRICING`.
- Produces: the `/fltr` route, which turns the `/fltr` checks in `scripts/verify-plugin-chrome.mjs` green.

- [ ] **Step 1: Write `app/fltr/content.ts`**

Copy comes from the FLTR product brief. Write it in the house voice: plain verbs, sentence case, specific over clever, describing what the thing does rather than selling it.

```ts
import type { PluginContent } from "@/components/plugin-page/types"

const img = (src: string, alt: string) => ({ kind: "image" as const, src, alt })

export const FLTR_CONTENT: PluginContent = {
  hero: {
    badge: "out now",
    description:
      "A filter with twelve characters and a Shape control that morphs each one. Tune it to your key and it stops being a filter you sweep and starts being one that plays.",
    media: img("/fltr/hero.png", "fltr's interface, showing the live filter curve and its five modules"),
  },
  intro: {
    title: "A filter that knows what key you are in",
    body:
      "Twelve characters set what the filter is, from a Moog-style ladder to an SEM, a phaser, a frequency shifter, a tuned comb, vowels. They are level-matched, so moving between them changes the colour and not the volume. Two of them go further: Chord and Harmony turn whatever passes through into a chord in the key you chose.",
  },
  blocks: [
    {
      title: "Twelve characters, one Shape control",
      body:
        "Ladder, SEM, Disperse, Phase, Shift, Comb, Formant, Fold, Liquid, Shatter, Chord and Harmony. Shape morphs each one's response rather than switching between presets of it, so a character is a place to start and not a fixed setting.",
    },
    {
      title: "Chord and Harmony play in key",
      body:
        "Chord snaps the input's partials to the notes of a chord. Harmony rings that chord through a resonator bank. Both follow a root and one of 14 scales, including one you edit from the keyboard, and a wheel picks the degree from I to VII and glides between them. Pull moves Chord from snapping notes onto the chord to bending them towards it, Wave swaps the bell-like sine partials for triangle, square or saw, and Arp plays the chord one note at a time in nine patterns, in time with your session.",
    },
    {
      title: "Two cores, six ways to wire them",
      body:
        "Run the two filter cores as Single, Series, Parallel, Split L/R, Split M/S or Band, and give each ear its own filter with Width. Drive adds soft, transistor or fold saturation before or after the filter, oversampled at 1x, 2x or 4x, with auto-gain holding the output where it was.",
    },
    {
      title: "Modulation you drag where you want it",
      body:
        "Four sources run on every sample: Follow, an envelope follower on the input or the sidechain; Move, an LFO, free or in time; Draw, a 32-step sequencer that follows the playhead over one to eight bars; and Macro, one hand control. There is no matrix. Drag a source onto the pad, a display, a footer or the Mix control and a depth chip appears there; drag the chip sideways to set how far it goes. Cutoff modulation is measured in semitones, up to four octaves, so a given depth is the same musical distance wherever the filter is sitting.",
    },
    {
      title: "Push",
      body:
        "Six things the filter can do past filtering, each on its own tab. Tune snaps the cutoff to the nearest note of the scale and can follow MIDI. Keytrack moves it with the notes you play. Feedback sends the output back through a short delay and a saturator, where Comb rings, Spiral climbs or falls forever, and Bloom blurs into a wash. FM modulates the cutoff at audio rate. Smear blurs transients. Freeze holds the sound where it is.",
    },
    {
      title: "It draws what it is doing",
      body:
        "The interface redraws about thirty times a second from the processor itself, not from your settings. When modulation moves the filter, the curve you set is drawn as a ghost behind the curve you are hearing, so you can see the difference. Presets are plain files in a folder — move them, share them, keep them in version control.",
    },
  ],
  caps: {
    title: "The rest of it",
    items: [
      { title: "Formats", body: "VST3, AU and a standalone app." },
      { title: "Platform", body: "macOS, as a universal binary for Apple silicon and Intel." },
      { title: "Quality", body: "Live, Studio, High and Ultra trade latency against resolution, so you can track on one setting and mix on another." },
      { title: "Scales", body: "14 scales plus one you edit yourself from the on-screen keyboard." },
      { title: "OTT", body: "A one-knob three-band compressor, in the box." },
      { title: "Licence", body: "One key covers three machines. Deactivate one here to free the slot." },
    ],
  },
  faq: [
    {
      q: "Is it a subscription?",
      a: `No. fltr is a one-time purchase with free updates — buy it once and keep it. $${PRICING.fltr.price} is its introductory price, off a list price of $${PRICING.fltr.msrp}.`,
    },
    {
      q: "Does it run on Windows?",
      a: "Not yet. fltr ships for macOS at launch, as a universal binary for Apple silicon and Intel Macs.",
    },
    {
      q: "Do I need to play the chords myself?",
      a: "No. Chord and Harmony build the chord from whatever you feed them — a pad, a vocal, a drum loop — following the root and scale you set. You can drive the degree by hand from the wheel, sequence it with Draw, or leave it where it is.",
    },
    {
      q: "Will it stay in time with my session?",
      a: "Yes. Move, Draw and the arp all sync to the host tempo, and Draw follows the playhead so the same bar sounds the same on every pass.",
    },
  ],
  buy: {
    title: "Get fltr",
    body: "One-time purchase, free updates, three machines per licence.",
  },
}
```

Note the `PRICING` import at the top of that file: `import { PRICING } from "@/lib/products"`.

- [ ] **Step 2: Write `app/fltr/FltrLanding.tsx`**

```tsx
"use client"

import PluginLanding from "@/components/plugin-page/PluginLanding"
import { FLTR_CONTENT } from "./content"

export default function FltrLanding() {
  return <PluginLanding id="fltr" content={FLTR_CONTENT} />
}
```

- [ ] **Step 3: Write `app/fltr/page.tsx`**

Mirror `app/drft/page.tsx`, with the chrome mounted:

```tsx
import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import PluginChrome from "@/components/PluginChrome"
import FltrLanding from "./FltrLanding"
import { PRICING } from "@/lib/products"

export const metadata: Metadata = {
  title: "fltr — Morphing Filter That Plays In Key | Sample Roll",
  description:
    `fltr is a morphing filter with twelve characters over two cores, four drag-routed modulation ` +
    `sources, and a Push layer that tunes it to a scale, feeds it back into itself and freezes it. ` +
    `Chord and Harmony turn what passes through into a chord in your key. $${PRICING.fltr.price}. ` +
    `VST3 / AU / Standalone for macOS.`,
  openGraph: {
    title: "fltr — a filter that plays in key",
    description: "Twelve characters, two cores, and a chord engine that follows your key.",
    images: ["/fltr/hero.png"],
    type: "website",
  },
  alternates: { canonical: "/fltr" },
}

export default function FltrPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="site-header w-full shrink-0">
        <SiteNav />
      </header>
      <PluginChrome active="fltr" />
      <FltrLanding />
    </div>
  )
}
```

- [ ] **Step 4: Confirm the art is in place**

`public/fltr/hero.png` must exist. If it does not, the page still renders — `MediaSlot` degrades — but do not close this task without it.

- [ ] **Step 5: Run the checks**

Run: `node scripts/verify-plugin-chrome.mjs` and `node scripts/verify-plugins-index.mjs`
Expected: every check passes now, `/fltr` included.

- [ ] **Step 6: Look at it**

Screenshot `/fltr` at 1280px and 375px and view them. The dark ground must not fight the cream rail above it — the rail should read as a shelf the page hangs from. Check the teal accent has enough contrast on `#0d1117` for the eyebrow and capability labels.

- [ ] **Step 7: Commit**

```bash
git add app/fltr public/fltr
git commit -m "feat: the fltr product page"
```

---

### Task 11: The bundle grants three, and refuses partial owners

**Files:**
- Modify: `app/api/bundle/checkout/route.ts`
- Create: `lib/bundle-eligibility.ts`
- Create: `lib/bundle-eligibility.test.ts`

**Interfaces:**
- Consumes: `PLUGIN_PRODUCTS` from `lib/plugin-products.ts`.
- Produces: `bundleEligibility(ownedIds: string[]): { ok: boolean; reason?: "already_owned" | "partial_owner"; owns: string[] }`

The guard logic is pulled into its own module so it can be unit tested without Stripe or Prisma — the same reason `lib/plugin-checkout-logic.ts` exists.

- [ ] **Step 1: Write the failing test**

Create `lib/bundle-eligibility.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { bundleEligibility } from "./bundle-eligibility"

test("a visitor who owns nothing may buy the bundle", () => {
  assert.deepEqual(bundleEligibility([]), { ok: true, owns: [] })
})

test("an owner of all three is refused as already_owned", () => {
  const r = bundleEligibility(["shft", "drft", "fltr"])
  assert.equal(r.ok, false)
  assert.equal(r.reason, "already_owned")
})

test("an owner of one is refused as a partial owner, and told what they own", () => {
  const r = bundleEligibility(["drft"])
  assert.equal(r.ok, false)
  assert.equal(r.reason, "partial_owner")
  assert.deepEqual(r.owns, ["drft"])
})

test("an owner of two is refused as a partial owner", () => {
  // The case that would otherwise charge a second time for two owned plugins.
  const r = bundleEligibility(["shft", "fltr"])
  assert.equal(r.ok, false)
  assert.equal(r.reason, "partial_owner")
})

test("unrelated products are ignored", () => {
  assert.equal(bundleEligibility(["pro-subscription"]).ok, true)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test lib/bundle-eligibility.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write `lib/bundle-eligibility.ts`**

```ts
import { PLUGIN_PRODUCTS, type PluginProduct } from "./plugin-products"

export interface BundleEligibility {
  ok: boolean
  reason?: "already_owned" | "partial_owner"
  owns: PluginProduct[]
}

/**
 * May this visitor buy the all-three bundle?
 *
 * Only someone who owns none of it. There is no bundle price that is correct for
 * a partial owner — charging them the bundle would charge again for what they
 * already have — and with the crossgrade retired there is no discounted price to
 * offer instead. They buy the singles they are missing.
 */
export function bundleEligibility(ownedIds: readonly string[]): BundleEligibility {
  const owns = PLUGIN_PRODUCTS.filter((id) => ownedIds.includes(id))
  if (owns.length === PLUGIN_PRODUCTS.length) return { ok: false, reason: "already_owned", owns: [...owns] }
  if (owns.length > 0) return { ok: false, reason: "partial_owner", owns: [...owns] }
  return { ok: true, owns: [] }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx --test lib/bundle-eligibility.test.ts`
Expected: 5 PASS.

- [ ] **Step 5: Rewrite the guard in `app/api/bundle/checkout/route.ts`**

Replace the existing two-plugin ownership block (which returns `own_one` and points at the crossgrade) with:

```ts
import { bundleEligibility } from "@/lib/bundle-eligibility"
import { PLUGIN_PRODUCTS } from "@/lib/plugin-products"
// ...
if (buyer) {
  const owned = await prisma.purchase.findMany({
    where: { userId: buyer.id, product: { in: [...PLUGIN_PRODUCTS] } },
    select: { product: true },
  })
  const eligibility = bundleEligibility(owned.map((p) => p.product))
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.reason, owns: eligibility.owns }, { status: 409 })
  }
}
```

Update the route's header comment: the bundle is now three products, and partial owners are refused rather than redirected to a crossgrade.

The client side already handles this — `BundleButton` and `BuyButton` both reload on 409, and the reloaded page renders the partial-owner state from Task 6.

- [ ] **Step 6: Commit**

```bash
git add lib/bundle-eligibility.ts lib/bundle-eligibility.test.ts app/api/bundle/checkout/route.ts
git commit -m "feat: the bundle covers three plugins and refuses partial owners"
```

---

### Task 12: Retire crossgrade and the offers page

The cleanup that turns the two red checks from Task 1 green.

**Files:**
- Modify: `app/api/shft/ownership/route.ts`, `app/api/drft/ownership/route.ts`
- Create: `app/offers/page.tsx` (replaced with a redirect)
- Delete: `app/offers/OffersView.tsx`, `app/offers/offers.module.css`
- Modify: `components/SiteNav.tsx`
- Modify: `components/ShftPromoDock.tsx`

- [ ] **Step 1: Run the pricing gate to see what is left**

Run: `npx tsx scripts/verify-plugin-pricing.mjs`
Expected: the two grep checks FAIL, listing exactly what remains. Work that list.

- [ ] **Step 2: Drop `crossgrade` from both ownership routes**

In each, delete the `const crossgrade = Boolean(process.env.STRIPE_*_CROSSGRADE_PRICE_ID)` line, remove it from both JSON responses, and delete the comment explaining it. The routes keep working — `/shft` and `/drft` no longer read them, but leaving them serving the same `{ owned, signedIn }` shape avoids breaking anything not yet migrated.

- [ ] **Step 3: Replace `/offers` with a redirect**

`/offers` existed to surface the crossgrade. With it gone the page has no offers to show, and a permanent "No offers right now" screen is a dead end. Delete `OffersView.tsx` and `offers.module.css`, and replace `app/offers/page.tsx` entirely with:

```tsx
import { redirect } from "next/navigation"

// /offers existed to surface the $15 crossgrade. That offer is retired — singles
// and the three-plugin bundle are the whole story now, and both live on /plugins.
// Kept as a redirect rather than deleted: the URL is in sent email.
export default function OffersPage() {
  redirect("/plugins")
}
```

Keep the route so old links in already-sent email still land somewhere useful.

- [ ] **Step 4: Add `/fltr` to the nav's active state**

`components/SiteNav.tsx` lines ~142 and ~277 light the Plugins link for `/plugins`, `/shft` and `/drft`. Both need `/fltr`. Rather than a fourth hardcoded comparison, import the catalog:

```tsx
import { pluginList } from "@/lib/plugins"
// ...
const onPluginPage = isActive("/plugins") || pluginList().some((p) => isActive(p.href))
```

Use `onPluginPage` in both places. A fifth plugin then needs no nav edit.

- [ ] **Step 5: Retire the stale shft price alert in `lib/site-alerts.ts`**

The alert with id `shft-launch-sale-19` (around line 30) advertises "launch sale $19 (reg.
$39) — a limited launch discount". Every number in it is now wrong, and it is shown live in
the site alerts popover.

Replace it with an alert announcing the range, keeping the same object shape. Give it a
**new id** — ids are how dismissal is remembered, so reusing `shft-launch-sale-19` would
hide the new alert from everyone who dismissed the old one:

```ts
{
  id: "three-plugin-bundle",
  publishedAt: "<the date this ships>",
  title: `All three plugins — $${PRICING.bundle.price}`,
  body: `shft, drft and fltr together for $${PRICING.bundle.price}, against $${PRICING.bundle.compareAt} at list price.`,
  href: "/plugins",
  ctaLabel: "See the plugins",
},
```

Drop `hideForShftOwners` — it is a shft-only flag and this alert is about the range. If the
file has no import of `PRICING`, add one. Check whether any other entry in the file quotes
a price; the grep gate in Step 6 is what proves it.

- [ ] **Step 6: Fix the stale price in `ShftPromoDock.tsx`**

The dock's copy names the old `$19`. Interpolate `PRICING.shft.price` instead. While here, check the dock's own comment block, which describes it as the "shft $19 launch promo".

- [ ] **Step 7: Run the gate**

Run: `npx tsx scripts/verify-plugin-pricing.mjs`
Expected: **all checks PASS**, including both greps. This is the task's real deliverable —
if a grep still reports a hit, that hit is a stale price or crossgrade reference somewhere
this list did not anticipate. Fix it rather than narrowing the grep.

- [ ] **Step 8: Commit**

```bash
git add -A app/offers app/api/shft app/api/drft components/SiteNav.tsx \
           components/ShftPromoDock.tsx lib/site-alerts.ts
git commit -m "refactor: retire the crossgrade offer and the stale launch pricing"
```

---

### Task 13: Full verification

Nothing new is built here. This is the gate before the branch is considered done.

- [ ] **Step 1: Unit tests**

Run: `npx tsx --test lib/*.test.ts`
Expected: every suite passes, including the pre-existing 15.

Note on `plugin-checkout-logic.test.ts`: it passes prices to `checkoutUrls()` as literal
arguments and never reads `PRICING`, so the price change does not affect it. If it fails,
that is a real regression, not a figure needing updating.

`duplicate-purchase-alert.test.ts` is the one that genuinely changes, because
`GRANT_COUNT.bundle` went from 2 to 3 in Task 9.

- [ ] **Step 2: Browser checks**

```bash
npm run dev            # in another terminal
node scripts/verify-plugin-chrome.mjs
node scripts/verify-plugins-index.mjs
node scripts/verify-plugin-ownership.mjs
npx tsx scripts/verify-plugin-pricing.mjs
node scripts/verify-shft-social.mjs     # pre-existing; shft was rebuilt, so re-run it
```
Expected: all exit 0.

- [ ] **Step 3: Ownership states**

The verify scripts only cover the signed-out case. Sign in as the local admin account and check by hand, per the project's usual approach to account-dependent pages:

| State | Expected |
|---|---|
| owns nothing | bundle strip, bundle pill, bundle panel, three buyable cards |
| owns one | "two left" strip, no bundle pill, "Finish the rack" panel, owned card shows Download |
| owns two | "complete the rack" strip naming the one missing plugin |
| owns all three | no strip, "My products" link in the rail, "Every plugin is yours" panel |

The owns-two case is the one worth being careful about: it is the state that would previously have offered a bundle that re-charged for two owned plugins.

- [ ] **Step 4: Build and lint**

```bash
npm run lint
npm run build
```
Expected: both clean.

- [ ] **Step 5: Accessibility and motion floor**

- Tab through `/plugins` and one product page: every pill, buy control and link takes visible focus.
- Set the OS to reduce motion, reload `/fltr`: glyphs do not animate.
- Confirm no page scrolls horizontally at 375px.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "test: verification pass for the plugin storefront redesign"
```

---

## Before this branch merges

From the spec's launch checklist — these are Troy's, not the implementer's, and the release is held for them:

- [ ] FLTR Phase 5 complete (A/B, undo, CI)
- [ ] `public/fltr/hero.png` in the repo
- [ ] FLTR installer built and uploaded; `FLTR_INSTALLER_KEY` set
- [ ] `STRIPE_FLTR_PRICE_ID` created and set
- [ ] Stripe bundle price updated to $59
- [ ] Stripe shft and drft prices raised to $29
- [ ] Windows question answered — if FLTR ships on Windows, add the `installer-win` asset and update the capabilities block and FAQ
- [ ] `sift` → `FLTR` rename inside the plugin UI (separate work)

---

## Self-review

**Spec coverage.** Chrome → Task 4. Template → Task 5. `/plugins` → Task 6. shft → 7. drft → 8. FLTR page → 10. FLTR commerce → 9. Pricing → 1. Bundle → 11. Crossgrade removal and `/offers` → 12. Unified ownership → 3. Verification → 13. The signature glyph, which the spec did not name but the visual direction requires → Task 2. No spec section is unimplemented.

**Corrections made during writing.** The Global Constraints originally claimed this repo has no test framework. It has 15 `node:test` suites run via `npx tsx --test`; the constraints and Tasks 9 and 11 were rewritten to use real unit tests for the logic layer. Task 9 also grew to cover `lib/plugin-products.ts` and `lib/duplicate-purchase-alert.ts`, which the spec's file map missed — they are the actual entitlement source of truth, and a third plugin that skipped them would grant the wrong products from comp codes and under-count duplicate bundle purchases.

**Type consistency.** `PluginId` is defined once in `lib/plugins.ts` and imported everywhere. `PLUGIN_ORDER` (presentation) and `PLUGIN_PRODUCTS` (entitlement) are separate lists held in step by an assertion in `lib/plugin-products.test.ts`. `PluginContent` and its parts are defined in Task 5 and consumed unchanged by Tasks 7, 8 and 10. `usePluginOwnership()` returns the same shape everywhere it is used. `bundleEligibility()` is the only new function crossing a task boundary, and its signature is fixed in Task 11's interface block.

**Known non-blocking gap.** `/plugins` cards and the hero render a plugin's art by path; if `public/fltr/hero.png` is absent the page renders without it rather than failing. That is deliberate, and Task 10 Step 4 refuses to close without the file.
