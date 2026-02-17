/**
 * Export all samples to a CSV so you can try external BPM/key lookup (e.g. ChatGPT in chunks).
 *
 * Usage: npx tsx scripts/export-samples-for-bpm-key.ts [output.csv]
 *   Default output: samples-for-bpm-key.csv in project root
 *
 * Columns: youtubeId, title, channel, bpm, key
 * Use title + channel when asking an LLM for BPM/key (e.g. "For each track give BPM and key: ...").
 */

import { config } from "dotenv"
import { resolve } from "path"
import { writeFileSync } from "fs"

config({ path: resolve(process.cwd(), ".env") })

import { PrismaClient } from "@prisma/client"

function escapeCsv(s: string | null | undefined): string {
  if (s == null) return ""
  const t = String(s)
  if (t.includes('"') || t.includes(",") || t.includes("\n")) return `"${t.replace(/"/g, '""')}"`
  return t
}

async function main() {
  const outPath = resolve(process.cwd(), process.argv[2] || "samples-for-bpm-key.csv")
  const prisma = new PrismaClient()
  const samples = await prisma.sample.findMany({
    orderBy: { createdAt: "asc" },
    select: { youtubeId: true, title: true, channel: true, bpm: true, key: true },
  })
  await prisma.$disconnect()

  const header = "youtubeId,title,channel,bpm,key"
  const rows = samples.map(
    (s) =>
      [s.youtubeId, s.title ?? "", s.channel ?? "", s.bpm ?? "", s.key ?? ""].map(escapeCsv).join(",")
  )
  const csv = [header, ...rows].join("\n")
  writeFileSync(outPath, csv, "utf8")
  console.log(`[Export] Wrote ${samples.length} rows to ${outPath}`)
  console.log("[Export] Use title + channel to ask ChatGPT for BPM/key in chunks (e.g. 50–100 tracks per message).")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
