-- CreateTable
CREATE TABLE IF NOT EXISTS "purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "stripe_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "purchases_stripe_session_id_key" ON "purchases"("stripe_session_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchases_user_id_idx" ON "purchases"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "purchases_user_id_product_key" ON "purchases"("user_id", "product");

-- AddForeignKey (idempotent: safe to run more than once)
DO $$ BEGIN
  ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
