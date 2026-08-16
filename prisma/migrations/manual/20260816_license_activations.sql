-- Applied by hand with `prisma db execute` — this deploy pipeline runs only
-- `prisma generate`, never `prisma migrate deploy`.

CREATE TABLE "license_activations" (
    "id"             TEXT NOT NULL,
    "purchase_id"    TEXT NOT NULL,
    "machine_ids"    TEXT[] NOT NULL DEFAULT '{}',
    "machine_name"   TEXT,
    "platform"       TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMP(3),
    CONSTRAINT "license_activations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "license_activations_purchase_id_idx"
    ON "license_activations"("purchase_id");

ALTER TABLE "license_activations"
    ADD CONSTRAINT "license_activations_purchase_id_fkey"
    FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Same hardening as `purchases`: Prisma connects as the table-owning postgres
-- role and bypasses RLS, so this costs the app nothing and closes the table to
-- the PostgREST anon/authenticated roles.
ALTER TABLE "license_activations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "license_activations" FROM anon, authenticated;
