# Meta Pixel integration

**Date:** 2026-07-28
**Status:** Approved (design)

## Goal

Add the Meta (Facebook) Pixel to the site: a site-wide base pixel that fires
`PageView`, plus standard conversion events at the key funnel points. The pixel
must be dormant (load nothing) until a Pixel ID is configured, load without a new
consent banner (matching the site's current AdSense posture), and track PageViews
across App Router client-side navigations — not just the initial load.

## Decisions (from brainstorming)

- **Events:** `PageView` (all pages) + `Purchase` (shft), `Subscribe` (Pro),
  `Lead` (prelaunch signup). `CompleteRegistration` was **not** selected.
- **Pixel ID:** env var `NEXT_PUBLIC_META_PIXEL_ID`; dormant/no-op when unset.
- **Coverage:** site-wide, **no** consent gate/banner (matches AdSense, which
  already loads without one). Add a privacy/cookies disclosure line.

## Architecture

### 1. `lib/meta-pixel.ts` (new)

- `META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID` (string | undefined).
- `isMetaPixelEnabled: boolean` = `Boolean(META_PIXEL_ID)`.
- `type MetaStandardEvent = "PageView" | "Purchase" | "Subscribe" | "Lead"`.
- `trackMeta(event, params?)`: calls `window.fbq("track", event, params)` guarded
  by `typeof window`, `isMetaPixelEnabled`, and `typeof window.fbq === "function"`.
  No-ops (never throws) when the pixel is disabled or not yet loaded.
- A minimal `Window.fbq` type declaration so calls are typed without `any`.

### 2. `components/analytics/MetaPixel.tsx` (new, client)

- Returns `null` when `!isMetaPixelEnabled`.
- When enabled, loads the standard Meta base snippet via `next/script`
  (`strategy="afterInteractive"`, `id="meta-pixel-base"`): the `fbq` bootstrap,
  `fbq("init", META_PIXEL_ID)`, and `fbq("track", "PageView")` (initial load).
- Includes the `<noscript>` `<img height="1" width="1" .../>` fallback.
- SPA PageViews: a `usePathname()` effect fires `trackMeta("PageView")` on each
  path change **after** the first (a ref skips the initial run so the base
  snippet's PageView isn't double-counted). Uses `usePathname()` only — not
  `useSearchParams()` — to avoid forcing a Suspense/CSR bailout on every route.
- Mounted in `app/layout.tsx` inside `<body>` (above `RootBody`) so it covers
  every route, including the prelaunch/coming-soon splash pages that `RootBody`
  short-circuits.

### 3. Conversion events

| Event | Location | Trigger | Payload |
|-------|----------|---------|---------|
| `Purchase` | `app/shft/ShftLanding.tsx` (`PurchaseBanner`) | `?purchase=success` | `{ value: 19, currency: "USD", content_name: "shft", content_type: "product" }` — fired before the redirect to `/products` |
| `Subscribe` | `app/dig/page.tsx` | `?checkout_success=1` | `{ value, currency: "USD" }`, value from `?plan` (monthly 5.99 / yearly 49.99) |
| `Lead` | `app/prelaunch/PrelaunchContent.tsx` | successful signup response | `{ content_name: "prelaunch" }` |

Supporting change: append `&plan=${plan}` to the Pro `success_url` in
`app/api/stripe/checkout/route.ts` so the dig page can attribute the right value.
If `plan` is absent/unrecognized, fire `Subscribe` with `currency` only (no value).

Purchase value note: uses the **$19 launch price** as a constant. If shft pricing
changes, update the constant (or later pass the real amount from `/api/shft/claim`).

### 4. Env

Add `NEXT_PUBLIC_META_PIXEL_ID=""` to `.env.example`. The real ID goes in
`.env.local` (local) and the hosting env (prod).

### 5. Privacy disclosure

Add a short line to the `/cookies` page (`app/cookies/CookiesPageBody.tsx`) noting
that the site uses the Meta/Facebook pixel for advertising measurement.

## Out of scope

- Server-side Conversions API (CAPI) / event deduplication via `eventID`.
- A cookie-consent banner or consent-gated loading.
- `CompleteRegistration` and `InitiateCheckout` events.
- Advanced matching (hashed email/phone).
- Wiring a `Lead` event for the shft waitlist (no UI form calls
  `/api/shft/waitlist` today; add later when a form exists).

## Verification

With a real `NEXT_PUBLIC_META_PIXEL_ID` in `.env.local`:

- Every page loads `fbq` and fires a single `PageView`; navigating between routes
  fires one additional `PageView` per navigation (verify via requests to
  `https://www.facebook.com/tr?...` or the Meta Pixel Helper extension).
- The shft success page fires `Purchase` (value 19); the Pro success on `/dig`
  fires `Subscribe`; a prelaunch signup fires `Lead`.
- With the env var unset, no Meta script loads and `trackMeta` calls no-op.
