/**
 * One-time (or occasional) backfill: fix samples.title values that are YouTube player chrome
 * (e.g. "3:59 3:59 Now playing") using the same logic as the app (Data API + oEmbed).
 *
 * Usage:
 *   npx tsx scripts/backfill-garbage-youtube-titles.ts [--dry-run] [limit]
 *
 *   --dry-run   Log what would change without updating the DB
 *   limit       Max rows to process (after filtering); default: all candidates
 *
 * Env: DATABASE_URL (from .env / .env.local). YouTube Data API keys optional; oEmbed works without keys.
 */

import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { prisma } from "../lib/db"
import { ensureUsableYoutubeTitle } from "../lib/database-samples"
import { titleLooksLikeYoutubePlayerChrome } from "../lib/youtube-title-garbage"
import { fetchCanonicalYoutubeTitleIfGarbage } from "../lib/youtube-sample-title"

const DELAY_MS = 350

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const posArgs = args.filter((a) => a !== "--dry-run")
  const limitArg = posArgs[0]
  const limit = limitArg ? parseInt(limitArg, 10) : undefined
  if (limitArg && (isNaN(limit!) || limit! < 1)) {
    console.error("Usage: npx tsx scripts/backfill-garbage-youtube-titles.ts [--dry-run] [limit]")
    process.exit(1)
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("Set DATABASE_URL (e.g. in .env)")
    process.exit(1)
  }

  // Narrow in SQL first (almost all bad rows contain this phrase)
  const candidates = await prisma.sample.findMany({
    where: { title: { contains: "now playing", mode: "insensitive" } },
    select: { id: true, youtubeId: true, title: true },
    orderBy: { createdAt: "asc" },
  })

  const bad = candidates.filter((r) => titleLooksLikeYoutubePlayerChrome(r.title))
  const toProcess = limit != null ? bad.slice(0, limit) : bad

  console.log(
    `[backfill-garbage-titles] Candidates with "now playing": ${candidates.length}, ` +
      `after chrome filter: ${bad.length}. Processing: ${toProcess.length}${dryRun ? " (dry-run)" : ""}.`
  )

  if (toProcess.length === 0) {
    await prisma.$disconnect()
    process.exit(0)
  }

  let repaired = 0
  let unchanged = 0
  let failed = 0

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i]
    const prefix = `[${i + 1}/${toProcess.length}] ${row.youtubeId}`

    try {
      if (dryRun) {
        const fixed = await fetchCanonicalYoutubeTitleIfGarbage(row.youtubeId, row.title)
        if (fixed === row.title) {
          unchanged++
          console.log(`${prefix} — would stay unchanged (no canonical title)`)
        } else {
          repaired++
          console.log(`${prefix}\n  was: ${row.title}\n  →   ${fixed}`)
        }
      } else {
        const fixed = await ensureUsableYoutubeTitle(row.youtubeId, row.title)
        if (fixed === row.title) {
          unchanged++
          console.log(`${prefix} — could not resolve (still garbage or unchanged)`)
        } else {
          repaired++
          console.log(`${prefix}\n  was: ${row.title}\n  →   ${fixed}`)
        }
      }
    } catch (e) {
      failed++
      console.error(`${prefix} — error:`, e instanceof Error ? e.message : e)
    }

    if (i < toProcess.length - 1) await sleep(DELAY_MS)
  }

  console.log(
    `\n[backfill-garbage-titles] Done. Repaired: ${repaired}, unchanged/failed resolution: ${unchanged}, errors: ${failed}${dryRun ? " (dry-run — no DB writes)" : ""}.`
  )

  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
