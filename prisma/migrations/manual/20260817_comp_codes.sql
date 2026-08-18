-- Applied by hand with `prisma db execute` — this deploy pipeline runs only
-- `prisma generate`, never `prisma migrate deploy`.
--
-- Applied to production Supabase on 2026-08-18. Verified: table + indexes +
-- FKs match this file, RLS enabled, anon/authenticated grants revoked.

CREATE TABLE "comp_codes" (
    "id"                    TEXT NOT NULL,
    "code"                  TEXT NOT NULL,
    "note"                  TEXT,
    "created_by_email"      TEXT,
    "expires_at"            TIMESTAMP(3),
    "revoked_at"            TIMESTAMP(3),
    "redeemed_at"           TIMESTAMP(3),
    "redeemed_by_user_id"   TEXT,
    "purchase_id"           TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comp_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "comp_codes_code_key" ON "comp_codes"("code");
CREATE UNIQUE INDEX "comp_codes_purchase_id_key" ON "comp_codes"("purchase_id");
CREATE INDEX "comp_codes_redeemed_by_user_id_idx" ON "comp_codes"("redeemed_by_user_id");

ALTER TABLE "comp_codes"
    ADD CONSTRAINT "comp_codes_redeemed_by_user_id_fkey"
    FOREIGN KEY ("redeemed_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "comp_codes"
    ADD CONSTRAINT "comp_codes_purchase_id_fkey"
    FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Same hardening as `purchases` / `license_activations`: Prisma connects as
-- the table-owning postgres role and bypasses RLS, so this costs the app
-- nothing and closes the table to the PostgREST anon/authenticated roles.
ALTER TABLE "comp_codes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "comp_codes" FROM anon, authenticated;
