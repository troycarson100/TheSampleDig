/**
 * Call /api/samples/populate in a loop until we reach 10k samples or hit quota.
 * Uses video search (not playlist discover) so we get new videos each batch.
 *
 * Usage: node scripts/populate-until-10k.js [secret]
 * Env: POPULATE_SECRET, NEXTAUTH_URL or BASE_URL, SKIP_VALIDATE=1 to skip validation and start main loop
 *       VERBOSE=1 to include per-page stats in response (for debugging filter bottlenecks)
 *       SKIP_PAGES=N to skip first N pages per template (e.g. 3 = start at page 4)
 */

const SECRET = process.argv[2] || process.env.POPULATE_SECRET || "change-me-in-production"
const SKIP_PAGES = Math.max(0, parseInt(process.env.SKIP_PAGES || "20", 10)) // default 20 = start at page 21 (early pages mined)
const SKIP_VALIDATE = process.env.SKIP_VALIDATE === "1" || process.env.SKIP_VALIDATE === "true"
const VERBOSE = process.env.VERBOSE === "1" || process.env.VERBOSE === "true"
const BASE_URL = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000"
const TARGET = 10000
const BATCH_LIMIT = parseInt(process.env.BATCH_LIMIT || "500", 10)
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000 // 20 min per batch (first batch can take long with 5.5k+ excluded)
const MAX_ZERO_STORED_IN_A_ROW = parseInt(process.env.MAX_ZERO_BATCHES || "3", 10) // stop if no new samples (conservative to save quota)

async function getCount() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  const res = await fetch(`${BASE_URL}/api/samples/populate`, { signal: controller.signal })
  clearTimeout(timeout)
  if (!res.ok) throw new Error(`GET populate ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.totalSamples ?? 0
}

async function populateBatch(limit, opts = {}) {
  const { dryRun = false, validate = false, startFresh = false, verbose = false } = opts
  const url = `${BASE_URL}/api/samples/populate?secret=${encodeURIComponent(SECRET)}&limit=${limit}${dryRun ? "&dryRun=true" : ""}${validate ? "&validate=1" : ""}${startFresh ? "&startFresh=true" : ""}${verbose ? "&verbose=true" : ""}${SKIP_PAGES > 0 ? `&skipPages=${SKIP_PAGES}` : ""}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const res = await fetch(url, { method: "POST", signal: controller.signal })
  clearTimeout(timeout)
  const text = await res.text()
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized: check POPULATE_SECRET")
    const isQuota = /quota|403|exceeded/i.test(text)
    const err = new Error(`Populate ${res.status}: ${text.slice(0, 200)}`)
    err.quota = isQuota
    throw err
  }
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("Invalid JSON: " + text.slice(0, 100))
  }
  if (data.error && /quota|403|exceeded/i.test(data.error)) {
    const err = new Error(data.error)
    err.quota = true
    throw err
  }
  return data
}

async function checkQuota() {
  const { spawnSync } = require("child_process")
  const r = spawnSync("node", ["-r", "dotenv/config", "scripts/check-youtube-quota.js"], {
    cwd: process.cwd(),
    stdio: "pipe",
    encoding: "utf-8",
  })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || "[Populate-10k] Quota check failed")
    process.exit(1)
  }
}

async function main() {
  console.log("[Populate-10k] Target:", TARGET, "| Batch limit:", BATCH_LIMIT, "| Base URL:", BASE_URL, SKIP_PAGES > 0 ? `| Skip pages: ${SKIP_PAGES}` : "")

  console.log("[Populate-10k] Checking YouTube API quota...")
  await checkQuota()
  console.log("[Populate-10k] Quota OK.")

  // Safeguard: validate first (2 pages, REAL exclusions). Proves pipeline will return results. Cost ~1200 units. Set SKIP_VALIDATE=1 to skip.
  if (!SKIP_VALIDATE) {
    console.log("[Populate-10k] Validating pipeline (2 pages, real exclusions, skipPages=" + SKIP_PAGES + ")...")
    try {
      const valResult = await populateBatch(0, { validate: true, verbose: true })
      const rec = valResult.validationRecommendation
      const passed = valResult.stats?.totalPassedFilter ?? 0
      if (rec === "GO") {
        console.log("[Populate-10k] Validation GO:", passed, "passed filter. Starting main loop.")
      } else {
        console.error("[Populate-10k] Validation NO-GO:", valResult.validationReason || "0 passed. Fix pipeline before running.")
        if (valResult.pageStats?.length) {
          valResult.pageStats.forEach((p, i) => {
            console.error(`  Page ${i + 1}: raw=${p.rawCount} excluded=${p.excludedCount} candidates=${p.candidateCount} hardFilter=${p.hardFilterRejectCount ?? "?"} passed=${p.passedCount ?? "?"}`)
          })
        }
        process.exit(1)
      }
    } catch (e) {
      if (e.quota) {
        console.log("[Populate-10k] Quota exceeded on validation. Stop.")
        process.exit(0)
      }
      throw e
    }
  } else {
    console.log("[Populate-10k] Skipping validation (SKIP_VALIDATE=1). Starting main loop.")
  }

  let batchNum = 0
  let zeroStoredInARow = 0
  while (true) {
    const before = await getCount()
    if (before >= TARGET) {
      console.log("[Populate-10k] Reached target:", before, "samples. Done.")
      break
    }
    if (zeroStoredInARow >= MAX_ZERO_STORED_IN_A_ROW) {
      console.log("[Populate-10k] No new samples for", MAX_ZERO_STORED_IN_A_ROW, "batches. Stopping. (Add more query templates or use candidate pipeline + discover.)")
      break
    }
    const toFetch = Math.min(BATCH_LIMIT, TARGET - before)
    batchNum++
    const startFreshThisBatch = batchNum === 1
    if (startFreshThisBatch) console.log("[Populate-10k] First batch: starting from template 0 (startFresh)")
    console.log("[Populate-10k] Batch", batchNum, "| Current:", before, "| Fetching up to", toFetch, "new...")
    try {
      const result = await populateBatch(toFetch, { startFresh: startFreshThisBatch, verbose: VERBOSE })
      if (result.stoppedEarly === "consecutive_zero_filter_pages") {
        console.error("[Populate-10k] Route stopped: many pages had 0 passed filter. Aborting to save quota.")
        process.exit(1)
      }
      // Don't burn more quota: if we scored many pages and got 0 passed, next batches would do the same
      if ((result.stats?.samplesStored ?? 0) === 0 && result.stoppedEarly === "no_results_after_multiple_pages") {
        console.log("[Populate-10k] Stopped: 0 passed after many pages with candidates. Exiting to save quota (run again when quota resets).")
        break
      }
      const after = await getCount()
      const stored = result.stats?.samplesStored ?? 0
      const passedFilter = result.stats?.totalPassedFilter ?? 0
      if (stored === 0) {
        if (passedFilter > 0) {
          zeroStoredInARow = 0
        } else {
          zeroStoredInARow++
        }
      } else {
        zeroStoredInARow = 0
      }
      console.log("[Populate-10k] Stored:", stored, "| Total now:", after, passedFilter != null ? `| Passed filter: ${passedFilter}` : "")
      if (VERBOSE && result.pageStats && result.pageStats.length > 0) {
        const lastPage = result.pageStats[result.pageStats.length - 1]
        console.log("[Populate-10k] Last page stats:", lastPage)
      }
      if (stored === 0 && result.stats?.samplesSkipped > 0) {
        console.log("[Populate-10k] (All passed were already in DB – progress through templates.)")
      }
      await new Promise((r) => setTimeout(r, 2000))
    } catch (e) {
      if (e.quota) {
        console.log("[Populate-10k] Quota exceeded. Stop. Run again tomorrow or add API keys.")
        process.exit(0)
      }
      throw e
    }
  }
  const final = await getCount()
  console.log("[Populate-10k] Final count:", final)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
