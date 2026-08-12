# Traffic Attribution + Cookie Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture first-touch referrer/UTM attribution for every visitor, stamp it onto signups and Stripe sessions, surface it on an admin page, and gate the Meta Pixel behind a geo-aware cookie consent banner.

**Architecture:** A client ping on first landing writes a `LandingEvent` row and sets a 60-day `sr_vid` cookie; the same response returns the visitor's consent region (derived from Cloudflare's `CF-IPCountry`) so the consent banner needs no second request and the root layout stays statically cacheable. Signup and both checkout routes read `sr_vid` and copy a first-touch snapshot onto the `User` row and into Stripe session metadata. An admin page aggregates landings → signups → sales by referrer host and UTM.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 5 + PostgreSQL, Stripe, Tailwind, `node:test` via `tsx` for unit tests.

**Spec:** `docs/superpowers/specs/2026-08-12-attribution-and-cookie-consent-design.md`

## Global Constraints

- **Never block a signup or a sale.** Every attribution read/write in `register`, `shft/checkout`, and `stripe/checkout` is wrapped in try/catch and logged. Failure leaves columns null and proceeds.
- **Unknown country → strict.** A missing, empty, or unrecognized `CF-IPCountry` resolves to the `strict` consent region.
- **First-touch, never overwritten.** Once `sr_vid` is set, later visits never replace it. `sr_vid` and the existing `shft_ref` affiliate cookie are independent and never read each other.
- **Do not call `headers()` in the root layout.** It forces every page dynamic and destroys the CDN caching `/shft` currently gets (`cf-cache-status: HIT`).
- **No new dependencies.** Tests use Node 22's built-in `node:test` run through the existing `tsx` devDependency.
- **Lint changed files only,** with `NODE_OPTIONS='--max-old-space-size=4096'`. A full-repo `npm run lint` OOMs this project.
- **Cookie names:** `sr_vid` (httpOnly, 60d), `sr_consent` (NOT httpOnly, 180d).
- Run all test commands from the repo root.

## Spec Corrections

Two deviations from the approved spec, both deliberate:

1. **No revenue column on the admin page.** The spec promised landings → signups → sales → revenue. `Purchase` has no amount column, and the only money figure in the schema is `AffiliateReferral.grossAmountCents`, which exists solely for affiliate-attributed sales. Tables show sales counts. Adding `Purchase.amountCents` would be scope creep and null for all existing rows.
2. **Real test files instead of a throwaway script.** The spec said the pure helpers would be exercised by a scratch script because the repo has no test runner. Node 22's built-in `node:test` runs under the existing `tsx` devDependency, verified working, so the helpers get committed tests at zero dependency cost.

## File Structure

**Create:**
- `lib/consent.ts` — cookie/session-storage constants, `ConsentState` + `ConsentRegion` types, client read/write/cache helpers
- `lib/attribution.ts` — pure parsing: `parseUtm`, `referrerHost`, `isStrictConsentRegion`, `consentRegionFor`
- `lib/attribution.test.ts`, `lib/consent.test.ts` — `node:test` unit tests
- `lib/landing-ping.ts` — client module; deduped `ensureLandingPing()` shared by the capture component and the consent provider so only one request is ever made
- `lib/attribution-snapshot.ts` — server helpers that turn the `sr_vid` cookie into a `User` snapshot or Stripe metadata
- `app/api/attribution/landing/route.ts` — writes the `LandingEvent`, sets `sr_vid`, returns region
- `components/AttributionCapture.tsx` — fires the landing ping on mount
- `components/consent/ConsentProvider.tsx` — owns consent state, exposes `useConsent()`
- `components/consent/CookieBanner.tsx` — the bar itself
- `app/admin/attribution/page.tsx` — admin readout

**Modify:**
- `prisma/schema.prisma` — `LandingEvent` model, 5 `User` columns
- `app/layout.tsx` — wrap in `ConsentProvider`, add `AttributionCapture` + `CookieBanner`
- `components/analytics/MetaPixel.tsx` — gate on consent
- `app/api/auth/register/route.ts` — stamp the snapshot
- `app/api/shft/checkout/route.ts`, `app/api/stripe/checkout/route.ts` — Stripe metadata
- `app/cookies/CookiesPageBody.tsx` — "Manage cookie preferences" button

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma models `LandingEvent` (fields `id`, `visitorId`, `referrer`, `referrerHost`, `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, `landingPath`, `country`, `createdAt`) and 5 new nullable `String` columns on `User`: `attributionVisitorId`, `attributionReferrerHost`, `attributionUtmSource`, `attributionUtmCampaign`, `attributionLandingPath`.

**Context:** This project's `_prisma_migrations` history was repaired on 2026-08-11. Create the migration normally with `prisma migrate dev`. Do not hand-edit migration history and do not re-run any older backfill scripts.

- [ ] **Step 1: Add the `LandingEvent` model**

Append to `prisma/schema.prisma`:

```prisma
// First-touch attribution for every new visitor. No PII — the visitorId is a
// random UUID mirrored in the httpOnly sr_vid cookie, never an account id.
model LandingEvent {
  id           String   @id @default(cuid())
  visitorId    String   @unique @map("visitor_id")
  referrer     String?
  referrerHost String?  @map("referrer_host")
  utmSource    String?  @map("utm_source")
  utmMedium    String?  @map("utm_medium")
  utmCampaign  String?  @map("utm_campaign")
  utmContent   String?  @map("utm_content")
  utmTerm      String?  @map("utm_term")
  landingPath  String   @map("landing_path")
  country      String?
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@index([referrerHost, createdAt])
  @@map("landing_events")
}
```

- [ ] **Step 2: Add the snapshot columns to `User`**

In the `User` model in `prisma/schema.prisma`, immediately after the `emailMarketingOptIn` line, insert:

```prisma
  // First-touch attribution, snapshotted at signup. Mirrors the philosophy of
  // AffiliateReferral.commissionCents — a historical fact that later data
  // changes (or pruning of landing_events) must never rewrite.
  attributionVisitorId    String? @map("attribution_visitor_id")
  attributionReferrerHost String? @map("attribution_referrer_host")
  attributionUtmSource    String? @map("attribution_utm_source")
  attributionUtmCampaign  String? @map("attribution_utm_campaign")
  attributionLandingPath  String? @map("attribution_landing_path")
```

Then add this line to the `User` model's index block, just above `@@map("users")`:

```prisma
  @@index([attributionVisitorId])
```

- [ ] **Step 3: Validate the schema before touching the database**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Create and apply the migration**

Run: `npx prisma migrate dev --name add_attribution_and_landing_events`
Expected: a new folder under `prisma/migrations/`, and `Your database is now in sync with your schema.`

- [ ] **Step 5: Regenerate the client and confirm the new model exists**

Run:
```bash
npx prisma generate
npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); console.log(typeof p.landingEvent.create)"
```
Expected: `function`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(attribution): landing_events table and user first-touch columns"
```

---

### Task 2: Pure helpers with tests

**Files:**
- Create: `lib/consent.ts`, `lib/attribution.ts`, `lib/consent.test.ts`, `lib/attribution.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - From `lib/consent.ts`: `VISITOR_COOKIE = "sr_vid"`, `VISITOR_MAX_AGE` (number, seconds), `CONSENT_COOKIE = "sr_consent"`, `CONSENT_MAX_AGE` (number, seconds), `REGION_KEY`, `POSTED_KEY`, `type ConsentState = "granted" | "denied" | "unset"`, `type ConsentRegion = "strict" | "notice"`, `parseConsentCookie(raw: string | null | undefined): ConsentState`, `readConsent(): ConsentState`, `writeConsent(state: "granted" | "denied"): void`, `clearConsent(): void`, `readCachedRegion(): ConsentRegion | null`, `cacheRegion(r: ConsentRegion): void`.
  - From `lib/attribution.ts`: `type UtmParams` with keys `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm` (all `string | null`), `parseUtm(search: string): UtmParams`, `referrerHost(referrer: string | null | undefined, selfHost?: string | null): string | null`, `isStrictConsentRegion(country: string | null | undefined): boolean`, `consentRegionFor(country: string | null | undefined): ConsentRegion`.
- Import direction is one-way: `attribution.ts` imports the `ConsentRegion` type from `consent.ts`. Never the reverse.

- [ ] **Step 1: Write the failing tests**

Create `lib/attribution.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { parseUtm, referrerHost, isStrictConsentRegion, consentRegionFor } from "./attribution"

test("parseUtm pulls all five keys", () => {
  const r = parseUtm("?utm_source=ig&utm_medium=social&utm_campaign=launch&utm_content=reel1&utm_term=gate")
  assert.deepEqual(r, {
    utmSource: "ig", utmMedium: "social", utmCampaign: "launch",
    utmContent: "reel1", utmTerm: "gate",
  })
})

test("parseUtm returns nulls for an empty query string", () => {
  assert.deepEqual(parseUtm(""), {
    utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null,
  })
})

test("parseUtm ignores unrelated params and works without a leading ?", () => {
  const r = parseUtm("ref=abc&utm_source=reddit")
  assert.equal(r.utmSource, "reddit")
  assert.equal(r.utmMedium, null)
})

test("referrerHost extracts the host", () => {
  assert.equal(referrerHost("https://www.instagram.com/p/abc/"), "www.instagram.com")
})

test("referrerHost returns null for same-origin referrers", () => {
  assert.equal(referrerHost("https://sampleroll.com/dig", "sampleroll.com"), null)
})

test("referrerHost returns null for empty, null, and unparseable input", () => {
  assert.equal(referrerHost(null), null)
  assert.equal(referrerHost(""), null)
  assert.equal(referrerHost("not a url"), null)
})

test("isStrictConsentRegion is true for EU, UK, and EEA", () => {
  for (const c of ["DE", "FR", "GB", "IE", "NO", "IS", "LI"]) {
    assert.equal(isStrictConsentRegion(c), true, `${c} should be strict`)
  }
})

test("isStrictConsentRegion is false for the US and other non-EU countries", () => {
  for (const c of ["US", "CA", "AU", "JP", "BR"]) {
    assert.equal(isStrictConsentRegion(c), false, `${c} should not be strict`)
  }
})

test("isStrictConsentRegion treats unknown and missing as strict", () => {
  assert.equal(isStrictConsentRegion(null), true)
  assert.equal(isStrictConsentRegion(undefined), true)
  assert.equal(isStrictConsentRegion(""), true)
  assert.equal(isStrictConsentRegion("XX"), true)
})

test("isStrictConsentRegion is case-insensitive", () => {
  assert.equal(isStrictConsentRegion("de"), true)
  assert.equal(isStrictConsentRegion("us"), false)
})

test("consentRegionFor maps to the region strings", () => {
  assert.equal(consentRegionFor("US"), "notice")
  assert.equal(consentRegionFor("DE"), "strict")
  assert.equal(consentRegionFor(null), "strict")
})
```

Create `lib/consent.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { parseConsentCookie } from "./consent"

test("parseConsentCookie reads granted and denied", () => {
  assert.equal(parseConsentCookie("sr_consent=granted"), "granted")
  assert.equal(parseConsentCookie("sr_consent=denied"), "denied")
})

test("parseConsentCookie finds the value among other cookies", () => {
  assert.equal(parseConsentCookie("foo=1; sr_consent=granted; bar=2"), "granted")
})

test("parseConsentCookie returns unset when absent, empty, or garbage", () => {
  assert.equal(parseConsentCookie("foo=1"), "unset")
  assert.equal(parseConsentCookie(""), "unset")
  assert.equal(parseConsentCookie(null), "unset")
  assert.equal(parseConsentCookie("sr_consent=maybe"), "unset")
})

test("parseConsentCookie does not match a cookie whose name merely ends in sr_consent", () => {
  assert.equal(parseConsentCookie("not_sr_consent=granted"), "unset")
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test lib/attribution.test.ts lib/consent.test.ts`
Expected: FAIL — module resolution errors, `Cannot find module './attribution'` and `'./consent'`.

- [ ] **Step 3: Implement `lib/consent.ts`**

```ts
// Cookie + session-storage plumbing for consent. Pure and browser-safe: the
// document/sessionStorage reads happen inside functions, never at module load,
// so this file is importable from server routes for the constants alone.

export const VISITOR_COOKIE = "sr_vid"
export const VISITOR_MAX_AGE = 60 * 60 * 24 * 60 // 60 days, matches shft_ref

export const CONSENT_COOKIE = "sr_consent"
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180 // 180 days

/** Per-tab caches so the landing ping fires at most once per session. */
export const POSTED_KEY = "sr_attr_posted"
export const REGION_KEY = "sr_region"

export type ConsentState = "granted" | "denied" | "unset"
export type ConsentRegion = "strict" | "notice"

export function parseConsentCookie(raw: string | null | undefined): ConsentState {
  if (!raw) return "unset"
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name !== CONSENT_COOKIE) continue
    const value = rest.join("=")
    if (value === "granted" || value === "denied") return value
    return "unset"
  }
  return "unset"
}

/** Client only. Returns "unset" during SSR. */
export function readConsent(): ConsentState {
  if (typeof document === "undefined") return "unset"
  return parseConsentCookie(document.cookie)
}

/**
 * Client only. Not httpOnly by design — the pixel gate is a client-side
 * decision, so JS must be able to read this back on the next visit.
 */
export function writeConsent(state: "granted" | "denied"): void {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${CONSENT_COOKIE}=${state}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`
}

export function clearConsent(): void {
  if (typeof document === "undefined") return
  document.cookie = `${CONSENT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}

export function readCachedRegion(): ConsentRegion | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const v = sessionStorage.getItem(REGION_KEY)
    return v === "strict" || v === "notice" ? v : null
  } catch {
    return null
  }
}

export function cacheRegion(r: ConsentRegion): void {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(REGION_KEY, r)
  } catch {
    /* private mode — region simply re-resolves next navigation */
  }
}
```

- [ ] **Step 4: Implement `lib/attribution.ts`**

```ts
import type { ConsentRegion } from "./consent"

export type UtmParams = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
}

/** Cap stored values so a hostile query string can't bloat a row. */
const MAX_LEN = 255

function pick(params: URLSearchParams, key: string): string | null {
  const v = params.get(key)
  if (!v) return null
  return v.slice(0, MAX_LEN)
}

export function parseUtm(search: string): UtmParams {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  return {
    utmSource: pick(params, "utm_source"),
    utmMedium: pick(params, "utm_medium"),
    utmCampaign: pick(params, "utm_campaign"),
    utmContent: pick(params, "utm_content"),
    utmTerm: pick(params, "utm_term"),
  }
}

/**
 * Host of an external referrer. Same-origin referrers return null so internal
 * navigation never registers as a traffic source.
 */
export function referrerHost(
  referrer: string | null | undefined,
  selfHost?: string | null
): string | null {
  if (!referrer) return null
  let host: string
  try {
    host = new URL(referrer).host
  } catch {
    return null
  }
  if (!host) return null
  if (selfHost && host.toLowerCase() === selfHost.toLowerCase()) return null
  return host.slice(0, MAX_LEN)
}

/** EU 27 + EEA (IS, LI, NO) + UK + Switzerland. */
const STRICT_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  "IS", "LI", "NO",
  "GB", "CH",
])

/**
 * Countries we affirmatively recognize as non-strict. A code in neither set is
 * unknown, and unknown means strict — so adding a country here is the only way
 * to opt it out of the consent gate.
 */
const RELAXED_COUNTRIES = new Set([
  "US", "CA", "MX", "BR", "AR", "CL", "CO", "PE",
  "AU", "NZ", "JP", "KR", "CN", "TW", "HK", "SG", "MY", "TH", "PH", "ID", "VN", "IN", "PK", "BD",
  "ZA", "NG", "KE", "EG", "MA", "GH",
  "RU", "UA", "TR", "IL", "AE", "SA", "QA", "KW",
  "RS", "AL", "BA", "MK", "ME", "MD", "GE", "AM", "AZ", "KZ",
])

/** Unknown or missing country errs strict — never load the pixel on a guess. */
export function isStrictConsentRegion(country: string | null | undefined): boolean {
  if (!country) return true
  const code = country.trim().toUpperCase()
  if (code.length !== 2) return true
  if (STRICT_COUNTRIES.has(code)) return true
  return !RELAXED_COUNTRIES.has(code)
}

export function consentRegionFor(country: string | null | undefined): ConsentRegion {
  return isStrictConsentRegion(country) ? "strict" : "notice"
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsx --test lib/attribution.test.ts lib/consent.test.ts`
Expected: PASS — `# fail 0`, all assertions green.

- [ ] **Step 6: Typecheck and lint**

Run:
```bash
npx tsc --noEmit
NODE_OPTIONS='--max-old-space-size=4096' npx eslint lib/attribution.ts lib/consent.ts lib/attribution.test.ts lib/consent.test.ts
```
Expected: no errors from either.

- [ ] **Step 7: Commit**

```bash
git add lib/attribution.ts lib/consent.ts lib/attribution.test.ts lib/consent.test.ts
git commit -m "feat(attribution): pure UTM, referrer, and consent-region helpers"
```

---

### Task 3: Landing API route

**Files:**
- Create: `app/api/attribution/landing/route.ts`

**Interfaces:**
- Consumes: `parseUtm`, `referrerHost`, `consentRegionFor` from `lib/attribution.ts`; `VISITOR_COOKIE`, `VISITOR_MAX_AGE` from `lib/consent.ts`; `prisma` from `lib/db`.
- Produces: `POST /api/attribution/landing`. Request body `{ referrer?: string, search?: string, path?: string }`. Response `{ region: "strict" | "notice" }` on **every** path, including the already-seen skip path and every error path.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { parseUtm, referrerHost, consentRegionFor } from "@/lib/attribution"
import { VISITOR_COOKIE, VISITOR_MAX_AGE } from "@/lib/consent"

// Noise reduction, not security. Some bots will still get through and that's fine.
const BOT_UA = /bot|crawler|spider|crawl|headless|scrape|preview|monitor|curl|wget/i

/**
 * Records first-touch attribution for a new visitor and reports which consent
 * regime applies. Called once per tab session by the client.
 *
 * Always returns a region — the consent banner depends on this response and
 * must never be left without an answer, so every early return still carries it.
 */
export async function POST(request: Request) {
  const h = await headers()
  const country = h.get("cf-ipcountry")
  const res = NextResponse.json({ region: consentRegionFor(country) })

  try {
    const cookieStore = await cookies()
    if (cookieStore.get(VISITOR_COOKIE)) return res // first touch already recorded

    const ua = h.get("user-agent") || ""
    if (BOT_UA.test(ua)) return res

    let body: { referrer?: unknown; search?: unknown; path?: unknown } = {}
    try {
      body = await request.json()
    } catch {
      /* empty or invalid body — still worth recording the landing */
    }

    const referrer = typeof body.referrer === "string" && body.referrer ? body.referrer.slice(0, 2000) : null
    const search = typeof body.search === "string" ? body.search : ""
    const landingPath = typeof body.path === "string" && body.path ? body.path.slice(0, 512) : "/"

    const visitorId = crypto.randomUUID()

    await prisma.landingEvent.create({
      data: {
        visitorId,
        referrer,
        referrerHost: referrerHost(referrer, h.get("host")),
        landingPath,
        country,
        ...parseUtm(search),
      },
    })

    res.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: VISITOR_MAX_AGE,
      path: "/",
    })
  } catch (e) {
    console.error("[attribution/landing]", e)
  }

  return res
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Start the dev server**

Run: `npm run dev`
Wait for `Ready`. Leave it running for the next step.

- [ ] **Step 4: Verify a landing is recorded, deduped, and returns a region**

In a second terminal:

```bash
# First call: records a row, sets sr_vid, reports notice for a US visitor
curl -s -i -X POST http://localhost:3000/api/attribution/landing \
  -H 'Content-Type: application/json' -H 'CF-IPCountry: US' \
  -d '{"referrer":"https://www.instagram.com/p/abc/","search":"?utm_source=ig&utm_campaign=launch","path":"/shft"}' \
  | grep -Ei 'sr_vid|region'

# Strict region for a German visitor
curl -s -X POST http://localhost:3000/api/attribution/landing \
  -H 'Content-Type: application/json' -H 'CF-IPCountry: DE' -d '{}'

# Missing country also resolves strict
curl -s -X POST http://localhost:3000/api/attribution/landing \
  -H 'Content-Type: application/json' -d '{}'
```

Expected: the first prints a `Set-Cookie: sr_vid=...` header and `{"region":"notice"}`; the second and third both print `{"region":"strict"}`.

- [ ] **Step 5: Verify the row landed and that a repeat call with the cookie does not duplicate it**

```bash
# Replay WITH the cookie — must not create a second row
curl -s -X POST http://localhost:3000/api/attribution/landing \
  -H 'Content-Type: application/json' -H 'CF-IPCountry: US' \
  -H 'Cookie: sr_vid=test-existing-id' \
  -d '{"referrer":"https://reddit.com/r/x","path":"/dig"}'

npx tsx -e "
import {PrismaClient} from '@prisma/client'
const p = new PrismaClient()
const rows = await p.landingEvent.findMany({orderBy:{createdAt:'desc'}, take:5})
console.log(JSON.stringify(rows, null, 2))
await p.\$disconnect()
"
```

Expected: exactly one Instagram row with `referrerHost: "www.instagram.com"`, `utmSource: "ig"`, `utmCampaign: "launch"`, `landingPath: "/shft"`, `country: "US"`. **No** `reddit.com` row — the cookie suppressed it.

- [ ] **Step 6: Lint and commit**

```bash
NODE_OPTIONS='--max-old-space-size=4096' npx eslint app/api/attribution/landing/route.ts
git add app/api/attribution/landing/route.ts
git commit -m "feat(attribution): landing endpoint records first touch and reports consent region"
```

---

### Task 4: Deduped landing ping and capture component

**Files:**
- Create: `lib/landing-ping.ts`, `components/AttributionCapture.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `POST /api/attribution/landing` from Task 3; `POSTED_KEY`, `cacheRegion`, `readCachedRegion`, `type ConsentRegion` from `lib/consent.ts`.
- Produces: `ensureLandingPing(): Promise<ConsentRegion>` from `lib/landing-ping.ts`. Deduped three ways — an in-memory promise (concurrent callers in one render), `sessionStorage[POSTED_KEY]` (later navigations in the same tab), and the server's `sr_vid` check. Task 5's `ConsentProvider` awaits this same function; the dedupe is what guarantees a single request.

**Why a shared module rather than props:** both `AttributionCapture` (fire-and-forget) and `ConsentProvider` (needs the region) must trigger this, and neither can depend on the other's mount order. A module-level promise makes whoever calls first win and the other await the same result.

- [ ] **Step 1: Write `lib/landing-ping.ts`**

```ts
"use client"

import { POSTED_KEY, cacheRegion, readCachedRegion, type ConsentRegion } from "./consent"

/** Dedupes concurrent callers within a single page render. */
let inFlight: Promise<ConsentRegion> | null = null

function alreadyPosted(): boolean {
  if (typeof sessionStorage === "undefined") return false
  try {
    return sessionStorage.getItem(POSTED_KEY) === "1"
  } catch {
    return false
  }
}

function markPosted(): void {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(POSTED_KEY, "1")
  } catch {
    /* private mode — worst case we ping again next navigation, server dedupes */
  }
}

/**
 * Reports this landing to the server (at most once per tab) and resolves the
 * visitor's consent region.
 *
 * The server sets sr_vid on first contact and skips the insert afterwards, so
 * a duplicate ping is harmless — but the sessionStorage guard means a returning
 * visitor's region must come from cache, since the request won't repeat.
 * Falls back to "strict": losing pixel data is acceptable, loading the pixel
 * without consent is not.
 */
export function ensureLandingPing(): Promise<ConsentRegion> {
  if (inFlight) return inFlight

  const cached = readCachedRegion()
  if (cached && alreadyPosted()) return Promise.resolve(cached)

  inFlight = (async (): Promise<ConsentRegion> => {
    try {
      const res = await fetch("/api/attribution/landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrer: document.referrer || null,
          search: window.location.search,
          path: window.location.pathname,
        }),
      })
      markPosted()
      const data = (await res.json()) as { region?: unknown }
      const region: ConsentRegion = data.region === "notice" ? "notice" : "strict"
      cacheRegion(region)
      return region
    } catch {
      return cached ?? "strict"
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
```

- [ ] **Step 2: Write `components/AttributionCapture.tsx`**

```tsx
"use client"

import { useEffect } from "react"
import { ensureLandingPing } from "@/lib/landing-ping"

/**
 * Fires the first-touch landing ping. Sits alongside AffiliateRefCapture in the
 * root layout and renders nothing.
 *
 * ConsentProvider calls the same deduped function, but this component exists so
 * the landing is still recorded for visitors whose consent is already decided
 * and who therefore never need a region lookup.
 */
export default function AttributionCapture() {
  useEffect(() => {
    ensureLandingPing().catch(() => {})
  }, [])
  return null
}
```

- [ ] **Step 3: Mount it in the root layout**

In `app/layout.tsx`, add the import beside the existing `AffiliateRefCapture` import:

```tsx
import AttributionCapture from "@/components/AttributionCapture"
```

and add the element directly after `<AffiliateRefCapture />` in the body:

```tsx
        <AffiliateRefCapture />
        <AttributionCapture />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify one ping per tab in the browser**

Clear cookies for `localhost:3000`, then with `npm run dev` running open `http://localhost:3000/shft?utm_source=test&utm_campaign=plan` with DevTools → Network open.

Expected:
- Exactly one `POST /api/attribution/landing`, response `{"region":"strict"}` (no `CF-IPCountry` locally, so strict is correct)
- Application → Cookies shows `sr_vid`
- Application → Session Storage shows `sr_attr_posted = 1` and `sr_region = strict`
- Navigate to `/dig` and back: **no** second POST

- [ ] **Step 6: Confirm no duplicate row was written**

```bash
npx tsx -e "
import {PrismaClient} from '@prisma/client'
const p = new PrismaClient()
console.log(await p.landingEvent.count({where:{utmSource:'test'}}))
await p.\$disconnect()
"
```
Expected: `1`

- [ ] **Step 7: Lint and commit**

```bash
NODE_OPTIONS='--max-old-space-size=4096' npx eslint lib/landing-ping.ts components/AttributionCapture.tsx app/layout.tsx
git add lib/landing-ping.ts components/AttributionCapture.tsx app/layout.tsx
git commit -m "feat(attribution): client landing ping, deduped once per tab"
```

---

### Task 5: Consent provider, banner, and pixel gating

**Files:**
- Create: `components/consent/ConsentProvider.tsx`, `components/consent/CookieBanner.tsx`
- Modify: `components/analytics/MetaPixel.tsx`, `app/layout.tsx`

**Interfaces:**
- Consumes: `ensureLandingPing` from `lib/landing-ping.ts`; `readConsent`, `writeConsent`, `clearConsent`, `readCachedRegion`, `type ConsentState`, `type ConsentRegion` from `lib/consent.ts`.
- Produces: `ConsentProvider` (default export) and `useConsent(): { consent: ConsentState, region: ConsentRegion | null, pixelAllowed: boolean, showBanner: boolean, accept: () => void, reject: () => void, reopen: () => void }`. Task 6 calls `reopen()`.

**Behavior contract:**

| `sr_consent` | Region | Pixel loads | Banner |
|---|---|---|---|
| `granted` | any | yes | no |
| `denied` | any | no | no |
| `unset` | `notice` | **yes, immediately** | dismissible bar |
| `unset` | `strict` | **no** | Accept / Reject |

In a `notice` region the pixel is not conditional on the dismissal; writing `granted` only suppresses the bar on later visits.

- [ ] **Step 1: Write `components/consent/ConsentProvider.tsx`**

```tsx
"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  readConsent,
  writeConsent,
  clearConsent,
  readCachedRegion,
  type ConsentRegion,
  type ConsentState,
} from "@/lib/consent"
import { ensureLandingPing } from "@/lib/landing-ping"

type ConsentContextValue = {
  consent: ConsentState
  region: ConsentRegion | null
  pixelAllowed: boolean
  showBanner: boolean
  accept: () => void
  reject: () => void
  reopen: () => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) throw new Error("useConsent must be used inside ConsentProvider")
  return ctx
}

export default function ConsentProvider({ children }: { children: React.ReactNode }) {
  // Start "unset" with no region: matches SSR, so the first client render is
  // identical to the server's and nothing loads before we know the answer.
  const [consent, setConsent] = useState<ConsentState>("unset")
  const [region, setRegion] = useState<ConsentRegion | null>(null)

  useEffect(() => {
    const current = readConsent()
    setConsent(current)
    if (current !== "unset") return // decided already; region is irrelevant

    const cached = readCachedRegion()
    if (cached) {
      setRegion(cached)
      return
    }

    let active = true
    ensureLandingPing()
      .then((r) => {
        if (active) setRegion(r)
      })
      .catch(() => {
        if (active) setRegion("strict")
      })
    return () => {
      active = false
    }
  }, [])

  const value = useMemo<ConsentContextValue>(() => {
    const accept = () => {
      writeConsent("granted")
      setConsent("granted")
    }
    const reject = () => {
      writeConsent("denied")
      setConsent("denied")
    }
    const reopen = () => {
      clearConsent()
      setConsent("unset")
      setRegion(readCachedRegion() ?? "strict")
    }

    return {
      consent,
      region,
      // Undecided visitors get the pixel only in a notice region. Region null
      // means "still resolving" — withhold until we know.
      pixelAllowed: consent === "granted" || (consent === "unset" && region === "notice"),
      showBanner: consent === "unset" && region !== null,
      accept,
      reject,
      reopen,
    }
  }, [consent, region])

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}
```

- [ ] **Step 2: Write `components/consent/CookieBanner.tsx`**

```tsx
"use client"

import Link from "next/link"
import { useConsent } from "./ConsentProvider"

/**
 * Bottom bar. In a notice region the pixel is already loaded and this is
 * informational; in a strict region nothing non-essential loads until Accept.
 */
export default function CookieBanner() {
  const { showBanner, region, accept, reject } = useConsent()
  if (!showBanner) return null

  const strict = region === "strict"

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie notice"
      className="fixed bottom-0 left-0 right-0 z-50 border-t px-4 py-3"
      style={{
        background: "var(--background)",
        borderColor: "var(--border, rgba(255,255,255,0.15))",
        color: "var(--foreground)",
      }}
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm flex-1">
          We use cookies to keep you signed in and to understand how people find us.{" "}
          <Link href="/cookies" className="underline" style={{ color: "var(--primary)" }}>
            Cookie Policy
          </Link>{" "}
          &middot;{" "}
          <Link href="/privacy" className="underline" style={{ color: "var(--primary)" }}>
            Privacy
          </Link>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {strict && (
            <button
              type="button"
              onClick={reject}
              className="text-sm px-3 py-1.5 rounded border"
              style={{ borderColor: "var(--primary)", color: "var(--foreground)" }}
            >
              Reject
            </button>
          )}
          <button
            type="button"
            onClick={accept}
            className="text-sm px-3 py-1.5 rounded font-medium"
            style={{ background: "var(--primary)", color: "var(--background)" }}
          >
            {strict ? "Accept" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Gate the pixel**

In `components/analytics/MetaPixel.tsx`, add the import:

```tsx
import { useConsent } from "@/components/consent/ConsentProvider"
```

`MetaPixel` already has a `useEffect` and then an early `if (!isMetaPixelEnabled) return null` at roughly line 31. **Hooks must never sit below a conditional return**, so place the hook call on the very first line of the component body, above the existing `useEffect`:

```tsx
export default function MetaPixel() {
  const { pixelAllowed } = useConsent()
  // ...existing useEffect stays here, unchanged...
```

Then extend the existing guard so it reads:

```tsx
  if (!isMetaPixelEnabled || !pixelAllowed) return null
```

The `<noscript>` fallback image lives inside the JSX returned below that guard, so it is gated by the same check. Read the file and confirm no `<noscript>` renders outside it — an ungated tracking pixel in a strict region is the exact failure this task exists to prevent.

- [ ] **Step 4: Wire the layout**

In `app/layout.tsx`, add imports:

```tsx
import ConsentProvider from "@/components/consent/ConsentProvider"
import CookieBanner from "@/components/consent/CookieBanner"
```

and wrap the body contents so the provider encloses both the pixel and the banner:

```tsx
        <ConsentProvider>
          <MetaPixel />
          <AffiliateRefCapture />
          <AttributionCapture />
          <RootBody>{children}</RootBody>
          <CookieBanner />
        </ConsentProvider>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify the strict path blocks the pixel**

Set `NEXT_PUBLIC_META_PIXEL_ID` in `.env.local` if not already set, restart `npm run dev`, clear cookies and session storage, and load `http://localhost:3000/`. No `CF-IPCountry` locally means strict.

Expected:
- Banner appears with **both** Reject and Accept
- Network tab, filtered to `facebook`: **zero requests**
- Page source contains no `facebook.com/tr` noscript image
- Click Accept → `connect.facebook.net` request fires immediately with no reload, banner disappears
- Reload → no banner, pixel loads

- [ ] **Step 7: Verify the reject path and the notice path**

Clear cookies and session storage, reload, click **Reject**.
Expected: banner gone, still zero `facebook` requests, `sr_consent=denied`; reload keeps the pixel off.

Now clear cookies and session storage again and simulate a US visitor. The dev server sees no Cloudflare header, so force it by temporarily seeding the cache — in the DevTools console before load is not possible, so instead run:

```bash
curl -s -X POST http://localhost:3000/api/attribution/landing \
  -H 'Content-Type: application/json' -H 'CF-IPCountry: US' -d '{}'
```

confirm it returns `{"region":"notice"}`, then in the browser console set `sessionStorage.setItem("sr_region","notice")` and reload.

Expected: pixel loads immediately, banner shows a single **Got it** button and no Reject.

- [ ] **Step 8: Lint and commit**

```bash
NODE_OPTIONS='--max-old-space-size=4096' npx eslint components/consent/ConsentProvider.tsx components/consent/CookieBanner.tsx components/analytics/MetaPixel.tsx app/layout.tsx
git add components/consent app/layout.tsx components/analytics/MetaPixel.tsx
git commit -m "feat(consent): geo-gated cookie banner, Meta Pixel withheld until consent in EU/UK"
```

---

### Task 6: Manage preferences on the cookie policy page

**Files:**
- Create: `components/consent/ManageCookiesButton.tsx`
- Modify: `app/cookies/CookiesPageBody.tsx`

**Interfaces:**
- Consumes: `useConsent().reopen` from Task 5.
- Produces: `ManageCookiesButton` (default export), a client component safe to drop anywhere inside `ConsentProvider`.

**Why:** consent is currently irrevocable once set, which is not acceptable in a strict region.

- [ ] **Step 1: Write the button**

```tsx
"use client"

import { useConsent } from "./ConsentProvider"

/** Clears the stored choice and brings the banner back. */
export default function ManageCookiesButton() {
  const { reopen } = useConsent()
  return (
    <button
      type="button"
      onClick={reopen}
      className="text-sm px-4 py-2 rounded font-medium"
      style={{ background: "var(--primary)", color: "var(--background)" }}
    >
      Manage cookie preferences
    </button>
  )
}
```

- [ ] **Step 2: Place it on the policy page**

`app/cookies/CookiesPageBody.tsx` is already a client component. Add the import at the top beside the existing `Link` import:

```tsx
import ManageCookiesButton from "@/components/consent/ManageCookiesButton"
```

Then insert this block immediately after the closing `</p>` of the "Last updated: April 2026…" intro paragraph:

```tsx
          <div className="mb-6">
            <ManageCookiesButton />
          </div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify the round trip**

With `npm run dev` running, accept the banner on any page, then visit `http://localhost:3000/cookies` and click **Manage cookie preferences**.

Expected: the banner reappears immediately, and `sr_consent` is gone from Application → Cookies. Choosing Reject then re-opening and choosing Accept both work.

- [ ] **Step 5: Lint and commit**

```bash
NODE_OPTIONS='--max-old-space-size=4096' npx eslint components/consent/ManageCookiesButton.tsx app/cookies/CookiesPageBody.tsx
git add components/consent/ManageCookiesButton.tsx app/cookies/CookiesPageBody.tsx
git commit -m "feat(consent): revocable consent from the cookie policy page"
```

---

### Task 7: Stamp attribution onto signups and Stripe sessions

**Files:**
- Create: `lib/attribution-snapshot.ts`
- Modify: `app/api/auth/register/route.ts`, `app/api/shft/checkout/route.ts`, `app/api/stripe/checkout/route.ts`

**Interfaces:**
- Consumes: `VISITOR_COOKIE` from `lib/consent.ts`; `prisma` from `lib/db`; the `LandingEvent` model from Task 1.
- Produces:
  - `type AttributionSnapshot = { attributionVisitorId: string, attributionReferrerHost: string | null, attributionUtmSource: string | null, attributionUtmCampaign: string | null, attributionLandingPath: string | null }`
  - `readAttributionSnapshot(): Promise<AttributionSnapshot | null>` — spreadable directly into a `prisma.user.create` data object
  - `readAttributionMetadata(): Promise<Record<string, string>>` — spreadable into a Stripe `metadata` object; returns `{}` when unknown

**Constraint:** both helpers swallow every error and return `null`/`{}`. Attribution must never break a signup or a sale.

- [ ] **Step 1: Write `lib/attribution-snapshot.ts`**

```ts
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { VISITOR_COOKIE } from "@/lib/consent"

export type AttributionSnapshot = {
  attributionVisitorId: string
  attributionReferrerHost: string | null
  attributionUtmSource: string | null
  attributionUtmCampaign: string | null
  attributionLandingPath: string | null
}

/**
 * First-touch attribution for the current request, resolved from the sr_vid
 * cookie. Returns null when there's no cookie or no matching landing event —
 * callers must treat that as "unknown source", never as an error.
 */
export async function readAttributionSnapshot(): Promise<AttributionSnapshot | null> {
  try {
    const cookieStore = await cookies()
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value
    if (!visitorId) return null

    const landing = await prisma.landingEvent.findUnique({
      where: { visitorId },
      select: { referrerHost: true, utmSource: true, utmCampaign: true, landingPath: true },
    })
    if (!landing) return null

    return {
      attributionVisitorId: visitorId,
      attributionReferrerHost: landing.referrerHost,
      attributionUtmSource: landing.utmSource,
      attributionUtmCampaign: landing.utmCampaign,
      attributionLandingPath: landing.landingPath,
    }
  } catch (e) {
    console.error("[attribution snapshot]", e)
    return null
  }
}

/**
 * Same data shaped for Stripe session metadata, so the source is visible on the
 * payment in the Stripe dashboard independent of our database. Stripe caps
 * metadata values at 500 characters; these are all far shorter.
 */
export async function readAttributionMetadata(): Promise<Record<string, string>> {
  const snap = await readAttributionSnapshot()
  if (!snap) return {}
  const meta: Record<string, string> = { attrVisitorId: snap.attributionVisitorId }
  if (snap.attributionReferrerHost) meta.attrReferrer = snap.attributionReferrerHost
  if (snap.attributionUtmSource) meta.attrSource = snap.attributionUtmSource
  if (snap.attributionUtmCampaign) meta.attrCampaign = snap.attributionUtmCampaign
  return meta
}
```

- [ ] **Step 2: Stamp the signup**

In `app/api/auth/register/route.ts`, add the import:

```ts
import { readAttributionSnapshot } from "@/lib/attribution-snapshot"
```

Immediately before the `const user = await prisma.user.create({` call, add:

```ts
    // First-touch attribution. Never allowed to block a signup.
    const attribution = await readAttributionSnapshot()
```

Then inside the `data: { ... }` object, add as the last entry after `emailVerificationExpires`:

```ts
        ...(attribution ?? {}),
```

- [ ] **Step 3: Stamp the shft checkout**

In `app/api/shft/checkout/route.ts`, add the import:

```ts
import { readAttributionMetadata } from "@/lib/attribution-snapshot"
```

Immediately before `const checkoutSession = await stripe.checkout.sessions.create({`, add:

```ts
    const attrMetadata = await readAttributionMetadata()
```

Then extend the existing `metadata` object so it reads:

```ts
      metadata: {
        product: "shft",
        userId: session.user.id,
        ...(affiliateCode ? { affiliateCode } : {}),
        ...attrMetadata,
      },
```

- [ ] **Step 4: Stamp the Pro subscription checkout**

In `app/api/stripe/checkout/route.ts`, add the import:

```ts
import { readAttributionMetadata } from "@/lib/attribution-snapshot"
```

Immediately before `const checkoutSession = await stripe.checkout.sessions.create({`, add:

```ts
    const attrMetadata = await readAttributionMetadata()
```

Then change the existing metadata line from `metadata: { userId: session.user.id },` to:

```ts
      metadata: { userId: session.user.id, ...attrMetadata },
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify a real signup carries the snapshot**

With `npm run dev` running, clear all cookies and session storage, then open
`http://localhost:3000/?utm_source=plantest&utm_campaign=stamp` with a referrer — easiest is to run this in the DevTools console of any other origin, or simply confirm the UTM path and accept `referrerHost: null`.

Register a new account through the UI at `/register`, then:

```bash
npx tsx -e "
import {PrismaClient} from '@prisma/client'
const p = new PrismaClient()
const u = await p.user.findFirst({orderBy:{createdAt:'desc'}, select:{
  email:true, attributionVisitorId:true, attributionUtmSource:true,
  attributionUtmCampaign:true, attributionLandingPath:true
}})
console.log(u)
await p.\$disconnect()
"
```

Expected: the new user's `attributionUtmSource` is `plantest`, `attributionUtmCampaign` is `stamp`, and `attributionVisitorId` is populated.

- [ ] **Step 7: Verify signup still works with no attribution at all**

Clear cookies again, and this time block the landing ping so no `sr_vid` exists: in DevTools → Network, enable request blocking for `*/api/attribution/landing`, then register another account.

Expected: registration succeeds normally; the new user's attribution columns are all `null`. This is the constraint that matters most — confirm no 500.

- [ ] **Step 8: Lint and commit**

```bash
NODE_OPTIONS='--max-old-space-size=4096' npx eslint lib/attribution-snapshot.ts app/api/auth/register/route.ts app/api/shft/checkout/route.ts app/api/stripe/checkout/route.ts
git add lib/attribution-snapshot.ts app/api/auth/register/route.ts app/api/shft/checkout/route.ts app/api/stripe/checkout/route.ts
git commit -m "feat(attribution): stamp first touch onto signups and Stripe sessions"
```

---

### Task 8: Admin attribution page

**Files:**
- Create: `app/admin/attribution/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin` from `lib/admin.ts`; `prisma` from `lib/db`; the Task 1 schema.
- Produces: the page at `/admin/attribution`, accepting `?days=<n>` (default 7, clamped 1–90).

**Pattern to follow:** `app/admin/affiliates/page.tsx` — `export const dynamic = "force-dynamic"`, `robots: { index: false, follow: false }`, and `notFound()` for non-admins so the route is invisible rather than forbidden.

**No revenue column.** `Purchase` has no amount field; see Spec Corrections at the top of this plan.

- [ ] **Step 1: Write the page**

```tsx
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

const PT = "America/Los_Angeles"

function fmt(d: Date): string {
  return d.toLocaleString("en-US", { timeZone: PT, hour12: true })
}

/** Group a list of nullable keys into sorted [label, count] pairs. */
function tally(rows: { key: string | null; count: number }[]): [string, number][] {
  const m = new Map<string, number>()
  for (const r of rows) {
    const label = r.key || "(direct / none)"
    m.set(label, (m.get(label) ?? 0) + r.count)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export default async function AdminAttributionPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  if (!(await requireAdmin())) notFound()

  const sp = await searchParams
  const parsed = Number(sp.days)
  const days = Number.isFinite(parsed) ? Math.min(90, Math.max(1, Math.floor(parsed))) : 7
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const range = { gte: since }

  const [landingRows, signupRows, sales] = await Promise.all([
    prisma.landingEvent.groupBy({
      by: ["referrerHost"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["attributionReferrerHost"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.purchase.findMany({
      where: { createdAt: range },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            email: true,
            attributionReferrerHost: true,
            attributionUtmSource: true,
            attributionUtmCampaign: true,
            attributionLandingPath: true,
          },
        },
      },
    }),
  ])

  const [utmLandings, utmSignups] = await Promise.all([
    prisma.landingEvent.groupBy({
      by: ["utmSource", "utmCampaign"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["attributionUtmSource"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
  ])

  const landings = tally(landingRows.map((r) => ({ key: r.referrerHost, count: r._count._all })))
  const signups = new Map(
    tally(signupRows.map((r) => ({ key: r.attributionReferrerHost, count: r._count._all })))
  )
  const salesByHost = new Map<string, number>()
  for (const s of sales) {
    const k = s.user.attributionReferrerHost || "(direct / none)"
    salesByHost.set(k, (salesByHost.get(k) ?? 0) + 1)
  }

  const utmRows = tally(
    utmLandings.map((r) => ({
      key: r.utmSource ? `${r.utmSource} / ${r.utmCampaign ?? "—"}` : null,
      count: r._count._all,
    }))
  )
  const utmSignupsBySource = new Map(
    tally(utmSignups.map((r) => ({ key: r.attributionUtmSource, count: r._count._all })))
  )

  const th = "text-left px-3 py-2 text-xs uppercase tracking-wide opacity-60"
  const td = "px-3 py-2 text-sm border-t"

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <main className="max-w-5xl mx-auto px-4 py-8" style={{ color: "var(--foreground)" }}>
        <h1 className="text-2xl font-bold mb-1">Attribution</h1>
        <p className="text-sm opacity-70 mb-6">
          First-touch, last {days} days. Times in Pacific.{" "}
          {[1, 7, 30, 90].map((d) => (
            <a key={d} href={`?days=${d}`} className="underline mr-2" style={{ color: "var(--primary)" }}>
              {d}d
            </a>
          ))}
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">By referrer</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Referrer</th>
              <th className={th}>Landings</th>
              <th className={th}>Signups</th>
              <th className={th}>Sales</th>
            </tr>
          </thead>
          <tbody>
            {landings.length === 0 && (
              <tr>
                <td className={td} colSpan={4}>
                  No landings recorded in this range.
                </td>
              </tr>
            )}
            {landings.map(([host, count]) => (
              <tr key={host}>
                <td className={td}>{host}</td>
                <td className={td}>{count}</td>
                <td className={td}>{signups.get(host) ?? 0}</td>
                <td className={td}>{salesByHost.get(host) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-lg font-semibold mt-8 mb-2">By UTM source / campaign</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Source / campaign</th>
              <th className={th}>Landings</th>
              <th className={th}>Signups (by source)</th>
            </tr>
          </thead>
          <tbody>
            {utmRows.length === 0 && (
              <tr>
                <td className={td} colSpan={3}>
                  No tagged traffic in this range.
                </td>
              </tr>
            )}
            {utmRows.map(([label, count]) => (
              <tr key={label}>
                <td className={td}>{label}</td>
                <td className={td}>{count}</td>
                <td className={td}>{utmSignupsBySource.get(label.split(" / ")[0]) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-lg font-semibold mt-8 mb-2">Sales ({sales.length})</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>When (PT)</th>
              <th className={th}>Buyer</th>
              <th className={th}>Product</th>
              <th className={th}>Referrer</th>
              <th className={th}>UTM source</th>
              <th className={th}>Landed on</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr>
                <td className={td} colSpan={6}>
                  No sales in this range.
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr key={s.id}>
                <td className={td}>{fmt(s.createdAt)}</td>
                <td className={td}>{s.user.email}</td>
                <td className={td}>{s.product}</td>
                <td className={td}>{s.user.attributionReferrerHost ?? "—"}</td>
                <td className={td}>{s.user.attributionUtmSource ?? "—"}</td>
                <td className={td}>{s.user.attributionLandingPath ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify the admin gate**

With `npm run dev` running, open `http://localhost:3000/admin/attribution` while signed out.
Expected: 404, not a redirect and not a permission error.

- [ ] **Step 4: Verify the page renders for an admin**

Confirm your email is in `ADMIN_EMAILS` in `.env`, sign in as that user, and reload `/admin/attribution`.

Expected: three tables render. Given the test data from Tasks 3–7 you should see `www.instagram.com` and `(direct / none)` rows with non-zero landings, and the `plantest / stamp` row under UTM. Empty ranges show the "No … in this range" rows rather than blank tables — check by loading `?days=1` on a fresh database.

- [ ] **Step 5: Verify the range clamp**

Load `?days=999`, `?days=0`, and `?days=abc`.
Expected: 90, 1, and 7 days respectively — the header text reflects the clamped value each time and no query throws.

- [ ] **Step 6: Lint and commit**

```bash
NODE_OPTIONS='--max-old-space-size=4096' npx eslint app/admin/attribution/page.tsx
git add app/admin/attribution/page.tsx
git commit -m "feat(attribution): admin readout of landings, signups, and sales by source"
```

---

### Task 9: Full-build verification

**Files:** none — this task only verifies.

- [ ] **Step 1: Run the unit tests**

Run: `npx tsx --test lib/attribution.test.ts lib/consent.test.ts`
Expected: `# fail 0`

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Confirm the root layout stayed static**

In the build output route table, check the marker next to `/shft`.

Expected: `/shft` is **not** listed as dynamic (`ƒ`). If every route turned dynamic, something introduced a `headers()`/`cookies()` call into the root layout or a component it renders — that violates a Global Constraint and must be fixed before shipping, because it destroys the CDN caching `/shft` currently gets.

- [ ] **Step 5: Commit anything outstanding**

```bash
git status --short
```
Expected: clean. If not, review and commit the remainder.

---

## Post-merge notes for Troy

- **Nothing is backfilled.** The five 2026-08-11 buyers stay untraceable in this data; it only starts working from deploy forward. Yesterday's answer still has to come from Cloudflare referrer analytics, Meta Events Manager (pixel `1769503420886398`), or asking the buyers.
- **Verify `CF-IPCountry` reaches the app in production.** It depends on Cloudflare's IP Geolocation setting for the zone (on by default). After deploy, check a `landing_events` row has a non-null `country`. If it's null for real traffic, every visitor is being treated as strict and the pixel is off for everyone — that would show up as a sharp drop in Meta PageViews.
- **Update the Cookie Policy copy.** `/cookies` now understates things: it should list `sr_vid` and `sr_consent`, and describe the consent banner. The page currently implies there is no consent mechanism.
