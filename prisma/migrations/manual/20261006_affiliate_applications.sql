-- Creator program applications (the public /creators page) and the country a
-- creator is paid in. See AffiliateApplication and Affiliate.country in
-- schema.prisma, lib/affiliate-application.ts and lib/creator-countries.ts.
-- Applied by hand, like the others in this folder, BEFORE the code that uses
-- it is deployed (Prisma selects every column, so /admin/affiliates and the
-- creator dashboards fail until these exist):
--   npx prisma db execute --file prisma/migrations/manual/20261006_affiliate_applications.sql --schema prisma/schema.prisma
-- Safe to run twice. Existing creators become "US", which is what the site
-- has been registering every one of them as.

ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'US';

CREATE TABLE IF NOT EXISTS "affiliate_applications" (
    "id"           TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "country"      TEXT NOT NULL,
    "plugin"       TEXT NOT NULL,
    "message"      TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'pending',
    "affiliate_id" TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at"   TIMESTAMP(3),
    CONSTRAINT "affiliate_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_applications_affiliate_id_key" ON "affiliate_applications"("affiliate_id");
CREATE INDEX IF NOT EXISTS "affiliate_applications_status_idx" ON "affiliate_applications"("status");
CREATE INDEX IF NOT EXISTS "affiliate_applications_email_idx" ON "affiliate_applications"("email");

-- Supabase exposes tables over its REST API unless RLS is on. The site reaches
-- this table only through Prisma's direct connection, which bypasses RLS, so
-- this denies everything to the anon/authenticated roles and nothing else.
ALTER TABLE "affiliate_applications" ENABLE ROW LEVEL SECURITY;
