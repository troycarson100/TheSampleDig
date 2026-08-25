# creator program spans shft + drft — dashboard, product labels, copy

**Date:** 2026-08-24
**Status:** Approved (brainstormed with Troy)

## Overview

Affiliate attribution already works for every product. All three checkouts
(`/api/shft/checkout`, `/api/drft/checkout`, `/api/bundle/checkout`) read the
same `shft_ref` cookie and expose the same `creator_code` custom field, and the
Stripe webhook plus all three claim routes call `recordAffiliateReferral`. A
drft sale through a creator's link pays commission today.

What is still shft-only is everything the creator sees and shares. This spec
closes that gap and nothing else.

| Gap | Location |
| --- | --- |
| Share link hardcoded to `/shft?ref=` | `components/affiliate/AffiliateDashboard.tsx:28` |
| Eyebrow reads "shft affiliate" | `components/affiliate/AffiliateDashboard.tsx:39` |
| "The shft affiliate program is invite-only" | `app/affiliate/page.tsx:48` |
| Admin eyebrow reads "shft affiliate program" | `components/affiliate/AdminAffiliates.tsx:210` |
| Admin per-affiliate ref link is `/shft?ref=` | `components/affiliate/AdminAffiliates.tsx:358` |
| Sales table cannot say which product sold | no `product` on `AffiliateReferral` |

## Scope

One code, one rate, every product. **No change to how commission is
calculated, attributed, or paid.**

Explicit non-goals:

- **Per-product commission rates.** A flat rate spans four price points today
  ($19 shft, $19 drft, $34 bundle, $15 crossgrade), so a flat $10 is 26% of a
  bundle and 66% of a crossgrade. Real, and deliberately not solved here.
- **The Creator ↔ AffiliateCode split** (multiple codes per person, scoped per
  product). Still the eventual direction; out of scope.
- **Renaming the `shft_ref` cookie.** Renaming drops every in-flight 60-day
  attribution window for zero user-visible gain. It is an internal name and it
  stays.

## Schema

One column on `AffiliateReferral`:

```prisma
model AffiliateReferral {
  // What this sale was for: "shft" | "drft" | "bundle". Snapshot at sale time,
  // like commissionCents — the purchase row cannot answer this, because a
  // bundle referral hangs off the shft purchase to keep the relation 1:1.
  product String @default("shft")
}
```

Migration `prisma/migrations/manual/20260824_affiliate_referral_product.sql`,
following the `manual/` convention this repo uses for column additions:

```sql
ALTER TABLE "affiliate_referrals"
  ADD COLUMN IF NOT EXISTS "product" TEXT NOT NULL DEFAULT 'shft';
```

**This project has two databases, and a migration must be applied to both.**
They are selected by different env-file loaders, which is easy to miss:

| File | `DATABASE_URL` | Loaded by |
| --- | --- | --- |
| `.env.local` | `127.0.0.1:5432/sampleroll_dev` | Next.js (takes precedence) — so **the running app** |
| `.env` | `…pooler.supabase.com/postgres` | Prisma CLI, and any bare `tsx` script — so **production** |

Production (Prisma CLI reads `.env`, so no override needed):

```
npx prisma db execute --file prisma/migrations/manual/20260824_affiliate_referral_product.sql --schema prisma/schema.prisma
```

Local dev (must be run separately, or `npm run dev` throws
`The column affiliate_referrals.product does not exist in the current database`):

```
psql "$(rg -N '^DATABASE_URL=' .env.local | head -1 | sed 's/^DATABASE_URL=//' | tr -d '\"')" \
  -v ON_ERROR_STOP=1 -f prisma/migrations/manual/20260824_affiliate_referral_product.sql
```

Applying to production alone is exactly the mistake made during this
branch's implementation: every automated check passed — the migration ran,
`tsc` passed, and a read-only script confirmed the column — because all of
them read `.env` and hit production. The dev server, reading `.env.local`,
was the only thing pointed at the database that still lacked the column, and
it failed on first page load.

The default is the backfill. Verified against production rather than assumed:
at migration time exactly one referral row existed, dated 2026-08-12 — eight
days before the 2026-08-20 drft launch — for a $19.00 shft sale, so `'shft'`
is the correct label for it. (An earlier draft of this spec justified the
default by asserting that every referral predated the drft launch. That
reasoning was unsound: drft and bundle checkout went live *on* 2026-08-20 and
this column was added on the 24th, leaving a four-day window the claim did not
cover. The data happened to be clean; the argument was not.) This mirrors
`CompCode.product` (`prisma/migrations/manual/20260821_comp_code_product.sql`),
which solved the same problem the same way three days earlier.

`manual/` + `db execute` rather than a tracked migration folder + `migrate dev`
is deliberate. The Prisma CLI resolves `DATABASE_URL` from `.env`, which is the
production Supabase database, so `migrate dev` would run drift detection
against prod — the hazard that required repairing `_prisma_migrations` in
August. `db execute` runs the one statement and touches no migration history.
`IF NOT EXISTS` makes re-running it a no-op.

(`docs/DEPLOYMENT-DIGITALOCEAN.md` says local and production should share one
database. That is no longer true of the app: `.env.local` points it at a local
`sampleroll_dev`. The doc still holds for the Prisma CLI, which is what makes
the split so easy to trip over.)

Adding a column to an existing table needs no new RLS grants.

### Why stamp rather than derive

Deriving the label from `purchase.product` would be free, but wrong for
bundles. A bundle referral is attached to the **shft** purchase row
(`app/api/stripe/webhook/route.ts:107`, `app/api/bundle/claim/route.ts:73`)
because `AffiliateReferral ↔ Purchase` is one-to-one and crediting both rows
would double-pay. A derived label would therefore render a $34 bundle sale as
"shft $34.00", which reads as a bug to the creator.

## Write path

New pure helper in `lib/affiliate-logic.ts` — that file has no DB or Stripe
imports so `scripts/test-affiliate-logic.ts` can cover it standalone:

```ts
// The product a referral was earned on, from Stripe session metadata. Permissive
// on purpose: a future product slug labels itself correctly without anyone
// remembering to edit a list here. Falls back to "shft", matching the column
// default, for the legacy/missing case.
export function normalizeReferralProduct(raw: string | null | undefined): string {
  const p = (raw ?? "").toLowerCase().trim()
  return /^[a-z0-9-]{2,16}$/.test(p) ? p : "shft"
}
```

`recordAffiliateReferral` in `lib/affiliate.ts` stamps it into the
`affiliateReferral.create` data from `session.metadata?.product`, which all
three checkouts already set. No other write-path change; error handling,
idempotency (P2002), self-referral checks, and instant payout are untouched.

A crossgrade carries `metadata.product` of the plugin being bought, so it
renders as e.g. `drft $15.00`. The gross amount distinguishes it from a full
-price sale; no separate crossgrade label.

## Read path

`AffiliateStats.referrals[]` in `lib/affiliate.ts` gains `product: string`,
passed through from the referral row. One field on the existing mapping — no
new query, no change to totals, tiles, or payout math.

## Dashboard (`components/affiliate/AffiliateDashboard.tsx`)

### Links

Primary store link, then per-plugin links for creators making a video about one
specific plugin:

```
YOUR LINK
{baseUrl}/plugins?ref=troy

LINKING TO ONE PLUGIN?
shft   {baseUrl}/shft?ref=troy
drft   {baseUrl}/drft?ref=troy

YOUR CODE — buyers can type it at checkout
troy
```

`/plugins` is the storefront listing both plugins and the bundle. All three
links are `select-all` mono in `var(--primary)`, matching the existing single
link's treatment. The per-plugin pair sits under a secondary label inside the
same bordered card, so the primary link keeps visual priority.

### Sales table

A Product column between Date and Sale:

```
DATE          PRODUCT   SALE     YOUR CUT   VIA          STATUS
Aug 22, 2026  bundle    $34.00   $10.20     link         pending payout
Aug 21, 2026  drft      $19.00   $5.70      typed code   paid
Aug 19, 2026  shft      $19.00   $5.70      link         paid
```

Rendered lowercase in mono, matching how the site writes `shft` / `drft`
everywhere else.

### Copy

- Eyebrow: `shft affiliate` → `creator program`
- Subhead: "Share your link or code — sales on any plugin attribute
  automatically and show up here."

"creator program" matches what buyers already see at checkout — the field is
labelled "Creator code (optional)" and keyed `creator_code` — and matches the
Creator entity in the multi-code roadmap. No new vocabulary.

## Gate copy (`app/affiliate/page.tsx`)

> The creator program is invite-only. If you make videos and want in, reach out
> via the Discord — otherwise, nothing to see here.

## Admin (`components/affiliate/AdminAffiliates.tsx`)

Copy and link only, no logic:

- Eyebrow `shft affiliate program` → `creator program`
- Per-affiliate `refLink` → `${baseUrl}/plugins?ref=${a.code}`

The admin sales view is left alone; per-product admin reporting is not in scope.

## Testing

`scripts/test-affiliate-logic.ts` (run: `npx tsx scripts/test-affiliate-logic.ts`)
gains `normalizeReferralProduct` cases:

- `"shft"`, `"drft"`, `"bundle"` pass through unchanged
- `null`, `undefined`, `""` fall back to `"shft"`
- `"  DRFT  "` normalizes to `"drft"` (casing + whitespace)
- a garbage value (`"!!"`, or a 40-character string) falls back to `"shft"`
- an unknown-but-valid slug (`"pro"`) survives rather than collapsing to shft

Everything else in this spec is presentational and is verified by loading the
dashboard at `/affiliate` and the admin page at `/admin/affiliates`.

## Files touched

1. `prisma/schema.prisma` — `product` on `AffiliateReferral`
2. `prisma/migrations/manual/20260824_affiliate_referral_product.sql`
3. `lib/affiliate-logic.ts` — `normalizeReferralProduct`
4. `lib/affiliate.ts` — stamp on write, expose on read
5. `components/affiliate/AffiliateDashboard.tsx` — links, product column, copy
6. `app/affiliate/page.tsx` — gate copy
7. `components/affiliate/AdminAffiliates.tsx` — eyebrow copy, ref link
8. `scripts/test-affiliate-logic.ts` — new cases
