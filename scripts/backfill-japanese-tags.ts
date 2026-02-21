/**
 * Backfill tags = 'japanese' for samples listed in 300-rare-japanese-tracks-added.txt
 * so the Japanese genre filter on the dig page includes them (genre may be jazz/funk/etc).
 *
 * Run: npx tsx scripts/backfill-japanese-tags.ts
 */
import "dotenv/config"
import "./ensure-single-db-connection"
import { readFile } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/db"

const FILE = path.resolve(process.cwd(), "300-rare-japanese-tracks-added.txt")
const JAPANESE_TAG = "japanese"

function extractYoutubeId(line: string): string | null {
  const match = line.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

async function main() {
  const raw = await readFile(FILE, "utf-8")
  const lines = raw.split(/\r?\n/).filter((l) => l.trim())
  const ids = [...new Set(lines.map(extractYoutubeId).filter((id): id is string => id != null))]
  console.log("[Backfill] Parsed", ids.length, "YouTube IDs from", FILE)

  const samples = await prisma.sample.findMany({
    where: { youtubeId: { in: ids } },
    select: { youtubeId: true, tags: true },
  })
  const toUpdate = samples.filter((s) => {
    const existing = (s.tags ?? "").trim()
    return !existing.toLowerCase().includes(JAPANESE_TAG)
  })
  console.log("[Backfill] In DB:", samples.length, "| Need tag:", toUpdate.length)

  let updated = 0
  for (const s of toUpdate) {
    const existing = (s.tags ?? "").trim()
    const newTags = existing ? `${existing},${JAPANESE_TAG}` : JAPANESE_TAG
    await prisma.sample.update({
      where: { youtubeId: s.youtubeId },
      data: { tags: newTags },
    })
    updated++
  }

  console.log("[Backfill] Updated", updated, "samples with tag", JAPANESE_TAG)
  if (ids.length > samples.length) console.log("[Backfill] Not in DB:", ids.length - samples.length, "IDs")
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
