# shft $19 launch promo — bell notification + `/dig` side pop-up

**Date:** 2026-07-27
**Status:** Approved (design)

## Goal

Promote the shft plugin (one-time purchase, **$19 launch sale, reg. $39**) to visitors on
the SampleRoll **Dig** page (`/dig`) via two surfaces:

1. A **bell notification** in the existing top-nav alerts popover.
2. A **little side pop-up** (non-blocking card) that appears shortly after landing on `/dig`,
   modeled on the existing "Try SampleRoll Pro for 14 days" dock.

Both surfaces are **hidden from users who already own shft**.

## Audience & gating

- Show to **everyone except shft owners** — logged in or out, Pro or free.
- Ownership is determined by the existing endpoint `GET /api/shft/ownership`, which returns
  `{ owned: boolean }` and safely returns `{ owned: false }` for logged-out visitors.
- A small shared client hook `useOwnsShft()` fetches this once and caches the result at
  module level so the popover and the dock don't each refetch.

## Part A — Bell notification (global)

The bell popover ([components/SiteAlertsPopover.tsx](../../../components/SiteAlertsPopover.tsx))
renders static alerts from [lib/site-alerts.ts](../../../lib/site-alerts.ts); dismissals persist
in localStorage. The bell lives in the site nav, so this notification is **site-wide** (not
`/dig`-only) — that is the nature of the bell.

Changes:

- Extend the `SiteAlert` type with optional fields:
  - `href?: string` — link target for a CTA.
  - `ctaLabel?: string` — CTA text.
  - `hideForShftOwners?: boolean` — when true, the alert is filtered out for shft owners.
- Add one alert entry for the shft launch sale, linking to `/shft`, with
  `hideForShftOwners: true`.
- In `SiteAlertsPopover`, when a visible alert has `href`/`ctaLabel`, render a small
  "Get shft →" link. Filter out `hideForShftOwners` alerts when `useOwnsShft()` reports owned.
  (Ownership is only fetched if at least one alert opts in, to avoid a needless request.)

The unread dot behavior is unchanged (dot shows when any non-dismissed alert is visible).

## Part B — `/dig` side pop-up (`ShftPromoDock`)

New component `components/ShftPromoDock.tsx`, mounted in
[components/RootBody.tsx](../../../components/RootBody.tsx) alongside `<ProBonusTrialDock />`.

Behavior:

- **Route:** only `/dig`.
- **Audience:** everyone except shft owners (via `useOwnsShft()`). Not gated by Pro status.
- **Timing:** the card slides in ~5s after landing on `/dig`.
- **Style:** a small **non-blocking** promo card (does NOT cover the page or block digging).
  Copy: headline "shft is here" / subcopy "Launch sale — **$19** ~~$39~~". Primary button
  **"Get shft →"** routes to `/shft` (via `router.push`). A dismiss (×) collapses the card to a
  persistent little side **tab** labeled "shft $19" that reopens the card — mirroring the Try Pro
  dock's modal→docked-tab flow.
- **Position:** the Try Pro tab is on the **left** edge (~`top-38%`); to avoid collision the
  shft dock renders on the **right** edge (card + tab slide in from the right).
- **Persistence:** dismissal state persists in localStorage (own keys, e.g.
  `sampleroll_shft_promo_dismissed_v1`) so it stays collapsed to the tab on subsequent visits.
  Rendered via `createPortal` to `document.body`, like the Try Pro dock.

### CTA action

The "Get shft →" button **navigates to `/shft`** (the landing page), where the existing
`BuyButton` already handles login redirect, Stripe checkout, and the owner "Download" state.
This reuses the full purchase flow and renders/works locally where Stripe checkout is dormant.

## Files

| File | Change |
|------|--------|
| `lib/site-alerts.ts` | Extend `SiteAlert` type; add shft sale alert |
| `lib/use-owns-shft.ts` | **New** — cached `useOwnsShft()` client hook |
| `components/SiteAlertsPopover.tsx` | Render optional CTA link; filter owner-hidden alerts |
| `components/ShftPromoDock.tsx` | **New** — the `/dig` side pop-up |
| `components/shft-promo-dock.module.css` | **New** — styles (shft brand look) |
| `components/RootBody.tsx` | Mount `<ShftPromoDock />` |

## Out of scope

- No changes to the shft checkout / pricing / Stripe env config.
- No browser/OS push notifications (Notification API / service worker).
- No server-side persistence of dismissal (localStorage only, matching existing patterns).

## Local verification

- Run the app; visit `/dig` while logged out (or as a non-owner). After ~5s the shft card
  slides in on the right; dismissing collapses it to a "shft $19" side tab that reopens it.
- Open the bell — the shft sale alert appears with a "Get shft →" link; dismissing it removes it.
- "Get shft →" navigates to `/shft`.
