/**
 * Run pipeline repeatedly with high limits until we hit quota or stall.
 * Usage: node scripts/run-pipeline-until-quota.js [secret]
 * Requires: npm run dev (or production) running so BASE_URL works.
 */

const SECRET = process.argv[2] || process.env.POPULATE_SECRET || "change-me-in-production"
const BASE_URL = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000"

const ENRICH_LIMIT = 200
const SCORE_LIMIT = 500
const PROCESS_LIMIT = 100
const MAX_ZERO_IN_A_ROW = 5

async function runPipeline() {
  const q = new URLSearchParams({
    secret: SECRET,
    enrichLimit: String(ENRICH_LIMIT),
    scoreLimit: String(SCORE_LIMIT),
    processLimit: String(PROCESS_LIMIT),
  })
  const res = await fetch(`${BASE_URL}/api/candidates/pipeline?${q}`, { method: "POST" })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Pipeline ${res.status}: ${text}`)
  }
  return res.json()
}

async function getStats() {
  const res = await fetch(`${BASE_URL}/api/candidates/stats?secret=${SECRET}`)
  if (!res.ok) throw new Error(`Stats ${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  console.log("[Pipeline] Running until quota or stall. Enrich limit:", ENRICH_LIMIT)
  let zeroInARow = 0
  let iter = 0

  while (zeroInARow < MAX_ZERO_IN_A_ROW) {
    iter++
    try {
      const result = await runPipeline()
      const stats = await getStats()
      const progress = result.enriched + result.scored + result.promoted
      if (progress === 0) zeroInARow++
      else zeroInARow = 0
      console.log(
        `[${iter}] enriched=${result.enriched} scored=${result.scored} promoted=${result.promoted} | samples=${stats.samples}`
      )
      if (progress === 0 && zeroInARow >= MAX_ZERO_IN_A_ROW) {
        console.log("[Pipeline] No progress for", MAX_ZERO_IN_A_ROW, "runs. Stopping.")
        break
      }
      await new Promise((r) => setTimeout(r, 300))
    } catch (e) {
      if (e.message && /403|quota/i.test(e.message)) {
        console.log("[Pipeline] Quota hit:", e.message.slice(0, 120))
        process.exit(1)
      }
      throw e
    }
  }

  const final = await getStats()
  console.log("[Pipeline] Final:", final)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
