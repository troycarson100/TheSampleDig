-- A second email about a member offer, to the people it went to who have
-- neither used their code nor bought fltr since. See MemberOfferReminder and
-- MemberOfferReminderSend in schema.prisma and lib/offer-reminder.ts.
-- Applied by hand, like the others in this folder, and BEFORE the code that
-- reads these tables is deployed:
--   npx prisma db execute --file prisma/migrations/manual/20261002_member_offer_reminders.sql --schema prisma/schema.prisma
-- (this deploy pipeline runs only `prisma generate`, never `prisma migrate deploy`.)
-- Additive only: two new tables, nothing existing is altered.

CREATE TABLE IF NOT EXISTS "member_offer_reminders" (
    "id"              TEXT NOT NULL,
    "offer_id"        TEXT NOT NULL,
    "slug"            TEXT NOT NULL,
    "subject"         TEXT NOT NULL,
    "body_html"       TEXT NOT NULL,
    "owner_subject"   TEXT NOT NULL,
    "owner_body_html" TEXT NOT NULL,
    "sent_by_email"   TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at"    TIMESTAMP(3),
    CONSTRAINT "member_offer_reminders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "member_offer_reminders_offer_id_fkey" FOREIGN KEY ("offer_id")
        REFERENCES "member_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Load-bearing: the row is inserted before anyone is listed or mailed, so a
-- second claim of the same reminder hits this and aborts.
CREATE UNIQUE INDEX IF NOT EXISTS "member_offer_reminders_slug_key" ON "member_offer_reminders"("slug");

CREATE TABLE IF NOT EXISTS "member_offer_reminder_sends" (
    "id"          TEXT NOT NULL,
    "reminder_id" TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "variant"     TEXT NOT NULL,
    "sent_at"     TIMESTAMP(3),
    "failed_at"   TIMESTAMP(3),
    "skipped_at"  TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_offer_reminder_sends_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "member_offer_reminder_sends_reminder_id_fkey" FOREIGN KEY ("reminder_id")
        REFERENCES "member_offer_reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Load-bearing too: one row per person per reminder, so nobody is listed, and
-- so mailed, twice.
CREATE UNIQUE INDEX IF NOT EXISTS "member_offer_reminder_sends_reminder_id_user_id_key"
    ON "member_offer_reminder_sends"("reminder_id", "user_id");
CREATE INDEX IF NOT EXISTS "member_offer_reminder_sends_reminder_id_sent_at_idx"
    ON "member_offer_reminder_sends"("reminder_id", "sent_at");

-- Same hardening as `member_offers`: Prisma connects as the table-owning role
-- and bypasses RLS, so this costs the app nothing and closes both tables to
-- the PostgREST anon/authenticated roles. The rows carry people's codes.
ALTER TABLE "member_offer_reminders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_offer_reminder_sends" ENABLE ROW LEVEL SECURITY;

-- anon/authenticated exist only on Supabase; guarded so this same file applies
-- cleanly to a plain local Postgres too.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "member_offer_reminders" FROM anon;
    REVOKE ALL ON "member_offer_reminder_sends" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "member_offer_reminders" FROM authenticated;
    REVOKE ALL ON "member_offer_reminder_sends" FROM authenticated;
  END IF;
END
$$;
