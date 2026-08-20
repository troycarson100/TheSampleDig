# drft store launch — landing page, /plugins storefront, bundle & crossgrade

**Date:** 2026-08-20
**Status:** Approved (brainstormed with Troy)

## Overview

Add drft (VHS/CRT circuit-bend audio effect, second Sample Roll plugin) to
sampleroll.com:

1. A drft landing page at `/drft` — same skeleton as `/shft`, themed CRT-dark.
2. A `/plugins` storefront page listing shft, drft, and a bundle; the nav
   "Plugins" link points there instead of `/shft`.
3. Bundle + crossgrade commerce on the existing Stripe one-time-purchase stack.

drft is ~95% done and will be sellable within days of these pages shipping.
Everything is built fully sale-ready; the existing dormant-checkout pattern
(Buy button falls back to "Opens at launch" until the Stripe price env vars are
set) covers the gap. Architecture is clone-and-retheme: drft gets its own page
and API routes mirroring shft's, no restructuring of the live shft page.

## Pricing (single source of truth: `lib/products.ts`)

| Item | Price | Struck / context |
| --- | --- | --- |
| shft | $19 | $39 MSRP (unchanged) |
| drft | $19 | $39 MSRP |
| Bundle (shft + drft) | $34 | struck $38 (sum of sale prices); "$78 MSRP" as secondary context; limited time |
| Crossgrade (own one, buy the other) | $15 | struck $19; symmetric both directions; $19 + $15 = $34 = bundle |

Display prices come from a `PRICING` export in `lib/products.ts`. Stripe price
IDs stay in env vars (existing pattern):
`STRIPE_DRFT_PRICE_ID`, `STRIPE_BUNDLE_PRICE_ID`,
`STRIPE_DRFT_CROSSGRADE_PRICE_ID`, `STRIPE_SHFT_CROSSGRADE_PRICE_ID`.
No end-date logic for "limited time" — turned off manually, same as shft's
launch price.

## drft landing page (`/drft`)

### Structure (mirrors `/shft`)

- `app/drft/page.tsx` — server component: SEO metadata, SiteNav, renders
  `DrftLanding`.
- `app/drft/DrftLanding.tsx` — client component.
- `app/drft/drft.module.css` — all theming.

Sections top to bottom: full-bleed video hero → intro → alternating feature
blocks → capabilities grid → FAQ → final "Get drft" CTA. Plus the sticky buy
bar (IntersectionObserver on a hero sentinel) and the purchase success/cancel
banner, both cloned from shft. No reels/testimonial sections at launch (no
social proof exists yet); skeleton keeps them easy to add later.

### Theme — CRT dark, "page as the device"

Palette from the plugin's own chassis tokens (`Source/ui/UiTokens.h` in the
CRTV repo):

- Background: warm charcoal `#191714`; panels `#221f1a`; seam `#0a0908`.
- Headings: cream `#efe9dc`. Body: silk `#a89c86`, dim `#6e6557`.
- Accents: LED green `#7fae4a` (interactive highlights), LED amber `#d99a2b`
  (sale price), LED red `#c8402e` (blinking REC dot motif).
- Textures: faint scanline overlay + vignette on hero and screenshots, subtle
  phosphor glow on headings.
- Type: Geist for body (site font); monospace OSD-style for eyebrows, section
  labels, and small chrome (timecode/tracking-line motifs).

### Hero

Troy is producing a video banner. It drops in as `public/drft/hero.mp4` +
poster jpg, full-bleed with scanline scrim — same mechanics as shft's hero
video. Until it lands, a placeholder poster rendered from the real plugin via
`trak_snapshot` (CRTV repo tool). Overlay: drft wordmark, one-line subtitle,
Buy button ($19 struck $39), platform line "One-time purchase - macOS &
Windows - VST3 / AU / Standalone".

### Feature blocks (screenshots/clips via `trak_snapshot` / `TRAK_RECORD`)

1. **The tube** — load a video (or live camera) and the picture plays through
   the effect on a true-16:9 CRT.
2. **Five character knobs** — bend, drift, burn, wash, drop.
3. **Dropouts** — picture and sound tear together (audio↔visual lock).
4. **Feed** — the picture drives the sound.
5. **REC** — export what you see and hear as a real MP4.

Capabilities grid (6 tiles): tape speed, dice, presets, bass mono, video sync,
power switch.

### FAQ

- What is drft?
- Formats/DAWs: macOS (VST3 / AU / Standalone) + Windows (VST3 / Standalone),
  mirroring shft's phrasing.
- Subscription? No — one-time purchase, free updates; $19 launch price is a
  limited discount off $39.
- Does it need video? No — works as a pure audio effect; video/camera is
  optional.

### Buy flow

Identical mechanics to shft: `BuyButton` posts to `/api/drft/checkout`;
401 → login redirect with callback; 409 → `/products`; success URL claims via
`/api/drft/claim` then redirects to `/products`; ownership check via
`/api/drft/ownership` swaps the button to "You own drft — Download". The page
also fetches `/api/shft/ownership`: if the visitor owns shft, buy buttons here
show the $15 crossgrade price (struck $19) instead of $19. The shft landing
page gets the symmetric change — a drft owner sees $15 there.

## `/plugins` storefront page

- Nav: both "Plugins" links in `components/SiteNav.tsx` (desktop + mobile
  drawer) change from `/shft` to `/plugins`; active state keys off
  `/plugins`, `/shft`, and `/drft` so the tab stays lit on product pages.
- Chrome: site-consistent (SiteNav, current site styling). The page is the
  neutral shelf; each product card carries its own art (shft paper/cream,
  drft CRT-dark).
- Two large product cards: name, one-liner, price $19 struck $39, "Learn
  more" → landing page, direct Buy button (same checkout APIs).
- Bundle banner below: "shft + drft — $34" struck $38, "$78 MSRP" secondary,
  limited-time tag, Buy button → `/api/bundle/checkout`.

### Ownership-aware states (page fetches both ownership endpoints)

| State | Cards | Bundle banner |
| --- | --- | --- |
| Own neither | Buy $19 each | Bundle $34 |
| Own one | Owned card → "You own X — Download" (→ `/products`); other card shows $15 crossgrade | Swaps to crossgrade offer: "Complete the pair — get {other} for $15" (struck $19) |
| Own both | Both → Download | "You own everything" → `/products` |

## Commerce backend

### New API routes (cloned from shft's)

- `app/api/drft/checkout` — product `"drft"`; same affiliate cookie +
  attribution metadata handling; dormant (503) until env vars set.
- `app/api/drft/claim`, `app/api/drft/ownership` — mirrors.
- `app/api/bundle/checkout` — one line item, `STRIPE_BUNDLE_PRICE_ID`,
  `metadata.product = "bundle"`.

### Crossgrade (server-side price selection)

Each product checkout route checks whether the user owns the *other* plugin;
if so it uses the $15 crossgrade price ID instead of the regular one. No
coupons, nothing client-controlled — ownership verified against `Purchase` at
checkout-session creation.

### Bundle guard rails

`/api/bundle/checkout` returns 409 if the user owns both (client → `/products`)
or owns either one (client refreshes to the crossgrade state). No server-side
path can double-charge.

### Webhook (`app/api/stripe/webhook/route.ts`)

The hardcoded `metadata.product === "shft"` branch generalizes to a product
map: `"shft"` → grant shft; `"drft"` → grant drft; `"bundle"` → grant both.
Each grant upserts `Purchase` (never regenerating an existing license key,
same as today) and mints a key via `generateLicenseKey()`. Grants skip nothing
on bundle — upsert semantics make an already-owned product a no-op that keeps
its key. The purchase confirmation email becomes product-aware (name, download
copy) instead of hardcoded shft; bundle purchases get one email covering both
keys.

### `lib/products.ts`

- Add drft `ProductDef`: id `drft`, version `1.0.0`, blurb, macOS + Windows
  installer assets (+ manual if one ships), initial changelog entry.
  `/products` downloads then work with zero page changes.
- Add `PRICING` export (table above) consumed by `/drft`, `/shft`, and
  `/plugins` for all displayed prices and strike-throughs.
- `scripts/upload-shft-release.mjs` gets a drft counterpart (or a
  product-arg generalization) for uploading installers to the bucket.

## Assets (`public/drft/`)

- Screenshots + short clips rendered from the real plugin (`trak_snapshot`,
  `TRAK_RECORD`) for feature blocks.
- Placeholder hero poster (plugin render) until Troy's `hero.mp4` lands.
- drft wordmark: cropped from a plugin render, or Troy's logo file if he has
  one.
- OG image for `/drft` and `/plugins`.

## SEO & analytics

- Full metadata + OpenGraph on `/drft` and `/plugins`; canonical URLs; both
  routes added to `app/sitemap.ts`.
- Meta pixel `Purchase` events: value 19 (single), 34 (bundle), 15
  (crossgrade), with `content_name` per product — fired from the purchase
  banner on whichever page handled the success redirect, same as shft.

## Verification

- `next build` and lint clean.
- Manual state walkthrough with checkout dormant: logged out, logged in
  unowned, own-one (crossgrade prices everywhere), own-both.
- Buy-flow smoke test once Stripe prices exist (test mode).

## Out of scope / follow-ups

- Pointing `ShftPromoDock` (dig page promo) at the bundle.
- Reels/testimonials sections on `/drft` once social proof exists.
- Any end-date automation for the limited-time bundle.
