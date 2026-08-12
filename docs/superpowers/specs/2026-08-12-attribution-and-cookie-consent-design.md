# Traffic attribution + cookie consent — Design

**Date:** 2026-08-12
**Status:** Approved by Troy (geo-gated consent, landing events + user/sale stamping, admin readout)
**Builds on:** `2026-07-28-meta-pixel-design.md`, `2026-08-11-shft-affiliate-program-design.md`

## Overview

On 2026-08-11 five shft sales landed between 3:35 and 4:02 PM PT. Four of the five buyers created an
account 1–2 minutes before paying — cold, pre-sold traffic from an unknown source. None of it was
traceable: the app captures no referrer and no UTM parameters anywhere, and the `users` table has no
source column. The only attribution that exists is the affiliate `shft_ref` cookie, which none of the
five had.

This design adds first-touch attribution capture (referrer + UTM), stamps it onto the user and the
Stripe session, logs every landing so traffic bursts are visible even when visitors do not convert,
and puts the result behind an admin page. It also adds the cookie consent banner the site currently
lacks, geo-gated so the Meta Pixel keeps full coverage in the US while EU/UK visitors get a real
choice.

Decisions: **first-touch, never overwritten** (the question is what originally found them);
**geo-gated consent** — notice-only in the US, hard gate in the EU/UK, unknown country treated as
EU; **landing events for all visitors**, not just converters; **admin page** rather than a CLI script.

## Schema (1 new table, 5 new columns)

New `LandingEvent` — one row per new visitor, no PII:

| Field | Type | Notes |
|---|---|---|
| `id` | String @id @default(cuid()) | |
| `visitorId` | String @unique @map("visitor_id") | random id, mirrored in the `sr_vid` cookie |
| `referrer` | String? | raw `document.referrer` |
| `referrerHost` | String? @map("referrer_host") | parsed host, the grouping key |
| `utmSource` | String? @map("utm_source") | |
| `utmMedium` | String? @map("utm_medium") | |
| `utmCampaign` | String? @map("utm_campaign") | |
| `utmContent` | String? @map("utm_content") | |
| `utmTerm` | String? @map("utm_term") | |
| `landingPath` | String @map("landing_path") | pathname only, no query string |
| `country` | String? | `CF-IPCountry` header |
| `createdAt` | DateTime @default(now()) @map("created_at") | |

Indexes: `[createdAt]`, `[referrerHost, createdAt]`. Maps to `landing_events`.

New columns on `User`, a denormalized first-touch snapshot:

- `attributionVisitorId` — `String? @map("attribution_visitor_id")`, indexed
- `attributionReferrerHost` — `String? @map("attribution_referrer_host")`
- `attributionUtmSource` — `String? @map("attribution_utm_source")`
- `attributionUtmCampaign` — `String? @map("attribution_utm_campaign")`
- `attributionLandingPath` — `String? @map("attribution_landing_path")`

Snapshotting rather than always joining `LandingEvent` matches the existing schema philosophy —
`AffiliateReferral.commissionCents` is snapshotted at sale time so later rate changes never rewrite
history. Attribution is likewise a historical fact, and the snapshot survives any future pruning of
`landing_events`.

`Purchase` gets no new columns. One-time purchases are tied to a user, and first-touch attribution
lives on the user, so the admin page joins through `User`.

**Migration note:** the `_prisma_migrations` history for this project was repaired on 2026-08-11.
Create the migration with `prisma migrate dev` locally and let it deploy normally; do not hand-edit
migration history or re-run older backfills.

## Cookies

| Cookie | httpOnly | Max age | Purpose |
|---|---|---|---|
| `sr_vid` | yes | 60 days | visitor id, dedupes landing events, links signup to first touch |
| `sr_consent` | **no** | 180 days | `granted` \| `denied`; must be JS-readable to gate the pixel client-side |

60 days on `sr_vid` mirrors the existing `shft_ref` window. `sr_vid` and `shft_ref` are independent
and never read each other: `shft_ref` stays last-click-wins for affiliate fairness, `sr_vid` stays
first-touch.

## New module: `lib/attribution.ts`

Pure, dependency-free helpers so the logic is verifiable in isolation:

- `parseUtm(search: string): UtmParams` — pulls the five `utm_*` keys from a query string
- `referrerHost(referrer: string | null): string | null` — parses host, returns `null` for
  same-origin and unparseable values so internal navigation never registers as a referrer
- `isStrictConsentRegion(country: string | null | undefined): boolean` — EU/EEA + UK list; returns
  `true` for `null`/unknown

## New module: `lib/consent.ts`

Cookie name constants, the `ConsentState` type (`"granted" | "denied" | "unset"`), and a
`readConsent()` client helper.

## Capture flow

`components/AttributionCapture.tsx` mounts in the root layout beside `AffiliateRefCapture`. Once per
tab session (guarded by `sessionStorage`) it POSTs `{ referrer, search, path }` to
`/api/attribution/landing`.

`app/api/attribution/landing/route.ts`:

1. If the `sr_vid` cookie is already present, skip the insert — first touch is already recorded.
2. Otherwise parse UTMs and referrer host, read `CF-IPCountry`, generate a visitor id, insert the
   `LandingEvent`, and set `sr_vid`.
3. Always respond `{ region: "strict" | "notice" }` — including on the skip path in step 1 — so the
   consent banner can resolve region from this same request rather than a second round trip.

The resolved region is cached in `sessionStorage` next to the post-guard. The guard suppresses the
POST after the first call in a tab, so without the cache a banner mounting on a later navigation
would have no region and no way to get one. Banner and capture component read the same cached value.

Bot handling: skip when the client reports `navigator.webdriver`, and skip obvious bot user agents
server-side. This is noise reduction, not security — some bot rows will get through and that is
acceptable.

## Consent flow

Region is resolved client-side, deliberately **not** by calling `headers()` in the root layout.
`/shft` is currently served `cf-cache-status: HIT`; reading headers in a root layout forces every
page dynamic and would destroy that caching. The `/api/attribution/landing` response carries the
region instead.

On boot the banner reads `sr_consent`:

- `granted` → load the pixel, no banner
- `denied` → no pixel, no banner
- `unset` → resolve region, then:
  - `notice` → load the pixel immediately, show a dismissible bar. The pixel is not conditional on
    the dismissal; writing `granted` only suppresses the bar on later visits.
  - `strict` → withhold the pixel, show Accept / Reject; Accept writes `granted` and loads the
    pixel without a reload, Reject writes `denied`

`components/analytics/MetaPixel.tsx` becomes consent-gated, including its `<noscript>` fallback
image, which must not render before consent in strict regions.

`components/CookieBanner.tsx` is a bottom-fixed bar styled with the existing `theme-vinyl` CSS
variables (`--background`, `--foreground`, `--primary`), linking to the existing `/cookies` and
`/privacy` pages.

`/cookies` gains a "Manage cookie preferences" button that clears `sr_consent` and reopens the
banner. Consent is currently irrevocable, which is not acceptable in a strict region.

**Consent scope:** the Meta Pixel is the only non-essential cookie on the site today and the only
thing gated. Auth cookies remain ungated as strictly necessary. `sr_vid` and `shft_ref` remain
ungated as first-party identifiers that are never shared with a third party.

## Stamping touch points

All three wrapped in try/catch and logged on failure — attribution must never block a signup or a
sale.

| File | Change |
|---|---|
| `app/api/auth/register/route.ts` | read `sr_vid`, look up the `LandingEvent`, write the snapshot onto the new `User` |
| `app/api/shft/checkout/route.ts` | add `attrSource`, `attrReferrer`, `attrCampaign` to session metadata |
| `app/api/stripe/checkout/route.ts` | same metadata; this route has no attribution at all today |

Putting attribution in Stripe metadata means the source is visible on the payment in the Stripe
dashboard, independent of this app's database.

## Admin readout

`app/admin/attribution/page.tsx`, a server component behind the existing `isAdmin` helper from
`lib/admin.ts`, mirroring the structure of `app/admin/affiliates/page.tsx`. Date range via
searchParams, default last 7 days. All times rendered in `America/Los_Angeles`.

Three tables:

1. **Top referrer hosts** — landings, signups, sales, revenue
2. **Top UTM source / campaign** — same columns
3. **Sales in range** — time (PT), buyer email, product, referrer host, UTM source, landing path

## Error handling

- Landing insert failures are caught and logged; the visitor sees nothing.
- A missing or unparseable `CF-IPCountry` resolves to `strict`, erring toward the safer consent
  posture.
- If `/api/attribution/landing` fails outright, the banner falls back to `strict` and the pixel does
  not load. Losing pixel data is the acceptable failure; loading it without consent is not.
- Stamping failures leave the attribution columns null. Signup and checkout proceed normally.

## Verification

The repo has no test runner — no config, no spec files, and `playwright` is a dependency used for
scraping. This design does not add one.

- Pure helpers in `lib/attribution.ts` and `lib/consent.ts` exercised with a throwaway script
  covering: UTM parsing, same-origin referrers returning `null`, unparseable referrers, and
  EU/US/unknown country classification
- `npx tsc --noEmit`
- Lint on changed files only, with `--max-old-space-size=4096` — a full-repo `npm run lint` OOMs
- Manual dev-server pass: landing with a fake referrer and UTMs writes one row and only one row
  across navigations; banner renders correctly in both regions; **the pixel makes no network request
  before consent in a strict region**, verified in the network tab; a real signup lands the snapshot;
  a test-mode checkout carries the metadata

Adding vitest for the pure helpers is possible but would be the only thing in the repo using it.
Deferred unless Troy asks.

## Out of scope

- Backfilling attribution for existing users, including the five 2026-08-11 buyers — the data does
  not exist. Those are traceable only via Cloudflare referrer analytics, Meta Events Manager
  (pixel `1769503420886398` was live and recording), or asking the buyers directly.
- Multi-touch attribution and any conversion-path modeling. First touch only.
- Consent gating for any future third-party script; this covers the Meta Pixel only.
- A Cloudflare Web Analytics beacon.
- Server-side Meta Conversions API.
