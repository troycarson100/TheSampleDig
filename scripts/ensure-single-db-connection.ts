/**
 * Force a single DB connection for scripts. Import this after dotenv and before
 * any code that loads Prisma (e.g. lib/database-samples). Prisma defaults to a
 * connection pool; long-running scripts can exhaust the DB limit (e.g. Session
 * mode), so we cap to 1 connection when running standalone.
 */
const url = process.env.DATABASE_URL
if (url && !url.includes("connection_limit")) {
  process.env.DATABASE_URL =
    url + (url.includes("?") ? "&" : "?") + "connection_limit=1"
}
