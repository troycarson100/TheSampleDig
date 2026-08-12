-- AlterTable
ALTER TABLE "users" ADD COLUMN     "attribution_landing_path" TEXT,
ADD COLUMN     "attribution_referrer_host" TEXT,
ADD COLUMN     "attribution_utm_campaign" TEXT,
ADD COLUMN     "attribution_utm_source" TEXT,
ADD COLUMN     "attribution_visitor_id" TEXT;

-- CreateTable
CREATE TABLE "landing_events" (
    "id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "referrer" TEXT,
    "referrer_host" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "landing_path" TEXT NOT NULL,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_events_visitor_id_key" ON "landing_events"("visitor_id");

-- CreateIndex
CREATE INDEX "landing_events_created_at_idx" ON "landing_events"("created_at");

-- CreateIndex
CREATE INDEX "landing_events_referrer_host_created_at_idx" ON "landing_events"("referrer_host", "created_at");

-- CreateIndex
CREATE INDEX "users_attribution_visitor_id_idx" ON "users"("attribution_visitor_id");

