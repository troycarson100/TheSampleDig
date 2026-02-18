/**
 * Remove samples where title or description indicates the song/content is from 2000 or later.
 * Keeps: free sample packs, royalty-free packs, etc.
 *
 * Uses YouTube API to fetch descriptions (~1 unit per 50 videos). Run when quota is available.
 *
 * Usage: npx tsx scripts/remove-modern-samples.ts [--dry-run]
 * Env: SOURCE_FILTER - only process samples with this source (e.g. "channel"). Omit to process all.
 */

import "dotenv/config"
import { prisma } from "@/lib/db"
import { getVideoDetailsFullBatch } from "@/lib/youtube"

const DRY_RUN = process.argv.includes("--dry-run")
const SOURCE_FILTER = process.env.SOURCE_FILTER || undefined

// Year 2000-2029 as release year
const MODERN_YEAR_REGEX = /\b(20[0-2][0-9])\b/

// Keep these even if modern (free/royalty-free sample packs)
const KEEP_PHRASES = [
  "free sample pack",
  "sample pack",
  "royalty free",
  "royalty-free",
  "royalty free pack",
  "creative commons",
  "cc0",
  "public domain",
  "free to use",
  "no copyright",
]

function hasModernYear(text: string): number | null {
  const m = text.match(MODERN_YEAR_REGEX)
  return m ? parseInt(m[1], 10) : null
}

function shouldKeepDespiteModern(text: string): boolean {
  const lower = text.toLowerCase()
  return KEEP_PHRASES.some((p) => lower.includes(p))
}

async function main() {
  const where = SOURCE_FILTER ? { source: SOURCE_FILTER } : {}
  const samples = await prisma.sample.findMany({
    where,
    select: { id: true, youtubeId: true, title: true },
  })

  console.log(`[RemoveModern] Checking ${samples.length} samples${SOURCE_FILTER ? ` (source=${SOURCE_FILTER})` : ""}${DRY_RUN ? " (dry run)" : ""}`)

  const toRemove: { id: string; youtubeId: string; title: string; year: number }[] = []
  const batchSize = 50

  for (let i = 0; i < samples.length; i += batchSize) {
    const batch = samples.slice(i, i + batchSize)
    const videoIds = batch.map((s) => s.youtubeId)
    const details = await getVideoDetailsFullBatch(videoIds)

    for (const sample of batch) {
      const d = details.get(sample.youtubeId)
      const title = sample.title || ""
      const desc = d?.description || ""
      const text = `${title} ${desc}`

      const year = hasModernYear(text)
      if (!year) continue

      if (shouldKeepDespiteModern(text)) continue

      toRemove.push({ id: sample.id, youtubeId: sample.youtubeId, title, year })
    }

    if ((i + batchSize) % 200 === 0) {
      console.log(`[RemoveModern] Checked ${Math.min(i + batchSize, samples.length)}/${samples.length}...`)
    }
    await new Promise((r) => setTimeout(r, 100))
  }

  console.log(`[RemoveModern] Found ${toRemove.length} modern samples (2000+) to remove`)

  if (DRY_RUN) {
    toRemove.slice(0, 20).forEach((r) => console.log(`  - ${r.title.slice(0, 60)}... (${r.year})`))
    if (toRemove.length > 20) console.log(`  ... and ${toRemove.length - 20} more`)
    return
  }

  let removed = 0
  for (const r of toRemove) {
    await prisma.sample.delete({ where: { id: r.id } })
    removed++
  }

  console.log(`[RemoveModern] Removed ${removed} samples`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
