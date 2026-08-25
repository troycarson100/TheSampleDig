-- Affiliate referrals become product-aware: shft, drft, or bundle.
--
-- DEFAULT 'shft' is not cosmetic - every referral recorded before this column
-- existed predates the 2026-08-20 drft launch, so the default is what makes
-- the backfill correct with no data migration. Same shape as
-- 20260821_comp_code_product.sql. Applied with:
--   npx prisma db execute --file prisma/migrations/manual/20260824_affiliate_referral_product.sql --schema prisma/schema.prisma
--
-- Deliberately NOT a tracked migration folder: local DATABASE_URL points at the
-- same Supabase database as production, so `migrate dev` would run drift
-- detection against prod. `db execute` runs this one statement and touches no
-- migration history.
ALTER TABLE "affiliate_referrals"
  ADD COLUMN IF NOT EXISTS "product" TEXT NOT NULL DEFAULT 'shft';

-- Adding a column to an existing table needs no new RLS grants.
