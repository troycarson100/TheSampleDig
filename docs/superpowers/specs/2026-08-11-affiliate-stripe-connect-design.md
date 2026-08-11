# Affiliate instant payouts via Stripe Connect — Design

**Date:** 2026-08-11
**Status:** Approved by Troy (instant per-sale payouts, self-serve onboarding button)
**Builds on:** `2026-08-11-shft-affiliate-program-design.md`

## Overview

Creators connect a Stripe Express account from their affiliate dashboard. Once connected, each attributed shft sale transfers their commission to their Stripe account seconds after the buyer pays, tied to the original charge. Sales before onboarding (or if a transfer fails) accrue as "owed" exactly as today; Troy can flush an accrued balance with one click ("Pay via Stripe") or keep using the manual "Record payout" for off-Stripe payments. Refunds automatically reverse the transfer.

Decisions: **instant at-sale payouts** (cheap digital product, refunds rare — Troy accepts transfer reversals); **onboarding button on the creator dashboard** (both token link and `/affiliate`); **US Express accounts only in v1** — international creators keep accruing and are paid manually.

## Schema (4 new columns, no new tables)

- `Affiliate.stripeAccountId String? @unique` — Express account (`acct_...`), created on first "Connect Stripe" click.
- `Affiliate.stripePayoutsEnabled Boolean @default(false)` — cached `payouts_enabled`; refreshed on dashboard/admin load while false (no Connect webhooks needed at this scale).
- `AffiliateReferral.stripeTransferId String? @unique` — set when the commission was instant-transferred.
- `AffiliateReferral.stripeTransferReversalId String?` — set when a refund successfully reversed the transfer.

**Stats semantics change:** a referral counts as *paid* when `payoutId != null || stripeTransferId != null`; *owed* excludes both. The "refunded after payout" admin warning covers refunded referrals that were manually paid **or** transferred but not successfully reversed.

## New module: `lib/affiliate-stripe.ts`

All functions no-op or throw cleanly when `STRIPE_SECRET_KEY` is unset; none may break a purchase.

- `ensureOnboardingUrl(affiliateId, returnUrl)` — creates the Express account if missing (`type: "express"`, `country: "US"`, `capabilities: { transfers: { requested: true } }`, affiliate email + id in metadata), saves `stripeAccountId`, returns a fresh `accountLinks.create(... type: "account_onboarding")` URL.
- `refreshPayoutStatus(affiliateId)` — retrieves the account while `stripePayoutsEnabled` is false; persists `payouts_enabled` when it flips. Returns current state.
- `sendInstantCommission(referralId)` — guards (not refunded, no transfer yet, no manual payout, affiliate payouts enabled), resolves the charge from the referral's payment intent (`latest_charge`), then `transfers.create({ amount: commissionCents, currency, destination, source_transaction: chargeId })` with idempotency key `aff-transfer-<referralId>`; stores `stripeTransferId`. Catches and logs every error — a failed transfer just leaves the sale owed.
- `payAccruedViaStripe(affiliateId)` — for accrued balances: stamps owed referrals with a new `AffiliatePayout` in a DB transaction, then transfers the total from the platform balance (idempotency key `aff-payout-<payoutId>`); on Stripe failure it un-stamps and deletes the payout, rethrowing so admin sees the error (e.g. insufficient platform balance).
- `reverseTransferForRefund(referral)` — `transfers.createReversal` on refund; stores the reversal id; failure is logged and surfaces via the admin warning.

## Touch points

- `lib/affiliate.ts` — `recordAffiliateReferral` calls `sendInstantCommission` after creating a referral (the webhook/claim race loser exits before this); `getAffiliateStats` gets the new paid/owed semantics.
- `app/api/stripe/webhook/route.ts` — `charge.refunded` now loads matching referrals, marks `refundedAt`, and attempts a reversal for transferred ones.
- `app/api/affiliate/connect/route.ts` (new) — POST `{ token? }`; resolves the affiliate by dashboard token or session (userId link), returns `{ url }` for redirect. 404 unknown, 503 when Stripe/Connect unavailable, with a clear message if Connect isn't enabled on the platform account yet.
- **Creator dashboard** — new payout section: "Connect Stripe to get paid automatically" (none) / "Finish Stripe setup" (started, incomplete) / "Instant payouts on" (enabled), via a small client `ConnectStripeButton`. Pages refresh pending status on load.
- **Admin panel** — Stripe status per affiliate (not connected / setup incomplete / payouts on), plus "Pay via Stripe ($X)" when connected with owed > 0 → new `app/api/admin/affiliates/[id]/stripe-payout` route. Existing manual "Record payout" unchanged.

## Error handling

Purchases are sacred: every Stripe Connect call inside the sale path is caught and logged. Transfer failure → sale stays owed. Reversal failure → admin warning. Connect-not-enabled → onboarding endpoint returns a friendly 503; dashboards render normally.

## Prerequisite (Troy, Stripe dashboard)

Enable Connect with Express accounts on the platform Stripe account (Dashboard → Connect → Get started). Until then, everything ships dormant: dashboards show the connect button, which explains Connect isn't ready.

## Testing

Pure guard predicate (`canInstantPayout`) added to `lib/affiliate-logic.ts` and covered in `scripts/test-affiliate-logic.ts`. Lint + build + dev-server render checks for both dashboards and admin. Live transfer/reversal paths require Connect enabled + a real or test-mode charge — flagged as post-deploy verification, same as the checkout flow.

## Out of scope

Non-US creators (accrue + manual), scheduled/net-30 automation, Connect webhooks (`account.updated` — polled on page load instead), payout emails, per-affiliate currency.
