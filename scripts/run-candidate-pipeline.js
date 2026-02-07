/**
 * Run the candidate pipeline: enrich → score → process.
 * Optionally run ingest first (requires playlists/channels in env or body).
 *
 * Usage:
 *   node scripts/run-candidate-pipeline.js [secret]
 *   node scripts/run-candidate-pipeline.js [secret] ingest   # run ingest first (uses env CANDIDATE_PLAYLIST_IDS / CANDIDATE_CHANNEL_IDS)
 *
 * Env: POPULATE_SECRET, NEXTAUTH_URL (or BASE_URL), CANDIDATE_PLAYLIST_IDS, CANDIDATE_CHANNEL_IDS
 */

const SECRET = process.env.POPULATE_SECRET || "change-me-in-production"
const BASE_URL = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000"

async function runIngest() {
  const url = `${BASE_URL}/api/candidates/ingest?secret=${SECRET}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`Ingest ${res.status}: ${await res.text()}`)
  return res.json()
}

async function runPipeline() {
  const url = `${BASE_URL}/api/candidates/pipeline?secret=${SECRET}&enrichLimit=50&scoreLimit=100&processLimit=30`
  const res = await fetch(url, { method: "POST" })
  if (!res.ok) throw new Error(`Pipeline ${res.status}: ${await res.text()}`)
  return res.json()
}

async function getStats() {
  const url = `${BASE_URL}/api/candidates/stats?secret=${SECRET}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Stats ${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  const doIngest = process.argv[2] === "ingest"
  if (doIngest) {
    console.log("[Pipeline] Running ingest...")
    const ingestResult = await runIngest()
    console.log("[Pipeline] Ingest:", ingestResult)
  }
  console.log("[Pipeline] Running pipeline batch (enrich → score → process)...")
  const result = await runPipeline()
  console.log("[Pipeline] Result:", result)
  const stats = await getStats()
  console.log("[Pipeline] Stats:", stats)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
