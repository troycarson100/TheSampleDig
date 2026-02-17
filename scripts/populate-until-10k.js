/**
 * Call /api/samples/populate in a loop until we reach 10k samples or hit quota.
 * Uses video search (not playlist discover) so we get new videos each batch.
 *
 * Usage: node scripts/populate-until-10k.js [secret]
 * Env: POPULATE_SECRET, NEXTAUTH_URL or BASE_URL, SKIP_DRY_RUN=1 to skip dry run and start main loop
 */

const SECRET = process.argv[2] || process.env.POPULATE_SECRET || "change-me-in-production"
const SKIP_DRY_RUN = process.env.SKIP_DRY_RUN === "1" || process.env.SKIP_DRY_RUN === "true"
const BASE_URL = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000"
const TARGET = 10000
const BATCH_LIMIT = 500
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000 // 20 min per batch (first batch can take long with 5.5k+ excluded)
const MAX_ZERO_STORED_IN_A_ROW = 15 // stop if no new samples for this many batches (avoid infinite loop)

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
  const { dryRun = false, startFresh = false } = opts
  const url = `${BASE_URL}/api/samples/populate?secret=${encodeURIComponent(SECRET)}&limit=${limit}${dryRun ? "&dryRun=true" : ""}${startFresh ? "&startFresh=true" : ""}`
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

async function main() {
  console.log("[Populate-10k] Target:", TARGET, "| Batch limit:", BATCH_LIMIT, "| Base URL:", BASE_URL)

  // Safeguard: dry run first (uses only a few pages). If filter passes 0, abort to avoid wasting quota. Set SKIP_DRY_RUN=1 to skip.
  if (!SKIP_DRY_RUN) {
    console.log("[Populate-10k] Dry run (verify filter passes videos)...")
    try {
      const dryResult = await populateBatch(5, { dryRun: true })
      const passed = dryResult.stats?.totalPassedFilter ?? 0
      const pages = dryResult.stats?.pagesQueried ?? 0
      console.log("[Populate-10k] Dry run: ", passed, "passed filter over", pages, "pages")
      if (pages >= 1 && passed === 0) {
        console.error("[Populate-10k] ABORT: Filter passed 0 videos. Fix pipeline before running. Not starting main loop to save quota.")
        process.exit(1)
      }
      if (passed > 0) {
        console.log("[Populate-10k] Filter OK. Starting main loop.")
      }
    } catch (e) {
      if (e.quota) {
        console.log("[Populate-10k] Quota exceeded on dry run. Stop.")
        process.exit(0)
      }
      throw e
    }
  } else {
    console.log("[Populate-10k] Skipping dry run (SKIP_DRY_RUN=1). Starting main loop.")
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
      const result = await populateBatch(toFetch, { startFresh: startFreshThisBatch })
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
