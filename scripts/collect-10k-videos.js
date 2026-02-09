/**
 * Collect ~10k videos for the DB: discover playlists → ingest candidates → run pipeline until we have enough samples.
 *
 * Usage:
 *   node scripts/collect-10k-videos.js [secret]
 *   node scripts/collect-10k-videos.js [secret] no-discover   # skip discover, only run pipeline
 *
 * Env: POPULATE_SECRET, NEXTAUTH_URL or BASE_URL
 *      MAX_ENRICH_BATCHES_PER_RUN - optional; stop after this many pipeline runs (daily cap). Exit 0 so cron can run again tomorrow.
 */

const SECRET = process.env.POPULATE_SECRET || "change-me-in-production"
const MAX_ENRICH_BATCHES_PER_RUN = process.env.MAX_ENRICH_BATCHES_PER_RUN
  ? parseInt(process.env.MAX_ENRICH_BATCHES_PER_RUN, 10)
  : null
const BASE_URL = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000"
const TARGET_SAMPLES = 10000
const MAX_PIPELINE_ITERATIONS = 9999
const PIPELINE_BATCH = { enrichLimit: 150, scoreLimit: 300, processLimit: 75 }
const REQUEST_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes for long-running discover

async function discoverPlaylists() {
  console.log("[10k] Discovering playlists and ingesting video IDs...")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const res = await fetch(`${BASE_URL}/api/candidates/discover-playlists?secret=${SECRET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      maxPlaylistSearches: 8,
      maxPlaylistsToIngest: 25,
      maxVideosPerPlaylist: 300,
    }),
    signal: controller.signal,
  })
  clearTimeout(timeout)
  if (!res.ok) throw new Error(`Discover ${res.status}: ${await res.text()}`)
  const data = await res.json()
  console.log("[10k] Discover:", data.message)
  return data
}

async function runPipeline() {
  const q = new URLSearchParams({
    secret: SECRET,
    enrichLimit: String(PIPELINE_BATCH.enrichLimit),
    scoreLimit: String(PIPELINE_BATCH.scoreLimit),
    processLimit: String(PIPELINE_BATCH.processLimit),
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const res = await fetch(`${BASE_URL}/api/candidates/pipeline?${q}`, {
    method: "POST",
    signal: controller.signal,
  })
  clearTimeout(timeout)
  if (!res.ok) throw new Error(`Pipeline ${res.status}: ${await res.text()}`)
  return res.json()
}

async function getStats() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  const res = await fetch(`${BASE_URL}/api/candidates/stats?secret=${SECRET}`, {
    signal: controller.signal,
  })
  clearTimeout(timeout)
  if (!res.ok) throw new Error(`Stats ${res.status}: ${await res.text()}`)
  return res.json()
}

const MAX_ZERO_IN_A_ROW = 8

async function main() {
  const skipDiscover = process.argv[2] === "no-discover"
  let iteration = 0
  let zeroInARow = 0
  const maxDiscoverRounds = 99

  while (iteration < MAX_PIPELINE_ITERATIONS) {
    const before = await getStats()
    if (before.samples >= TARGET_SAMPLES) {
      console.log("[10k] Reached target:", before.samples, "samples. Done.")
      break
    }

    if (!skipDiscover && iteration < maxDiscoverRounds) {
      const needMore = before.candidates.total < 5000 && before.samples < TARGET_SAMPLES
      if (needMore) {
        await discoverPlaylists()
        const after = await getStats()
        console.log("[10k] After discover:", after)
      }
    }

    if (before.candidates.processable === 0 && before.candidates.unenriched === 0) {
      console.log("[10k] No more candidates. Running one more discover round...")
      await discoverPlaylists()
      const after = await getStats()
      if (after.candidates.unenriched === 0 && after.candidates.processable === 0) {
        console.log("[10k] No more candidates to process. Done.")
        break
      }
    }

    try {
      const result = await runPipeline()
      if (result.quotaExceeded) {
        console.log("[10k] Quota exceeded. Run again tomorrow or add more project keys.")
        process.exit(0)
      }
      iteration++
      const after = await getStats()
      const progress = result.enriched + result.scored + result.promoted
      if (progress === 0) zeroInARow++
      else zeroInARow = 0
      console.log(
        `[10k] Iteration ${iteration}: enriched=${result.enriched} scored=${result.scored} promoted=${result.promoted} | samples=${after.samples}`
      )
      if (zeroInARow >= MAX_ZERO_IN_A_ROW) {
        console.log("[10k] No progress for", MAX_ZERO_IN_A_ROW, "runs in a row. Stopping.")
        break
      }
      if (MAX_ENRICH_BATCHES_PER_RUN != null && iteration >= MAX_ENRICH_BATCHES_PER_RUN) {
        console.log("[10k] Daily cap reached:", iteration, "runs. Run again tomorrow.")
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    } catch (e) {
      if (e.message && /403|quota/i.test(e.message)) {
        console.log("[10k] Quota or rate limit:", e.message.slice(0, 150))
        process.exit(1)
      }
      throw e
    }
  }

  const final = await getStats()
  console.log("[10k] Final:", final)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
