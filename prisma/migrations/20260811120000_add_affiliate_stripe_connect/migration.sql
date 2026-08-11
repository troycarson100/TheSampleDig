-- Stripe Connect instant payouts for affiliates. Additive + idempotent.

ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "stripe_account_id" TEXT;
ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "stripe_payouts_enabled" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_stripe_account_id_key" ON "affiliates"("stripe_account_id");

ALTER TABLE "affiliate_referrals" ADD COLUMN IF NOT EXISTS "stripe_transfer_id" TEXT;
ALTER TABLE "affiliate_referrals" ADD COLUMN IF NOT EXISTS "stripe_transfer_reversal_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_referrals_stripe_transfer_id_key" ON "affiliate_referrals"("stripe_transfer_id");
