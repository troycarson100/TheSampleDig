/**
 * Refuses to run when DATABASE_URL resolves to the production Supabase host,
 * unless ALLOW_PROD_DB=1 is set explicitly.
 *
 * `.env` in this repo carries the PRODUCTION DATABASE_URL; `.env.local`
 * overrides it for local Postgres. Next.js layers both, but a standalone
 * script that only loads `.env` (e.g. `node -r dotenv/config`, or a bare
 * `import "dotenv/config"`) silently targets production. That is how a
 * stray test row reached production before this guard existed.
 *
 * Import this AFTER whatever loads your env files (dotenv config() calls,
 * `./load-env`, or `./ensure-single-db-connection`) and BEFORE anything that
 * imports `@/lib/db` or `@prisma/client` - same ordering rule as
 * ensure-single-db-connection.ts, and for the same reason: process.env must
 * already hold the real DATABASE_URL before this checks it.
 *
 * Detection is by HOST ONLY, never by comparing the full connection string -
 * that string carries credentials, and this file never reads, stores, or
 * logs them, only the hostname `new URL()` parses out.
 */

const PROD_HOST_SUFFIXES = [".supabase.co", ".supabase.com"]

function prodHostFrom(databaseUrl: string): string | null {
  let host: string
  try {
    host = new URL(databaseUrl).hostname.toLowerCase()
  } catch {
    return null // unparseable - not this guard's problem, let the real client fail
  }
  return PROD_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)) ? host : null
}

export function assertNotProductionDatabase(env: NodeJS.ProcessEnv = process.env): void {
  const url = env.DATABASE_URL
  if (!url) return

  const host = prodHostFrom(url)
  if (!host) return

  if (env.ALLOW_PROD_DB === "1") {
    console.warn(
      `[ensure-not-production-db] DATABASE_URL points at production (${host}) - ` +
        "proceeding because ALLOW_PROD_DB=1.",
    )
    return
  }

  console.error(
    [
      `[ensure-not-production-db] Refusing to run: DATABASE_URL points at production (${host}).`,
      "",
      "This script is meant for local work. Load .env.local instead - it overrides",
      "DATABASE_URL with the local Postgres connection. Running with plain",
      '`node -r dotenv/config` or a bare `import "dotenv/config"` only reads .env and',
      "silently hits production; load .env.local explicitly (see scripts/load-env.ts,",
      "or add `config({ path: \".env.local\" })` before `.env`).",
      "",
      "If production really is what you intend, opt in explicitly:",
      "  ALLOW_PROD_DB=1 npx tsx scripts/<name>.ts",
    ].join("\n"),
  )
  process.exit(1)
}

assertNotProductionDatabase()
