#!/usr/bin/env node
/**
 * Channel-first discovery: fetch uploads from known-good channels (seeded from Sample table)
 * and run through the same filter pipeline as search.
 *
 * Cost: 1 unit per 50 videos (vs 100 for search). Dramatically more quota-efficient.
 *
 * Usage: node scripts/discover-from-channels.js [secret]
 * Env: POPULATE_SECRET, NEXTAUTH_URL or BASE_URL
 *      LIMIT - max samples to store (default 100)
 *      MAX_VIDEOS_PER_CHANNEL - max videos to fetch per channel (default 200)
 */

require("dotenv").config()

const SECRET = process.argv[2] || process.env.POPULATE_SECRET || "change-me-in-production"
const BASE_URL = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000"
const LIMIT = parseInt(process.env.LIMIT || "100", 10)
const MAX_VIDEOS_PER_CHANNEL = parseInt(process.env.MAX_VIDEOS_PER_CHANNEL || "200", 10)
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || "60", 10) * 60 * 1000

async function checkQuota() {
  const { spawnSync } = require("child_process")
  const r = spawnSync("node", ["-r", "dotenv/config", "scripts/check-youtube-quota.js"], {
    cwd: process.cwd(),
    stdio: "pipe",
    encoding: "utf-8",
  })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || "[Channels] Quota check failed")
    process.exit(1)
  }
}

async function main() {
  console.log("[Channels] Channel-first discovery")
  console.log("[Channels] Limit:", LIMIT, "| Max videos/channel:", MAX_VIDEOS_PER_CHANNEL)
  console.log("[Channels] Cost: ~1 unit per 50 videos (vs 100 for search)\n")

  await checkQuota()
  console.log("[Channels] Quota OK.\n")

  const url = `${BASE_URL}/api/samples/populate-from-channels?secret=${encodeURIComponent(SECRET)}&limit=${LIMIT}&maxVideosPerChannel=${MAX_VIDEOS_PER_CHANNEL}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res, text
  try {
    res = await fetch(url, { method: "POST", signal: controller.signal })
    text = await res.text()
  } catch (e) {
    clearTimeout(timeout)
    if (e.name === "AbortError") {
      console.error("[Channels] Request timed out.")
      process.exit(1)
    }
    throw e
  }
  clearTimeout(timeout)

  if (!res.ok) {
    if (res.status === 401) {
      console.error("[Channels] Unauthorized: check POPULATE_SECRET")
      process.exit(1)
    }
    if (/quota|403|exceeded/i.test(text)) {
      console.error("[Channels] Quota exceeded. Try again when quota resets.")
      process.exit(1)
    }
    console.error("[Channels] Error:", text.slice(0, 300))
    process.exit(1)
  }

  const data = JSON.parse(text)
  console.log("[Channels]", data.message)
  console.log("[Channels] Stats:", data.stats)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
