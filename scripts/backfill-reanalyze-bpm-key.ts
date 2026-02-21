/**
 * Re-analyze BPM and key for samples using improved folding/key logic.
 * Uses cached audio when present (no re-download); downloads once and caches if missing.
 *
 * Requires: yt-dlp, ffmpeg, Python 3 + librosa (pip install librosa numpy)
 *
 * Usage:
 *   npx tsx scripts/backfill-reanalyze-bpm-key.ts [options] [limit]
 *
 * Options:
 *   --all          Re-analyze every sample (default). Use after improving BPM/key logic.
 *   --missing-only Only samples with null bpm/key or non-completed status.
 *   limit          Optional number (e.g. 50) to cap how many to process.
 *
 * Env: DATABASE_URL (loaded from .env)
 */

import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env") })

import { PrismaClient } from "@prisma/client"
import {
  analyzeYouTubeVideo,
  reAnalyzeFromCache,
  findCachedAudio,
} from "../lib/audio-analysis"

const DELAY_BETWEEN_VIDEOS_MS = 3000
const PER_VIDEO_TIMEOUT_MS = 90000

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const args = process.argv.slice(2)
  let limit: number | undefined
  let missingOnly = false

  for (const a of args) {
    if (a === "--missing-only") missingOnly = true
    else if (a === "--all") missingOnly = false
    else if (/^\d+$/.test(a)) limit = parseInt(a, 10)
  }

  const prisma = new PrismaClient()

  const where = missingOnly
    ? { OR: [{ bpm: null }, { key: null }, { analysisStatus: { not: "completed" } }] }
    : {}

  const totalToProcess = await prisma.sample.count({ where })
  const take = limit ?? (missingOnly ? totalToProcess : await prisma.sample.count())
  const samples = await prisma.sample.findMany({
    where,
    select: { id: true, youtubeId: true, title: true },
    take,
    orderBy: { createdAt: "asc" },
  })

  console.log(
    `[Backfill reanalyze] Mode: ${missingOnly ? "missing-only" : "all"}. Processing ${samples.length} (limit: ${limit ?? "none"}).`
  )
  console.log("[Backfill reanalyze] Cached audio = no re-download. Delay between items:", DELAY_BETWEEN_VIDEOS_MS / 1000, "s")
  if (samples.length === 0) {
    console.log("[Backfill reanalyze] Nothing to do.")
    await prisma.$disconnect()
    process.exit(0)
  }

  let updated = 0
  let failed = 0
  let fromCache = 0

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    const title = (sample.title || "").slice(0, 50)
    const cached = !!findCachedAudio(sample.youtubeId)
    if (cached) fromCache++

    console.log(
      `[${i + 1}/${samples.length}] ${sample.youtubeId} ${title}... ${cached ? "(cached)" : "(will download)"}`
    )

    let result: { bpm: number | null; key: string | null }

    if (cached) {
      const analysisPromise = reAnalyzeFromCache(sample.youtubeId)
      const timeoutPromise = new Promise<{ bpm: null; key: null } | null>((resolve) => {
        setTimeout(() => {
          console.warn(`[Backfill reanalyze] Timeout for ${sample.youtubeId}`)
          resolve({ bpm: null, key: null })
        }, PER_VIDEO_TIMEOUT_MS)
      })
      try {
        const reanalyzed = await Promise.race([analysisPromise, timeoutPromise])
        result = reanalyzed ?? { bpm: null, key: null }
      } catch (err: unknown) {
        console.error(`[Backfill reanalyze] Error for ${sample.youtubeId}:`, err instanceof Error ? err.message : String(err))
        result = { bpm: null, key: null }
      }
    } else {
      const analysisPromise = analyzeYouTubeVideo(sample.youtubeId)
      const timeoutPromise = new Promise<{ bpm: null; key: null }>((resolve) => {
        setTimeout(() => {
          console.warn(`[Backfill reanalyze] Timeout after ${PER_VIDEO_TIMEOUT_MS / 1000}s for ${sample.youtubeId}`)
          resolve({ bpm: null, key: null })
        }, PER_VIDEO_TIMEOUT_MS)
      })
      try {
        result = await Promise.race([analysisPromise, timeoutPromise])
      } catch (err: unknown) {
        console.error(`[Backfill reanalyze] Error for ${sample.youtubeId}:`, err instanceof Error ? err.message : String(err))
        result = { bpm: null, key: null }
      }
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

  console.log(
    `[Backfill reanalyze] Done. Updated: ${updated}, Failed: ${failed}, From cache (no download): ${fromCache}`
  )
  await prisma.$disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error("[Backfill reanalyze] Fatal:", err)
  process.exit(1)
})
