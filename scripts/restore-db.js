#!/usr/bin/env node
/**
 * Restore a PostgreSQL database from a backup file (created by backup-db.js).
 * WARNING: This can replace DB content. To fully revert: run migrations (or
 * ensure schema exists), then this script. If you get "already exists" errors,
 * drop the schema first or use a fresh DB.
 *
 * Usage: node scripts/restore-db.js <backup-file>
 *   Example: node scripts/restore-db.js backups/samples-backup-2025-02-18T12-00-00.sql
 *
 * Uses DATABASE_URL from .env. For Supabase, use the Direct connection URL.
 */

const { execSync } = require("child_process")
const path = require("path")
const fs = require("fs")

require("dotenv").config({ path: path.join(process.cwd(), ".env") })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL || !DATABASE_URL.startsWith("postgresql")) {
  console.error("DATABASE_URL not set or invalid in .env")
  process.exit(1)
}

const backupFile = process.argv[2]
if (!backupFile || !fs.existsSync(backupFile)) {
  console.error("Usage: node scripts/restore-db.js <backup-file>")
  console.error("Example: node scripts/restore-db.js backups/samples-backup-2025-02-18T12-00-00.sql")
  process.exit(1)
}

console.log(`Restoring from ${backupFile} ...`)
try {
  execSync(`psql "${DATABASE_URL}" -f "${path.resolve(backupFile)}"`, {
    stdio: "inherit",
    shell: true,
  })
  console.log("Restore complete.")
} catch (e) {
  console.error("Restore failed.")
  process.exit(1)
}
