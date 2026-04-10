-- All existing accounts are treated as opted in to product/marketing email unless they change it in Settings later.
-- (Adds explicit backfill in addition to NOT NULL DEFAULT true on column add.)
UPDATE "users" SET "email_marketing_opt_in" = true;
