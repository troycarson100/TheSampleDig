-- shft affiliate program: affiliates, clicks, referrals, payouts.
-- Idempotent (IF NOT EXISTS / duplicate_object guards) to match house style.

CREATE TABLE IF NOT EXISTS "affiliates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "commission_percent" INTEGER NOT NULL DEFAULT 30,
    "dashboard_token" TEXT NOT NULL,
    "user_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_code_key" ON "affiliates"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_dashboard_token_key" ON "affiliates"("dashboard_token");
CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_user_id_key" ON "affiliates"("user_id");

CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "affiliate_clicks_affiliate_id_created_at_idx" ON "affiliate_clicks"("affiliate_id", "created_at");

CREATE TABLE IF NOT EXISTS "affiliate_referrals" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "stripe_session_id" TEXT NOT NULL,
    "stripe_payment_intent_id" TEXT,
    "gross_amount_cents" INTEGER NOT NULL,
    "commission_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "refunded_at" TIMESTAMP(3),
    "payout_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_referrals_purchase_id_key" ON "affiliate_referrals"("purchase_id");
CREATE INDEX IF NOT EXISTS "affiliate_referrals_affiliate_id_created_at_idx" ON "affiliate_referrals"("affiliate_id", "created_at");
CREATE INDEX IF NOT EXISTS "affiliate_referrals_stripe_payment_intent_id_idx" ON "affiliate_referrals"("stripe_payment_intent_id");

CREATE TABLE IF NOT EXISTS "affiliate_payouts" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "note" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_payouts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (idempotent: safe to run more than once)
DO $$ BEGIN
  ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "affiliate_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Supabase convention: RLS on, no policies (Prisma connects as owner and bypasses).
ALTER TABLE "affiliates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "affiliate_clicks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "affiliate_referrals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "affiliate_payouts" ENABLE ROW LEVEL SECURITY;
