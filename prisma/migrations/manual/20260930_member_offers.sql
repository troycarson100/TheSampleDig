-- A one-off discount mailed to existing accounts ("$10 off any plugin", at
-- fltr's launch), with one single-use Stripe promotion code per person. See
-- MemberOffer and MemberOfferCode in schema.prisma and lib/member-offer.ts.
-- Applied by hand, like the others in this folder:
--   npx prisma db execute --file prisma/migrations/manual/20260930_member_offers.sql --schema prisma/schema.prisma
-- (this deploy pipeline runs only `prisma generate`, never `prisma migrate deploy`.)

CREATE TABLE IF NOT EXISTS "member_offers" (
    "id"               TEXT NOT NULL,
    "slug"             TEXT NOT NULL,
    "amount_off_cents" INTEGER NOT NULL,
    "coupon_id"        TEXT,
    "cutoff_at"        TIMESTAMP(3) NOT NULL,
    "expires_at"       TIMESTAMP(3) NOT NULL,
    "subject"          TEXT NOT NULL,
    "body_html"        TEXT NOT NULL,
    "sent_by_email"    TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at"     TIMESTAMP(3),
    CONSTRAINT "member_offers_pkey" PRIMARY KEY ("id")
);

-- Load-bearing: the row is inserted before anything is created in Stripe or
-- mailed, so a second claim of the same offer hits this and aborts.
CREATE UNIQUE INDEX IF NOT EXISTS "member_offers_slug_key" ON "member_offers"("slug");

CREATE TABLE IF NOT EXISTS "member_offer_codes" (
    "id"                 TEXT NOT NULL,
    "offer_id"           TEXT NOT NULL,
    "user_id"            TEXT NOT NULL,
    "email"              TEXT NOT NULL,
    "code"               TEXT NOT NULL,
    "promotion_code_id"  TEXT,
    "sent_at"            TIMESTAMP(3),
    "failed_at"          TIMESTAMP(3),
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_offer_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "member_offer_codes_offer_id_fkey" FOREIGN KEY ("offer_id")
        REFERENCES "member_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_offer_codes_code_key" ON "member_offer_codes"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "member_offer_codes_offer_id_user_id_key"
    ON "member_offer_codes"("offer_id", "user_id");
CREATE INDEX IF NOT EXISTS "member_offer_codes_user_id_idx" ON "member_offer_codes"("user_id");

-- Same hardening as `release_announcements`: Prisma connects as the
-- table-owning role and bypasses RLS, so this costs the app nothing and closes
-- both tables to the PostgREST anon/authenticated roles. The codes are
-- discounts, so this matters more here than it did there.
ALTER TABLE "member_offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_offer_codes" ENABLE ROW LEVEL SECURITY;

-- anon/authenticated exist only on Supabase; guarded so this same file applies
-- cleanly to a plain local Postgres too.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "member_offers" FROM anon;
    REVOKE ALL ON "member_offer_codes" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "member_offers" FROM authenticated;
    REVOKE ALL ON "member_offer_codes" FROM authenticated;
  END IF;
END
$$;
