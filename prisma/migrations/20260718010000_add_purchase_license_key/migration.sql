-- AddColumn: reserved for future plugin licensing (unused at launch). Idempotent.
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "license_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "purchases_license_key_key" ON "purchases"("license_key");
