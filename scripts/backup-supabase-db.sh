#!/usr/bin/env bash
# Create a local Postgres logical backup of the database pointed at by DATABASE_URL (.env).
# Output: ./backups/supabase-YYYYMMDD-HHMMSS.dump (custom format; use pg_restore to restore)
#
# Supabase tips:
# - If pg_dump errors about "transaction mode" / pooler, use the **Direct connection**
#   URI from Project Settings → Database (not the pooler URL), or append
#   ?sslmode=require as required by your project.
# - This backs up **the database only**, not Storage files. Use Storage export separately if needed.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$ROOT/backups/supabase-${STAMP}.dump"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing .env in project root. Add DATABASE_URL (Supabase Postgres URI) and re-run."
  exit 1
fi

# Load DATABASE_URL without printing it
export DATABASE_URL="$(
  node -r dotenv/config -e "
    const u = process.env.DATABASE_URL;
    if (!u) { console.error('DATABASE_URL is not set in .env'); process.exit(1); }
    process.stdout.write(u);
  "
)"

run_pg_dump() {
  pg_dump "$DATABASE_URL" -Fc -f "$OUT"
}

if command -v pg_dump >/dev/null 2>&1; then
  run_pg_dump
  echo "Wrote: $OUT"
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  docker run --rm \
    -e DATABASE_URL \
    -v "$ROOT/backups:/out" \
    postgres:16-alpine \
    sh -c "pg_dump \"\$DATABASE_URL\" -Fc -f /out/supabase-${STAMP}.dump"
  echo "Wrote: $OUT"
  exit 0
fi

cat <<'EOF'
Neither `pg_dump` nor `docker` was found.

Install one of:
  macOS:  brew install libpq && brew link --force libpq   # adds pg_dump to PATH
          (or: brew install postgresql@16)

Then re-run:
  bash scripts/backup-supabase-db.sh

Alternatively use Supabase Dashboard:
  Project Settings → Database → Backups (plan-dependent),
  or SQL dump / third-party backup tools.
EOF
exit 1
