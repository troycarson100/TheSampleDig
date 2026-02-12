/**
 * Call /api/samples/populate in a loop until we reach 10k samples or hit quota.
 * Uses video search (not playlist discover) so we get new videos each batch.
 *
 * Usage: node scripts/populate-until-10k.js [secret]
 * Env: POPULATE_SECRET, NEXTAUTH_URL or BASE_URL
 */

const SECRET = process.argv[2] || process.env.POPULATE_SECRET || "change-me-in-production"
const BASE_URL = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000"
const TARGET = 10000
const BATCH_LIMIT = 500
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000 // 5 min per batch
const MAX_ZERO_STORED_IN_A_ROW = 10 // stop if no new samples for this many batches (avoid infinite loop)

async function getCount() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  const res = await fetch(`${BASE_URL}/api/samples/populate`, { signal: controller.signal })
  clearTimeout(timeout)
  if (!res.ok) throw new Error(`GET populate ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.totalSamples ?? 0
}

async function populateBatch(limit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const res = await fetch(
    `${BASE_URL}/api/samples/populate?secret=${encodeURIComponent(SECRET)}&limit=${limit}`,
    { method: "POST", signal: controller.signal }
  )
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
    console.log("[Populate-10k] Batch", batchNum, "| Current:", before, "| Fetching up to", toFetch, "new...")
    try {
      const result = await populateBatch(toFetch)
      const after = await getCount()
      const stored = result.stats?.samplesStored ?? 0
      if (stored === 0) zeroStoredInARow++
      else zeroStoredInARow = 0
      console.log("[Populate-10k] Stored:", stored, "| Total now:", after)
      if (stored === 0 && result.stats?.samplesSkipped > 0) {
        console.log("[Populate-10k] (All skipped - already in DB.)")
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
