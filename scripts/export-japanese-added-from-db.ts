/**
 * Export all recently added samples from DB (from 300 Japanese run) as "Title - Link".
 * Run: npx tsx scripts/export-japanese-added-from-db.ts
 */
import "dotenv/config"
import { writeFile } from "fs/promises"
import path from "path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const FILE = path.resolve(process.cwd(), "300-rare-japanese-tracks-added.txt")

function isJunk(title: string): boolean {
  const t = title.trim()
  if (!t) return true
  if (/^\d+\s*videos?\s*$/i.test(t)) return true
  if (/now playing/i.test(t)) return true
  if (/^\s*\d+:\d+(:\d+)?\s*$/.test(t)) return true
  if (/^\s*\d+:\d+(:\d+)?\s*$/m.test(t)) return true
  if (t.length < 4) return true
  const firstLine = t.split(/\r?\n/)[0].trim()
  if (/^\d+:\d+(:\d+)?\s*$/.test(firstLine)) return true
  return false
}

async function main() {
  const since = new Date()
  since.setDate(since.getDate() - 14)
  const samples = await prisma.sample.findMany({
    where: { dateAddedDb: { not: null, gte: since } },
    orderBy: { dateAddedDb: "desc" },
    take: 2000,
    select: { title: true, youtubeId: true },
  })
  const withRealTitles = samples.filter((s) => !isJunk(s.title))
  const lines = withRealTitles.map((s) => `${s.title} - https://www.youtube.com/watch?v=${s.youtubeId}`)
  await writeFile(FILE, lines.join("\n") + "\n", "utf-8")
  console.log("[Export] Wrote", lines.length, "samples with real titles (Title - Link) to", FILE)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
