#!/usr/bin/env node
/**
 * Minimal validation (~2 pages, real exclusions) to confirm the pipeline will return results
 * before burning quota on a full populate. Run this BEFORE populate-until-10k.
 *
 * Usage: node scripts/validate-populate-pipeline.js [secret]
 * Env: POPULATE_SECRET, NEXTAUTH_URL or BASE_URL, SKIP_PAGES (default 15)
 *
 * Cost: ~17 API calls (15 skips + 2 pages) = ~1700 units. Much cheaper than a full failed run.
 * Exits 0 = GO, 1 = NO-GO
 */

require("dotenv/config")

const SECRET = process.argv[2] || process.env.POPULATE_SECRET || "change-me-in-production"
const SKIP_PAGES = Math.max(0, parseInt(process.env.SKIP_PAGES || "20", 10))
const BASE_URL = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000"
const REQUEST_TIMEOUT_MS = 3 * 60 * 1000

async function checkQuota() {
  const { spawnSync } = require("child_process")
  const r = spawnSync("node", ["-r", "dotenv/config", "scripts/check-youtube-quota.js"], {
    cwd: process.cwd(),
    stdio: "pipe",
    encoding: "utf-8",
  })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || "[Validate] Quota check failed")
    process.exit(1)
  }
}

async function main() {
  console.log("[Validate] Checking pipeline with real exclusions (2 pages, skipPages=" + SKIP_PAGES + ")...")
  console.log("[Validate] Cost: ~1700 units. Run this before full populate to avoid wasting quota.\n")

  await checkQuota()
  console.log("[Validate] Quota OK.\n")

  const url = `${BASE_URL}/api/samples/populate?secret=${encodeURIComponent(SECRET)}&limit=0&validate=1&verbose=true${SKIP_PAGES > 0 ? `&skipPages=${SKIP_PAGES}` : ""}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res, text
  try {
    res = await fetch(url, { method: "POST", signal: controller.signal })
    text = await res.text()
  } catch (e) {
    clearTimeout(timeout)
    if (e.name === "AbortError") {
      console.error("[Validate] Request timed out.")
      process.exit(1)
    }
    throw e
  }
  clearTimeout(timeout)

  if (!res.ok) {
    if (res.status === 401) {
      console.error("[Validate] Unauthorized: check POPULATE_SECRET")
      process.exit(1)
    }
    if (/quota|403|exceeded/i.test(text)) {
      console.error("[Validate] Quota exceeded. Try again when quota resets.")
      process.exit(1)
    }
    console.error("[Validate] Error:", text.slice(0, 300))
    process.exit(1)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    console.error("[Validate] Invalid JSON response")
    process.exit(1)
  }

  const rec = data.validationRecommendation
  const reason = data.validationReason || ""
  const details = data.validationDetails || {}

  console.log("--- Validation Result ---")
  console.log("Recommendation:", rec)
  console.log("Reason:", reason)
  if (Object.keys(details).length > 0) {
    console.log("Details:", JSON.stringify(details, null, 2))
  }
  if (details.errors > 0) {
    console.log("\n⚠️  API errors occurred (check server logs). Likely quota/403 on YouTube search.")
  }
  if (data.pageStats && data.pageStats.length > 0) {
    console.log("\nPage stats (rejection breakdown):")
    data.pageStats.forEach((p, i) => {
      console.log(`  Page ${i + 1}: raw=${p.rawCount} excluded=${p.excludedCount} candidates=${p.candidateCount} hardFilterReject=${p.hardFilterRejectCount ?? "?"} indicatorReject=${p.indicatorRejectCount ?? "?"} scoreReject=${p.scoreRejectCount ?? "?"} passed=${p.passedCount ?? "?"}`)
    })
  }
  console.log("-------------------------\n")

  if (rec === "GO") {
    console.log("[Validate] Pipeline looks good. You can run: node scripts/populate-until-10k.js")
    process.exit(0)
  }

  console.error("[Validate] NO-GO. Do not run full populate until the pipeline is fixed.")
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
