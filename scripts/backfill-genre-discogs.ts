/**
 * Backfill sample.genre from Discogs (release search + genre/style mapping).
 *
 * Usage:
 *   npx tsx scripts/backfill-genre-discogs.ts [--dry-run] [--overwrite] [limit]
 *
 *   --dry-run    No DB writes
 *   --overwrite  Set genre even when already present (default: only null/empty genre)
 *   limit        Max samples to process
 *
 * Env:
 *   DATABASE_URL
 *   DISCOGS_PERSONAL_TOKEN  (recommended) OR DISCOGS_CONSUMER_KEY + DISCOGS_CONSUMER_SECRET
 *   DISCOGS_USER_AGENT      optional override (must identify your app per Discogs)
 */

import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { prisma } from "../lib/db"
import { fetchDiscogsGenreForTrack, getDiscogsCredentials } from "../lib/discogs"

const DELAY_MS = 2100
const RATE_LIMIT_BACKOFF_MS = 65_000

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const overwrite = args.includes("--overwrite")
  const posArgs = args.filter((a) => a !== "--dry-run" && a !== "--overwrite")
  const limitArg = posArgs[0]
  const limit = limitArg ? parseInt(limitArg, 10) : undefined
  if (limitArg && (isNaN(limit!) || limit! < 1)) {
    console.error("Usage: npx tsx scripts/backfill-genre-discogs.ts [--dry-run] [--overwrite] [limit]")
    process.exit(1)
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("Set DATABASE_URL in .env")
    process.exit(1)
  }

  if (!getDiscogsCredentials()) {
    console.error(
      "Set Discogs credentials: DISCOGS_PERSONAL_TOKEN (from discogs.com/settings/developers) " +
        "or DISCOGS_CONSUMER_KEY + DISCOGS_CONSUMER_SECRET"
    )
    process.exit(1)
  }

  const where = overwrite
    ? {}
    : {
        OR: [{ genre: null }, { genre: "" }],
      }

  const totalMissing = await prisma.sample.count({ where })
  const take = limit ?? totalMissing
  const samples = await prisma.sample.findMany({
    where,
    select: { id: true, youtubeId: true, title: true, channel: true, genre: true },
    orderBy: { createdAt: "asc" },
    take,
  })

  console.log(
    `[backfill-genre-discogs] Matching rows: ${totalMissing}. ` +
      `Processing ${samples.length}${overwrite ? " (overwrite mode)" : " (missing genre only)"}${dryRun ? " (dry-run)" : ""}.`
  )

  if (samples.length === 0) {
    await prisma.$disconnect()
    process.exit(0)
  }

  let updated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < samples.length; i++) {
    const row = samples[i]
    const prefix = `[${i + 1}/${samples.length}] ${row.youtubeId}`

    const runOne = async () => {
      const meta = await fetchDiscogsGenreForTrack(row.channel, row.title)
      if (!meta || !meta.genre) {
        skipped++
        console.log(`${prefix} — no Discogs match (${meta?.genres?.length ? "unmapped genres" : "no release"})`)
        return
      }

      if (!dryRun) {
        await prisma.sample.update({
          where: { id: row.id },
          data: { genre: meta.genre },
        })
      }
      updated++
      console.log(
        `${prefix} — "${row.title.slice(0, 48)}..." → ${meta.genre}` +
          (meta.styles?.length ? ` [styles: ${meta.styles.slice(0, 3).join(", ")}]` : "")
      )
    }

    try {
      await runOne()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("429") || msg.includes("rate limit")) {
        console.warn(`${prefix} — rate limited, waiting ${RATE_LIMIT_BACKOFF_MS / 1000}s...`)
        await sleep(RATE_LIMIT_BACKOFF_MS)
        try {
          await runOne()
        } catch (e2) {
          failed++
          console.error(`${prefix} —`, e2)
        }
      } else {
        failed++
        console.error(`${prefix} —`, e)
      }
    }

    if (i < samples.length - 1) await sleep(DELAY_MS)
  }

  console.log(
    `\n[backfill-genre-discogs] Done. ${dryRun ? "Would update" : "Updated"}: ${updated}, skipped: ${skipped}, failed: ${failed}${dryRun ? " (dry-run — no DB writes)" : ""}.`
  )

  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
