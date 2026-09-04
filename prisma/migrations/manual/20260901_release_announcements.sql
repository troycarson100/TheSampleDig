-- Release announcement emails ("drft v1.1.3 - Out Now") to everyone who owns
-- the product. Applied by hand with:
--   npx prisma db execute --file prisma/migrations/manual/20260901_release_announcements.sql --schema prisma/schema.prisma
-- (this deploy pipeline runs only `prisma generate`, never `prisma migrate deploy`.)

-- Consent for release notices, layered on top of the marketing/newsletter
-- flag: a release email goes only to owners with BOTH columns true, so
-- existing marketing opt-outs are honoured without any backfill here.
-- DEFAULT true matches email_marketing_opt_in: every buyer who still accepts
-- email from us is opted in, which is the expected default for a version
-- notice about software they paid for.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "product_update_opt_in" BOOLEAN NOT NULL DEFAULT true;

-- One row per blast. The UNIQUE(product, version) below is load-bearing: the
-- row is inserted BEFORE the first email is sent, so a duplicate attempt hits
-- the constraint and aborts rather than mailing the whole customer list twice.
CREATE TABLE IF NOT EXISTS "release_announcements" (
    "id"             TEXT NOT NULL,
    "product"        TEXT NOT NULL,
    "version"        TEXT NOT NULL,
    "subject"        TEXT NOT NULL,
    "body_html"      TEXT NOT NULL,
    "sent_by_email"  TEXT,
    "sent_emails"    TEXT[] NOT NULL DEFAULT '{}',
    "failed_emails"  TEXT[] NOT NULL DEFAULT '{}',
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at"   TIMESTAMP(3),
    CONSTRAINT "release_announcements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "release_announcements_product_version_key"
    ON "release_announcements"("product", "version");

-- Same hardening as `purchases` and `license_activations`: Prisma connects as
-- the table-owning postgres role and bypasses RLS, so this costs the app
-- nothing and closes the table to the PostgREST anon/authenticated roles.
ALTER TABLE "release_announcements" ENABLE ROW LEVEL SECURITY;

-- anon/authenticated are Supabase's PostgREST roles and do not exist in a
-- plain local Postgres, where a bare REVOKE aborts the whole script. Guarded
-- so this same file applies cleanly to both the dev database and production.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "release_announcements" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "release_announcements" FROM authenticated;
  END IF;
END
$$;
