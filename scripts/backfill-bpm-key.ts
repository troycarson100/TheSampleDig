/**
 * Backfill BPM and key for samples using metadata APIs (no YouTube audio / yt-dlp).
 * `getBpmKey` in lib/metadata-bpm-key.ts uses Google Custom Search to parse snippets.
 *
 * Usage:
 *   npx tsx scripts/backfill-bpm-key.ts [--drum-only] [limit]
 *
 *   (default)    Rows missing BPM or key: all drum-break–style samples first, then the rest.
 *   --drum-only  Only samples that match the Dig drum-break filter (curated tag or title phrases).
 *   limit        Max rows to process (after ordering). Omit = process full backlog in order.
 *
 * Env: GOOGLE_CSE_API_KEY, GOOGLE_CSE_ID, DATABASE_URL (.env / .env.local)
 *
 * Rate: throttled between rows; retries on 429.
 */

import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/db"
import { getBpmKey } from "../lib/metadata-bpm-key"
import {
  DRUM_BREAK_CURATED_TAG,
  DRUM_BREAK_TITLE_PHRASES,
} from "../lib/drum-break-title-match"

const DELAY_MS = 800
const MAX_RETRIES = 3

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
    channel: true,
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
    console.error("Usage: npx tsx scripts/backfill-bpm-key.ts [--drum-only] [limit]")
    process.exit(1)
  }

  const hasGoogle =
    !!process.env.GOOGLE_CSE_API_KEY?.trim() && !!process.env.GOOGLE_CSE_ID?.trim()
  if (!hasGoogle) {
    console.error(
      "Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID in .env (getBpmKey uses Google Custom Search)."
    )
    process.exit(1)
  }

  const [drumPending, restPending] = await Promise.all([
    prisma.sample.count({ where: { AND: [missingBpmOrKey, drumBreakClause] } }),
    prisma.sample.count({ where: { AND: [missingBpmOrKey, { NOT: drumBreakClause }] } }),
  ])
  const totalMissing = drumPending + restPending

  const samples = await loadSamples(drumOnly, limit)

  console.log(
    `[Backfill BPM/Key] Missing BPM/key: ${totalMissing} total (drum-break cohort: ${drumPending}, other: ${restPending}). ` +
      `Mode: ${drumOnly ? "--drum-only" : "drum-first then rest"}. ` +
      `Processing ${samples.length} row(s)${limit != null ? ` (limit ${limit})` : ""}.`
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
