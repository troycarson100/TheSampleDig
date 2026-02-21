/**
 * Read 300-rare-japanese-tracks-added.txt, filter junk, look up titles in DB, rewrite as "Title - Link".
 * Run: npx tsx scripts/backfill-japanese-added-links.ts
 */
import "dotenv/config"
import { readFile, writeFile } from "fs/promises"
import path from "path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const FILE = path.resolve(process.cwd(), "300-rare-japanese-tracks-added.txt")

function isJunk(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/^\d+\s*videos?\s*$/i.test(t)) return true
  if (/^now playing\s*$/i.test(t)) return true
  if (/^\s*\d+:\d+(:\d+)?\s*$/.test(t)) return true
  if (t.length < 4) return true
  return false
}

async function main() {
  const raw = await readFile(FILE, "utf-8")
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean)
  const out: string[] = []
  for (const line of lines) {
    if (isJunk(line)) continue
    const linkMatch = line.match(/\s+-\s+https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)\s*$/)
    if (linkMatch) {
      const title = line.slice(0, line.indexOf(" - https://")).trim()
      if (!isJunk(title)) out.push(`${title} - https://www.youtube.com/watch?v=${linkMatch[1]}`)
      continue
    }
    const pipeMatch = line.match(/\s+\|\s+https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)\s*$/)
    if (pipeMatch) {
      const title = line.slice(0, line.indexOf(" | https://")).trim()
      if (!isJunk(title)) out.push(`${title} - https://www.youtube.com/watch?v=${pipeMatch[1]}`)
      continue
    }
    const sample = await prisma.sample.findFirst({
      where: { title: line },
      select: { youtubeId: true },
    })
    if (sample) {
      out.push(`${line} - https://www.youtube.com/watch?v=${sample.youtubeId}`)
    } else if (!isJunk(line)) {
      out.push(line)
    }
  }
  await writeFile(FILE, out.join("\n") + "\n", "utf-8")
  console.log("[Backfill] Wrote", out.length, "lines (Title - Link) to", FILE)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
