/**
 * Backfill BPM and key for samples in the DB using Spotify (or other metadata APIs).
 * No YouTube audio / yt-dlp – uses title + channel to look up metadata.
 *
 * Usage: npx tsx scripts/backfill-bpm-key.ts [limit]
 *   limit: max samples to process (default: all that need backfill)
 *
 * Env: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, DATABASE_URL (loaded from .env)
 *
 * Rate: ~2 Spotify requests per sample (search + audio-features). We throttle to stay under limits.
 */

import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env") })

import { PrismaClient } from "@prisma/client"
import { getBpmKey } from "../lib/metadata-bpm-key"

const DELAY_MS = 800
const MAX_RETRIES = 3

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const limitArg = process.argv[2]
  const limit = limitArg ? parseInt(limitArg, 10) : undefined
  if (limitArg && (isNaN(limit) || limit < 1)) {
    console.error("Usage: npx tsx scripts/backfill-bpm-key.ts [limit]")
    process.exit(1)
  }

  const hasSpotify =
    !!process.env.SPOTIFY_CLIENT_ID?.trim() && !!process.env.SPOTIFY_CLIENT_SECRET?.trim()
  const hasGoogle =
    !!process.env.GOOGLE_CSE_API_KEY?.trim() && !!process.env.GOOGLE_CSE_ID?.trim()
  if (!hasSpotify && !hasGoogle) {
    console.error(
      "Set at least one provider in .env: (SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET) or (GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID)"
    )
    process.exit(1)
  }

  const prisma = new PrismaClient()

  const where = {
    OR: [{ bpm: null }, { key: null }, { analysisStatus: { not: "completed" } }],
  }
  const totalToProcess = await prisma.sample.count({ where })
  const take = limit ?? totalToProcess
  const samples = await prisma.sample.findMany({
    where,
    select: { id: true, youtubeId: true, title: true, channel: true, bpm: true, key: true },
    take,
    orderBy: { createdAt: "asc" },
  })

  console.log(
    `[Backfill BPM/Key] Found ${totalToProcess} samples needing backfill. Processing ${samples.length} (limit: ${limit ?? "none"}).`
  )
  if (samples.length === 0) {
    console.log("[Backfill BPM/Key] Nothing to do.")
    await prisma.$disconnect()
    process.exit(0)
  }

  let updated = 0
  let failed = 0
  let rateLimited = 0

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    const title = sample.title || ""
    const artist = sample.channel || ""

    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        const { bpm, key } = await getBpmKey(title, artist)
        const hasUpdate = bpm != null || key != null
        await prisma.sample.update({
          where: { id: sample.id },
          data: {
            ...(bpm != null && { bpm }),
            ...(key != null && { key }),
            analysisStatus: "completed",
          },
        })
        if (hasUpdate) {
          updated++
          console.log(
            `[${i + 1}/${samples.length}] ${sample.title?.slice(0, 40)}... → BPM ${bpm ?? "–"} Key ${key ?? "–"}`
          )
        }
        break
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes("429") || msg.includes("rate limited")) {
          rateLimited++
          const wait = 60_000
          console.warn(`[Backfill BPM/Key] Rate limited. Waiting ${wait / 1000}s...`)
          await sleep(wait)
          continue
        }
        console.error(`[Backfill BPM/Key] Error for ${sample.youtubeId}:`, msg)
        failed++
        break
      }
    }

    if (i < samples.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  console.log(
    `[Backfill BPM/Key] Done. Updated: ${updated}, failed: ${failed}, rate-limited pauses: ${rateLimited}`
  )
  await prisma.$disconnect()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
