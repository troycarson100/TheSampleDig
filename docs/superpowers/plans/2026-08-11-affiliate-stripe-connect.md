# Affiliate Stripe Connect Instant Payouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instant per-sale Stripe Connect payouts for shft affiliates, with self-serve Express onboarding from the creator dashboard, automatic refund reversals, and an admin "Pay via Stripe" for accrued balances.

**Architecture:** Four new columns; a new `lib/affiliate-stripe.ts` holding every Connect call (all failure-isolated); `recordAffiliateReferral` gains a post-create instant-transfer attempt; `charge.refunded` gains reversal; one public connect endpoint; dashboard + admin UI additions.

**Tech Stack:** Existing stack + Stripe Connect Express (`stripe` SDK v20 already installed).

**Spec:** `docs/superpowers/specs/2026-08-11-affiliate-stripe-connect-design.md`

## Global Constraints

- Purchases are sacred: every Connect call in the sale path is caught and logged, never thrown.
- Idempotency: transfers use key `aff-transfer-<referralId>`; accrued payouts `aff-payout-<payoutId>`; `stripeTransferId` is unique.
- US Express accounts only in v1.
- Match existing conventions (snake_case maps, idempotent SQL, site design tokens, `@/` imports).
- Lint scoped files with `NODE_OPTIONS='--max-old-space-size=4096' npx eslint <files>` (repo-wide lint OOMs).

---

### Task 1: Schema + migration

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/20260811120000_add_affiliate_stripe_connect/migration.sql`

- [ ] Add to `Affiliate`: `stripeAccountId String? @unique @map("stripe_account_id")`, `stripePayoutsEnabled Boolean @default(false) @map("stripe_payouts_enabled")`. Add to `AffiliateReferral`: `stripeTransferId String? @unique @map("stripe_transfer_id")`, `stripeTransferReversalId String? @map("stripe_transfer_reversal_id")`.
- [ ] Migration SQL (idempotent):

```sql
ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "stripe_account_id" TEXT;
ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "stripe_payouts_enabled" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_stripe_account_id_key" ON "affiliates"("stripe_account_id");
ALTER TABLE "affiliate_referrals" ADD COLUMN IF NOT EXISTS "stripe_transfer_id" TEXT;
ALTER TABLE "affiliate_referrals" ADD COLUMN IF NOT EXISTS "stripe_transfer_reversal_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_referrals_stripe_transfer_id_key" ON "affiliate_referrals"("stripe_transfer_id");
```

- [ ] `npx prisma validate && npx prisma generate && npx prisma migrate deploy` (additive only). Note: stop the dev server first if the Supabase pooler is saturated.
- [ ] Commit: `feat(affiliate): schema for Stripe Connect instant payouts`

### Task 2: Pure guard predicate (TDD)

**Files:** Modify `lib/affiliate-logic.ts`, `scripts/test-affiliate-logic.ts`

**Interfaces:** `canInstantPayout(input: { refundedAt: Date | null; stripeTransferId: string | null; payoutId: string | null; stripeAccountId: string | null; stripePayoutsEnabled: boolean }): boolean` — true only when not refunded, not already transferred, not manually paid, account present, payouts enabled.

- [ ] Add failing checks: enabled+clean → true; each disqualifier alone → false (refunded, has transferId, has payoutId, no account, payouts disabled).
- [ ] Run (fail) → implement → run (pass) → commit: `feat(affiliate): instant-payout guard predicate`

### Task 3: Connect module + sale-path wiring + refund reversal

**Files:** Create `lib/affiliate-stripe.ts`; Modify `lib/affiliate.ts`, `app/api/stripe/webhook/route.ts`

- [ ] `lib/affiliate-stripe.ts` exports (per spec): `ensureOnboardingUrl`, `refreshPayoutStatus`, `sendInstantCommission`, `payAccruedViaStripe`, `reverseTransferForRefund`. Key mechanics:
  - `sendInstantCommission(referralId)`: load referral+affiliate → `canInstantPayout` → retrieve PI (`referral.stripePaymentIntentId`) → `latest_charge` id → `transfers.create({ amount: commissionCents, currency, destination, source_transaction: chargeId, metadata }, { idempotencyKey })` → save `stripeTransferId`. Entirely try/caught.
  - `payAccruedViaStripe`: DB transaction stamps owed referrals with a new payout (note "Stripe transfer pending"); then transfer from platform balance; success → note `Stripe transfer <id>`; failure → un-stamp, delete payout, rethrow.
  - `reverseTransferForRefund(referralId)`: `transfers.createReversal(transferId, {}, { idempotencyKey: 'aff-reversal-<referralId>' })` → save reversal id; caught/logged.
- [ ] `lib/affiliate.ts`: after successful referral create, `await sendInstantCommission(referral.id)`. Stats: `paidOut = payoutId || stripeTransferId`; owed excludes both; `refundedAfterPayoutCents` = refunded && (payoutId || (stripeTransferId && !stripeTransferReversalId)).
- [ ] Webhook `charge.refunded`: `findMany` matching referrals (paymentIntentId, refundedAt null) → per referral: set `refundedAt`, then `reverseTransferForRefund`.
- [ ] Lint scoped; commit: `feat(affiliate): instant transfers, accrued Stripe payouts, refund reversals`

### Task 4: Connect endpoint + creator dashboard payout section

**Files:** Create `app/api/affiliate/connect/route.ts`, `components/affiliate/ConnectStripeButton.tsx`; Modify `components/affiliate/AffiliateDashboard.tsx`, `app/affiliate/[token]/page.tsx`, `app/affiliate/page.tsx`

- [ ] Endpoint POST `{ token? }`: resolve affiliate by `dashboardToken`, else session `userId`; 404 unknown. `returnUrl` = token page or `/affiliate`. Return `{ url }` from `ensureOnboardingUrl`; Stripe-not-configured → 503 "Payouts aren't ready yet."; Connect-not-enabled Stripe error → 503 with that message.
- [ ] `ConnectStripeButton` (client): POSTs, redirects to `url`, inline error text on failure. Props: `token?: string`, `label: string`.
- [ ] Dashboard: new "Payouts" card between the link card and stat tiles. Props gain `payout: { connected: boolean; enabled: boolean }` and `connectToken?: string`. Enabled → "Instant payouts on — your cut is sent to your Stripe account right after each sale." Connected-not-enabled → "Finish Stripe setup" button. Not connected → "Connect Stripe to get paid automatically" button + one line: until then earnings accrue and are paid manually. Site tokens throughout.
- [ ] Both pages: while `stripeAccountId && !stripePayoutsEnabled`, call `refreshPayoutStatus` on load; pass props.
- [ ] Lint scoped; commit: `feat(affiliate): self-serve Stripe onboarding from creator dashboard`

### Task 5: Admin Stripe status + Pay via Stripe

**Files:** Create `app/api/admin/affiliates/[id]/stripe-payout/route.ts`; Modify `app/api/admin/affiliates/route.ts`, `components/affiliate/AdminAffiliates.tsx`

- [ ] Admin GET: include `stripeAccountId`, `stripePayoutsEnabled`; refresh pending statuses (accountId set, enabled false) via `refreshPayoutStatus` in a caught block.
- [ ] New route POST: `requireAdmin` → `payAccruedViaStripe(id)` → `{ payout }`; errors → 400/500 with message.
- [ ] UI: status text in expanded row ("payouts on" primary / "setup incomplete" muted / "not connected" muted); "Pay via Stripe ($X)" button (enabled && owed > 0, confirm dialog) alongside existing "Record payout".
- [ ] Lint scoped; commit: `feat(affiliate): admin Stripe payout controls`

### Task 6: Verification

- [ ] `npx tsx scripts/test-affiliate-logic.ts` all pass; scoped eslint clean; `npx tsc --noEmit` no new errors; `npm run build` succeeds.
- [ ] Dev server: both dashboards render the payout card; connect button POST returns 503-with-message while Connect is not enabled (expected pre-enablement); admin shows statuses.
- [ ] Post-deploy checklist for Troy: enable Connect (Express) in Stripe Dashboard; then a live/test sale through a connected affiliate verifies transfer + reversal paths.
