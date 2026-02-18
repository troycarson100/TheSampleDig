-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT,
ADD COLUMN IF NOT EXISTS "subscription_status" TEXT,
ADD COLUMN IF NOT EXISTS "subscription_current_period_end" TIMESTAMP(3);
