/**
 * Export YouTube video names (titles) for all samples in the database.
 *
 * Usage: npx tsx scripts/export-youtube-video-names.ts [output.txt]
 *   Default output: youtube-video-names.txt in project root
 */

import { config } from "dotenv"
import { resolve } from "path"
import { writeFileSync } from "fs"

config({ path: resolve(process.cwd(), ".env") })

import { PrismaClient } from "@prisma/client"

async function main() {
  const outPath = resolve(process.cwd(), process.argv[2] || "youtube-video-names.txt")
  const prisma = new PrismaClient()
  const samples = await prisma.sample.findMany({
    orderBy: { createdAt: "asc" },
    select: { title: true },
  })
  await prisma.$disconnect()

  const names = samples.map((s) => s.title)
  const content = names.join("\n")
  writeFileSync(outPath, content, "utf8")
  console.log(`[Export] Wrote ${samples.length} video names to ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
