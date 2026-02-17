/**
 * Backfill BPM and key for samples in the DB using yt-dlp + librosa (backend only).
 * Runs only from CLI; no frontend or API exposure.
 *
 * Requires: yt-dlp, ffmpeg, Python 3 with librosa (pip install librosa numpy)
 *
 * Usage: npx tsx scripts/backfill-bpm-key-ytdlp.ts [limit]
 *   limit: max samples to process (default: all that need backfill)
 *
 * Env: DATABASE_URL (loaded from .env)
 */

import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env") })

import { PrismaClient } from "@prisma/client"
import { analyzeYouTubeVideo } from "../lib/audio-analysis"

const DELAY_BETWEEN_VIDEOS_MS = 4000
const PER_VIDEO_TIMEOUT_MS = 90000

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const limitArg = process.argv[2]
  const limit = limitArg ? parseInt(limitArg, 10) : undefined
  if (limitArg && (isNaN(limit) || limit < 1)) {
    console.error("Usage: npx tsx scripts/backfill-bpm-key-ytdlp.ts [limit]")
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
    select: { id: true, youtubeId: true, title: true },
    take,
    orderBy: { createdAt: "asc" },
  })

  console.log(
    `[Backfill yt-dlp] Found ${totalToProcess} samples needing BPM/key. Processing ${samples.length} (limit: ${limit ?? "none"}).`
  )
  console.log("[Backfill yt-dlp] Requires: yt-dlp, ffmpeg, Python 3 + librosa. Delay between videos:", DELAY_BETWEEN_VIDEOS_MS / 1000, "s")
  if (samples.length === 0) {
    console.log("[Backfill yt-dlp] Nothing to do.")
    await prisma.$disconnect()
    process.exit(0)
  }

  let updated = 0
  let failed = 0

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    const title = (sample.title || "").slice(0, 50)
    console.log(`[${i + 1}/${samples.length}] ${sample.youtubeId} ${title}...`)

    const analysisPromise = analyzeYouTubeVideo(sample.youtubeId)
    const timeoutPromise = new Promise<{ bpm: null; key: null }>((resolve) => {
      setTimeout(() => {
        console.warn(`[Backfill yt-dlp] Timeout after ${PER_VIDEO_TIMEOUT_MS / 1000}s for ${sample.youtubeId}`)
        resolve({ bpm: null, key: null })
      }, PER_VIDEO_TIMEOUT_MS)
    })

    let result: { bpm: number | null; key: string | null }
    try {
      result = await Promise.race([analysisPromise, timeoutPromise])
    } catch (err: unknown) {
      console.error(`[Backfill yt-dlp] Error for ${sample.youtubeId}:`, err instanceof Error ? err.message : String(err))
      result = { bpm: null, key: null }
    }

    const finalStatus = result.bpm != null || result.key != null ? "completed" : "failed"
    await prisma.sample.update({
      where: { id: sample.id },
      data: {
        bpm: result.bpm,
        key: result.key,
        analysisStatus: finalStatus,
      },
    })

    if (finalStatus === "completed") {
      updated++
      console.log(`  → BPM ${result.bpm ?? "–"} Key ${result.key ?? "–"}`)
    } else {
      failed++
    }

    if (i < samples.length - 1) {
      await sleep(DELAY_BETWEEN_VIDEOS_MS)
    }
  }

  console.log(`[Backfill yt-dlp] Done. Updated: ${updated}, Failed: ${failed}`)
  await prisma.$disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error("[Backfill yt-dlp] Fatal:", err)
  process.exit(1)
})
