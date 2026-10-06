-- The social links a creator applies with (the /creators form asks for 1-3).
-- See AffiliateApplication.socials in schema.prisma and readSocials in
-- lib/affiliate-application-logic.ts. Applied by hand BEFORE the code that
-- uses it is deployed - Prisma selects every column, so the applications list
-- in /admin/affiliates and the apply form fail until it exists:
--   npx prisma db execute --file prisma/migrations/manual/20261007_affiliate_application_socials.sql --schema prisma/schema.prisma
-- Safe to run twice. Applications already in get an empty list.

ALTER TABLE "affiliate_applications" ADD COLUMN IF NOT EXISTS "socials" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
