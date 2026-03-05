-- AlterTable: add email verification and password reset fields
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email_verified" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "email_verification_token" TEXT,
  ADD COLUMN IF NOT EXISTS "email_verification_expires" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "password_reset_token" TEXT,
  ADD COLUMN IF NOT EXISTS "password_reset_expires" TIMESTAMP(3);

-- Unique indexes for token lookups
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_verification_token_key" ON "users"("email_verification_token");
CREATE UNIQUE INDEX IF NOT EXISTS "users_password_reset_token_key" ON "users"("password_reset_token");

-- Backfill: mark all existing users as email-verified (set to their created_at date)
UPDATE "users" SET "email_verified" = "created_at" WHERE "email_verified" IS NULL;
