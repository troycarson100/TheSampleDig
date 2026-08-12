-- Per-affiliate commission model: percent of sale (default) or flat cents per sale.

ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "commission_type" TEXT NOT NULL DEFAULT 'percent';
ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "commission_flat_cents" INTEGER;
