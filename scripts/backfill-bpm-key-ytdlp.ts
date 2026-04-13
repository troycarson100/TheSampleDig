/**
 * Backfill BPM and key using yt-dlp + ffmpeg + Python/librosa (local analysis; no Google CSE).
 *
 * Usage:
 *   npx tsx scripts/backfill-bpm-key-ytdlp.ts [--drum-only] [limit]
 *
 *   (default)    Rows missing BPM or key: drum-break cohort first, then the rest.
 *   --drum-only  Only samples that match the Dig drum-break filter.
 *   limit        Max rows to process (after ordering). Omit = full backlog in order.
 *
 * Requires: yt-dlp, ffmpeg, Python 3 with librosa (pip install librosa numpy)
 * Env: DATABASE_URL (.env / .env.local)
 */

import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/db"
import { analyzeYouTubeVideo } from "../lib/audio-analysis"
import {
  DRUM_BREAK_CURATED_TAG,
  DRUM_BREAK_TITLE_PHRASES,
} from "../lib/drum-break-title-match"

const DELAY_BETWEEN_VIDEOS_MS = 4000
const PER_VIDEO_TIMEOUT_MS = 90000

const missingBpmOrKey: Prisma.SampleWhereInput = {
  OR: [{ bpm: null }, { key: null }],
}

const drumBreakClause: Prisma.SampleWhereInput = {
  OR: [
    { tags: { contains: DRUM_BREAK_CURATED_TAG, mode: "insensitive" } },
    ...DRUM_BREAK_TITLE_PHRASES.map((phrase) => ({
      title: { contains: phrase, mode: "insensitive" as const },
    })),
  ],
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function loadSamples(drumOnly: boolean, limit: number | undefined) {
  const select = {
    id: true,
    youtubeId: true,
    title: true,
    bpm: true,
    key: true,
    tags: true,
  } as const

  if (drumOnly) {
    return prisma.sample.findMany({
      where: { AND: [missingBpmOrKey, drumBreakClause] },
      select,
      orderBy: { createdAt: "asc" },
      ...(limit != null ? { take: limit } : {}),
    })
  }

  if (limit == null) {
    const [drumRows, restRows] = await Promise.all([
      prisma.sample.findMany({
        where: { AND: [missingBpmOrKey, drumBreakClause] },
        select,
        orderBy: { createdAt: "asc" },
      }),
      prisma.sample.findMany({
        where: { AND: [missingBpmOrKey, { NOT: drumBreakClause }] },
        select,
        orderBy: { createdAt: "asc" },
      }),
    ])
    return [...drumRows, ...restRows]
  }

  const drumRows = await prisma.sample.findMany({
    where: { AND: [missingBpmOrKey, drumBreakClause] },
    select,
    orderBy: { createdAt: "asc" },
    take: limit,
  })
  if (drumRows.length >= limit) return drumRows

  const rest = await prisma.sample.findMany({
    where: { AND: [missingBpmOrKey, { NOT: drumBreakClause }] },
    select,
    orderBy: { createdAt: "asc" },
    take: limit - drumRows.length,
  })
  return [...drumRows, ...rest]
}

async function main() {
  const args = process.argv.slice(2)
  const drumOnly = args.includes("--drum-only")
  const posArgs = args.filter((a) => a !== "--drum-only")
  const limitArg = posArgs[0]
  const limit = limitArg ? parseInt(limitArg, 10) : undefined
  if (limitArg && (isNaN(limit!) || limit! < 1)) {
    console.error("Usage: npx tsx scripts/backfill-bpm-key-ytdlp.ts [--drum-only] [limit]")
    process.exit(1)
  }

  const [drumPending, restPending] = await Promise.all([
    prisma.sample.count({ where: { AND: [missingBpmOrKey, drumBreakClause] } }),
    prisma.sample.count({ where: { AND: [missingBpmOrKey, { NOT: drumBreakClause }] } }),
  ])
  const totalMissing = drumPending + restPending

  const samples = await loadSamples(drumOnly, limit)

  console.log(
    `[Backfill yt-dlp] Missing BPM/key: ${totalMissing} total (drum-break cohort: ${drumPending}, other: ${restPending}). ` +
      `Mode: ${drumOnly ? "--drum-only" : "drum-first then rest"}. ` +
      `Processing ${samples.length} row(s)${limit != null ? ` (limit ${limit})` : ""}.`
  )
  console.log(
    "[Backfill yt-dlp] Requires: yt-dlp, ffmpeg, Python 3 + librosa. Delay between videos:",
    DELAY_BETWEEN_VIDEOS_MS / 1000,
    "s"
  )

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
        console.warn(
          `[Backfill yt-dlp] Timeout after ${PER_VIDEO_TIMEOUT_MS / 1000}s for ${sample.youtubeId}`
        )
        resolve({ bpm: null, key: null })
      }, PER_VIDEO_TIMEOUT_MS)
    })

    let result: { bpm: number | null; key: string | null }
    try {
      result = await Promise.race([analysisPromise, timeoutPromise])
    } catch (err: unknown) {
      console.error(
        `[Backfill yt-dlp] Error for ${sample.youtubeId}:`,
        err instanceof Error ? err.message : String(err)
      )
      result = { bpm: null, key: null }
    }

    const hasNew = result.bpm != null || result.key != null
    const finalStatus = hasNew ? "completed" : "failed"

    await prisma.sample.update({
      where: { id: sample.id },
      data: {
        ...(result.bpm != null && { bpm: result.bpm }),
        ...(result.key != null && { key: result.key }),
        analysisStatus: finalStatus,
      },
    })

    if (hasNew) {
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
