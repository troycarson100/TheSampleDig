-- Self-service email change. The new address is held here, unconfirmed, until
-- the owner opens the link we send to it; only then does users.email move.
-- Deliberately NOT reusing the password_reset_* columns: a purchase-created
-- account often holds a live set-password token at the same time, and one
-- would overwrite the other.
--
-- Apply LOCALLY with (note the explicit --url; a bare --schema targets .env,
-- which is production):
--   npx prisma db execute --url "postgresql://troycarson@127.0.0.1:5432/sampleroll_dev" --file prisma/migrations/manual/20260908_email_change.sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_change_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_change_expires" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_change_token_key" ON "users"("email_change_token");
