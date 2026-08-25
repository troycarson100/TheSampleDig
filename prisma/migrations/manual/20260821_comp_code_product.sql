-- Comp codes become product-aware: shft, drft, or bundle.
--
-- DEFAULT 'shft' is not cosmetic - every code minted before this column
-- existed was a shft comp, so the default is what makes the backfill correct
-- with no data migration. Applied with:
--   npx prisma db execute --file prisma/migrations/manual/20260821_comp_code_product.sql --schema prisma/schema.prisma
ALTER TABLE "comp_codes"
  ADD COLUMN IF NOT EXISTS "product" TEXT NOT NULL DEFAULT 'shft';

-- After applying, RLS on comp_codes is unchanged: this adds a column to an
-- existing table rather than creating one, so no new grants are needed.
