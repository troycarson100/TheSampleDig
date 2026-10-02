-- Gift links: a comp that is claimed from a link with one tap, no account.
-- See CompCode in schema.prisma and lib/gift-link.ts.
-- Applied by hand, like the others in this folder, BEFORE the code that uses
-- it is deployed (Prisma selects every column, so comp codes and /redeem fail
-- until these exist):
--   npx prisma db execute --file prisma/migrations/manual/20261002_gift_links.sql --schema prisma/schema.prisma
-- (this deploy pipeline runs only `prisma generate`, never `prisma migrate deploy`.)
-- Safe to run twice, and changes nothing about existing codes: they all
-- become kind 'code', which is what they are.

ALTER TABLE "comp_codes" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'code';
ALTER TABLE "comp_codes" ADD COLUMN IF NOT EXISTS "message" TEXT;
ALTER TABLE "comp_codes" ADD COLUMN IF NOT EXISTS "claim_token_hash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "comp_codes_claim_token_hash_key" ON "comp_codes"("claim_token_hash");
