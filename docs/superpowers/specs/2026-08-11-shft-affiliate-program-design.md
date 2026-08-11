# shft Affiliate Program — Design

**Date:** 2026-08-11
**Status:** Approved pending user review

## Overview

An invite-only affiliate program for shft, built in-house (no third-party tool). Troy creates each affiliate by hand with a short code (e.g. `synthdad`) and a commission percentage. Creators share a link (`/shft?ref=synthdad`); viewers who heard the code in a video can also type it into an optional field on the Stripe checkout page. Attributed sales earn the creator a flat percentage of what the buyer actually paid (no buyer discount). Both sides can track clicks, sales, earnings, and payouts; Troy records manual payouts (PayPal etc.) in an admin page.

### Decisions made during brainstorming

- **Build in-house**, not a third-party tool (Rewardful etc.). Monthly fees don't make sense on a $19–39 one-time product, and the stack (Stripe Checkout + Prisma + NextAuth) already has every needed hook.
- **Invite-only** — no public signup. Troy creates affiliates from the admin page.
- **Flat % commission, no buyer discount.** Default 30%, stored per-affiliate so rates are negotiable.
- **Dashboard access both ways:** a private token URL (no login required) *and* `/affiliate` inside a logged-in SampleRoll account when the affiliate is linked to a user.

## Data model (Prisma, 4 new tables)

```prisma
model Affiliate {
  id                String   @id @default(cuid())
  code              String   @unique          // short slug, lowercase, e.g. "synthdad"
  name              String
  email             String
  commissionPercent Int      @default(30)     // whole percent, applied at sale time
  dashboardToken    String   @unique          // random, for /affiliate/[token]
  userId            String?  @unique          // optional link to a SampleRoll User
  active            Boolean  @default(true)
  notes             String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model AffiliateClick {
  id          String   @id @default(cuid())
  affiliateId String
  createdAt   DateTime @default(now())
  // index (affiliateId, createdAt)
}

model AffiliateReferral {
  id                    String    @id @default(cuid())
  affiliateId           String
  purchaseId            String    @unique      // idempotency: one referral per Purchase
  stripeSessionId       String
  stripePaymentIntentId String?                // for refund matching
  grossAmountCents      Int                    // session.amount_total (post-discount, pre-Stripe-fee)
  commissionCents       Int                    // snapshot at sale time; rate changes never rewrite history
  currency              String                 // "usd"
  refundedAt            DateTime?
  payoutId              String?                // set when included in an AffiliatePayout
  source                String                 // "link" | "code" (how it was attributed)
  createdAt             DateTime  @default(now())
}

model AffiliatePayout {
  id          String   @id @default(cuid())
  affiliateId String
  amountCents Int
  note        String?  // e.g. "PayPal txn 8XY..."
  paidAt      DateTime @default(now())
}
```

**Owed** = sum of `commissionCents` where `payoutId IS NULL AND refundedAt IS NULL`.

Relations use normal Prisma FKs (`Affiliate 1—n Click/Referral/Payout`, `Referral n—1 Payout`, `Affiliate 1—1? User`). RLS is enabled on new tables to match the existing migration convention.

## Attribution flow

1. **Click:** Creator shares `sampleroll.com/shft?ref=synthdad` (any page works). A small client component in the root layout detects `?ref=` on mount and POSTs `/api/affiliate/click` with the code. The route validates the affiliate exists and is active, inserts an `AffiliateClick`, and sets an httpOnly cookie `shft_ref=<code>` with a **60-day** expiry. **Last click wins** (a newer `?ref=` overwrites the cookie). Clicks are raw counts — no bot filtering or dedupe in v1; they're a relative gauge, not a billable metric.
2. **Checkout:** `app/api/shft/checkout/route.ts` reads the `shft_ref` cookie, validates it against an active affiliate, and passes it as `metadata.affiliateCode` on the Stripe session. The session also adds an optional Stripe `custom_fields` text field — key `creator_code`, label "Creator code (optional)" — so a viewer who heard the code but never clicked still counts.
3. **Sale:** A shared helper `lib/affiliate.ts → recordAffiliateReferral(session)` is called from **both** purchase write points — the `checkout.session.completed` branch of `app/api/stripe/webhook/route.ts` *and* the self-heal path in `app/api/shft/claim/route.ts` — after the Purchase upsert. It:
   - Resolves the code: **typed `creator_code` custom field wins over the cookie code.** Invalid typed code falls back to the cookie code; if neither resolves to an active affiliate, no referral.
   - Skips **self-referrals**: purchaser's `User.email` equals the affiliate's email, or `purchase.userId` equals `affiliate.userId`.
   - Computes `commissionCents = round(session.amount_total × commissionPercent / 100)` — commission is on what the buyer paid (net of any Stripe promo discount, gross of Stripe processing fees).
   - Creates the `AffiliateReferral`; the unique `purchaseId` makes the webhook/claim race idempotent (second insert is a no-op).
4. **Refunds:** The webhook handles `charge.refunded`: match the referral via `stripePaymentIntentId`, set `refundedAt`. Any refund (including partial — rare on a $19–39 product) claws back the full commission in v1. If the referral was already paid out, it stays stamped with its `payoutId`; the admin page surfaces a "refunded after payout: −$X" line for Troy to offset manually on the next payout.

## Dashboards

### Creator dashboard (two entry points, one shared component)

- **`/affiliate/[token]`** — resolved by `dashboardToken`, no login. This is the private link emailed on invite. `noindex` and excluded from the sitemap. If a link leaks, Troy regenerates the token from admin (old link dies).
- **`/affiliate`** — requires login. Resolves the affiliate by `Affiliate.userId`; if unset, falls back to matching the session user's **verified** email against `Affiliate.email` and persists `userId` on first match (auto-link). Unmatched users see a short "this program is invite-only" note.
- The logged-in account menu shows an **"Affiliate dashboard"** entry when the session user is a linked affiliate.
- Contents (same either way): their link and code with copy buttons, clicks (lifetime + last 30 days), sales count, gross revenue driven, commission earned, **amount owed**, and payout history with notes.

### Admin — `/admin/affiliates`

- Gated by a new `ADMIN_EMAILS` env allowlist (comma-separated, same pattern as `DEV_PRO_EMAILS`), checked server-side via `await auth()`.
- List all affiliates with clicks / sales / gross / owed at a glance.
- Create/edit affiliate: name, email, code, commission %, active toggle, notes. On create, if a `User` with that email exists, auto-link `userId`. Creation shows the dashboard token URL to copy into the invite email (invite emails are sent personally by Troy, not automated).
- Per-affiliate detail: referral list (date, amount, commission, source link/code, refunded flag), payout history.
- **Record payout:** form prefilled with the current owed amount, free-text note; stamps all currently-owed referrals with the new `payoutId`.
- Regenerate dashboard token.

## Touch points in existing code

- `app/api/shft/checkout/route.ts` — read cookie, add metadata + custom field.
- `app/api/stripe/webhook/route.ts` — call shared helper in the shft `checkout.session.completed` branch; add `charge.refunded` handling.
- `app/api/shft/claim/route.ts` — call the same shared helper.
- `app/layout.tsx` — mount the `?ref=` click-capture component.
- Account menu component — conditional "Affiliate dashboard" link.
- `prisma/schema.prisma` + one migration (with RLS enablement).
- `.env.example` — add `ADMIN_EMAILS`.

## Error handling

- Affiliate logic must **never break a purchase**: `recordAffiliateReferral` is wrapped so any thrown error is logged and swallowed — the Purchase upsert and email always complete.
- Invalid/inactive `?ref=` codes are ignored silently (no cookie, no click row).
- Unique-constraint conflict on `purchaseId` is treated as success (already recorded).

## Testing

The repo has no test framework, so:

- `lib/affiliate.ts` keeps the resolution/commission logic in **pure functions** (code priority, self-referral check, commission rounding) separate from DB writes; a `tsx` script under `scripts/` exercises them against fixture cases.
- One manual end-to-end run in Stripe **test mode**: click a ref link → buy → verify referral row, dashboard numbers, admin owed amount; then refund in the Stripe dashboard → verify clawback; then record a payout → verify owed hits zero.

## Out of scope (v1)

Self-serve signup, automated payouts, buyer discount codes, commissions on Pro subscriptions or future products (the `Purchase.product` field keeps this extensible), automated stat/invite emails, tax-form (W-9/1099) collection — handled manually, click bot-filtering, multi-currency (USD assumed; currency stored anyway).
