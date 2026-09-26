# Storefront navigation and ticker

Date: 2026-09-26
Branch: `feat/plugin-pages-redesign` (continues the plugin storefront redesign)
Spec 1 of 3 in the second increment.

## Where this sits

The storefront redesign shipped a sticky plugin rail and an ownership-aware sale strip
above every plugin page. Comparing it against audio-spices.com surfaced three more pieces
of work, which are separate subsystems and get separate specs:

| | Scope | State |
|---|---|---|
| **B** | Plugins hover dropdown, taller ticker, real countdown | **this spec** |
| **A** | Cart sidebar, checkout page with sign-in or account creation, `/plugins` → `/shft` | next |
| **C** | Interactive hotspot hero per plugin, video loop moved below | last |

**`/plugins` is deliberately NOT redirected here.** The cart is what gives the bundle a
home; redirecting before it exists would leave the `$59` CTA pointing at a single plugin's
page. The redirect belongs to spec A.

## Goal

Split two jobs currently duplicated in one band. Today the ticker and the rail both
advertise the bundle. The ticker takes the newest plugin's introductory price with a real
countdown; the rail keeps the bundle. And the "Plugins" nav item gains a dropdown so the
whole range is reachable from anywhere on the site, not just from plugin pages.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Countdown target | FLTR's introductory price ending | It is the only genuinely time-limited price. shft and drft are at their standing $29 |
| At zero | Clock disappears, ticker falls back to the bundle offer | Stripe's price object cannot be flipped by a date in code. The site must never quote a price it is not charging |
| Price rise | Manual, by the owner, `PRICING.fltr` and Stripe together | The worst case becomes a deal that runs long, not a mispriced checkout |
| Deadline source | Configuration, unset by default | FLTR's launch is gated on its Phase 5 and has no date yet |
| Dropdown content | Three plugins, a divider, the bundle | Matches the reference's structure |
| Ownership | Dropdown obeys the same rules as the strip and rail | One rule everywhere: never offer someone what they own |

## What changes

### 1. Intro-price configuration — `lib/plugins.ts`

```ts
/** When fltr's introductory price ends, as an ISO date. Unset until fltr ships:
 *  its launch is gated on Phase 5, so there is no date to hardcode. Setting it
 *  is what turns the countdown on. */
export const FLTR_INTRO_ENDS: string | null = process.env.NEXT_PUBLIC_FLTR_INTRO_ENDS ?? null

export interface IntroWindow {
  /** The deadline, or null when unset or unparseable. */
  endsAt: Date | null
  /** True only when a valid deadline exists and is still in the future. */
  live: boolean
}

export function introWindow(now: Date = new Date()): IntroWindow
```

`introWindow` is pure and the only place the date is interpreted. An unset, malformed or
past date all resolve to `live: false`, which is what makes the ticker fall back rather
than render a dead clock.

`NEXT_PUBLIC_` prefix because the countdown ticks on the client.

### 2. The clock — `components/Countdown.tsx`

A dumb component: given a target `Date`, render days / hours / minutes / seconds as
number-over-label blocks. It decides nothing about what the ticker says.

Two requirements that are easy to miss:

- **Hydration.** A time computed during SSR will not match the client's first render.
  The component renders a fixed-width placeholder until mounted, then starts ticking.
  No `Date.now()` may influence server output.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` it updates once a minute and
  omits the seconds block, rather than repainting every second.

It clears its interval on unmount and stops ticking at zero rather than counting negative.

### 3. The ticker — `components/PluginChrome.tsx`

`.strip` grows from `min-height: 40px` to `64px` to hold the clock. The label and price
keep the established mono treatment; the countdown numerals are mono with
`tabular-nums`, so the clock does not jitter as digits change.

The existing ownership rules gain one branch. **Evaluation order matters and is part of
the contract** — written in any other order, an expired clock would fall through to the
bundle offer for a partial owner, who cannot be sold a bundle:

| # | Condition | Ticker |
|---|---|---|
| 1 | ownership loading or failed | reserved-height placeholder, nothing offered |
| 2 | owns all three | no strip |
| 3 | does not own fltr **and** `introWindow().live` | the fltr countdown |
| 4 | owns one or two | existing "complete the rack" / "N left" behaviour |
| 5 | owns nothing | the existing bundle offer |

Branch 3 sits above branch 4 deliberately: a visitor who owns shft but not fltr sees the
countdown rather than the "two left" nudge while the intro price is live, because only the
fltr price is genuinely time-limited. When the clock expires they fall to branch 4 and get
the nudge back. A visitor who owns fltr never reaches branch 3 at all.

The countdown branch reads:
`NEW · FLTR INTRO PRICE · $19 · $̶4̶9̶ · [clock] · GET FLTR →`, linking to `/fltr`,
with both prices from `PRICING.fltr`.

When the clock reaches zero the component re-evaluates and falls through to whichever of
branches 4 and 5 applies to that visitor, without a reload.

### 4. The dropdown — `components/PluginsMenu.tsx`

Opens from the existing "Plugins" item in `SiteNav`. Rows are built from `pluginList()`,
so a fourth plugin needs no edit here: each row is its `PluginGlyph` in the plugin's
accent, its name, and its category. A divider, then the bundle row in the house gradient
(`linear-gradient(90deg, #a6633c 0%, #d9a040 100%)`).

**Ownership, consistent with every other surface:** an owned plugin's row is marked owned
and links to `/products` instead of its sales page; the bundle row renders only for a
visitor who owns nothing. While ownership is loading or failed, rows render as plain
navigation with no owned marks and no bundle row — never a purchase offer on unknown
ownership.

**Accessibility.** Hover alone excludes keyboard and touch users, so:

- the trigger is a `button` with `aria-expanded` and `aria-controls`
- opens on hover **and** on focus; closes on `Escape`, on blur leaving the panel, and on
  route change
- `ArrowDown` / `ArrowUp` move between rows, `Home` / `End` jump to the ends
- a short close delay on mouse-out so the diagonal travel to the panel does not dismiss it
- on touch, the first tap opens the panel rather than navigating
- the panel is `role="menu"`, rows are `role="menuitem"`

**Mobile.** The existing drawer expands the Plugins entry inline into the same rows rather
than floating a panel.

### 5. Reuse, not duplication

`PluginsMenu` and `PluginChrome` both need "which plugins, and does this visitor own
them". Both already have it: `pluginList()` and `usePluginOwnership()`, whose module-level
cache means the second consumer costs no extra request. Neither piece gets its own copy of
the ownership rules — the "never offer what they own" decision stays expressed once per
surface, reading from the same hook.

## Verification

**Unit (`node:test`, run as `npx tsx --test lib/plugins.test.ts`):** `introWindow` across
unset, malformed, future and past dates, and the boundary at exactly the deadline.

**Browser (`scripts/verify-storefront-nav.mjs`, following the house Playwright pattern):**

1. Dropdown opens on hover and on keyboard focus; `Escape` closes it and returns focus to
   the trigger.
2. It contains all three plugins with the right categories, and the bundle row.
3. Arrow keys move between rows.
4. With `NEXT_PUBLIC_FLTR_INTRO_ENDS` set to a future date, the ticker shows the countdown
   and its four blocks; with it unset, the ticker shows the bundle offer.
5. With it set to a past date, the ticker shows the bundle offer and no clock.
6. The strip is 64px and the rail still sticks.
7. No hydration warning appears in the console on any plugin page.
8. At 375px the dropdown does not overflow the viewport and the drawer expands inline.

**Ownership states** are exercised by seeding `Purchase` rows against the local database,
as in the previous increment's final verification: confirm the bundle row disappears for a
partial owner and the countdown yields to "complete the rack" for an fltr owner.

## Out of scope

The `/plugins` redirect, the cart, the checkout page, and the interactive hero. Each
belongs to spec A or C.

## Owner actions

- Set `NEXT_PUBLIC_FLTR_INTRO_ENDS` when FLTR ships. Until then the countdown never renders
  and the ticker behaves exactly as it does today.
- When that date passes, raise `PRICING.fltr.price` and the Stripe price object together.
  Nothing in the code does this for you, deliberately.
