-- Guest checkout: an account created by a plugin purchase has no human-chosen
-- password. NULL here means "nobody has set a password on this account"; the
-- receipt email and the login page use it to offer "set a password" instead of
-- "sign in". Every account that exists before this column does have a
-- password (register always took one), hence the backfill.
--
-- Apply with:
--   npx prisma db execute --file prisma/migrations/manual/20260907_password_set_at.sql --schema prisma/schema.prisma
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_set_at" TIMESTAMP(3);
UPDATE "users" SET "password_set_at" = "created_at" WHERE "password_set_at" IS NULL;
