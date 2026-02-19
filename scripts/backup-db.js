#!/usr/bin/env node
/**
 * Backup the current PostgreSQL database to a timestamped file.
 * Uses DATABASE_URL from .env. For Supabase, use the "Direct connection" URL
 * (not the pooler) if pg_dump fails.
 *
 * Usage: node scripts/backup-db.js [outputDir]
 *   outputDir defaults to ./backups
 *
 * Creates: backups/samples-backup-YYYY-MM-DDTHHmmss.sql
 * Restore: psql $DATABASE_URL < backups/samples-backup-YYYY-MM-DDTHHmmss.sql
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

const outputDir = path.resolve(process.cwd(), process.argv[2] || "backups")
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const filename = `samples-backup-${timestamp}.sql`
const filepath = path.join(outputDir, filename)

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
  console.log(`Created ${outputDir}`)
}

console.log(`Backing up to ${filepath} ...`)
try {
  execSync(`pg_dump "${DATABASE_URL}" --no-owner --no-acl -f "${filepath}"`, {
    stdio: "inherit",
    shell: true,
  })
  const stat = fs.statSync(filepath)
  console.log(`Done. ${filename} (${(stat.size / 1024).toFixed(1)} KB)`)
} catch (e) {
  console.error("pg_dump failed. If using Supabase, try DATABASE_URL with the Direct connection string from Project Settings > Database.")
  process.exit(1)
}
