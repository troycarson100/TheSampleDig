/**
 * Delete Sample rows by YouTube video id(s). Clears candidates.sampleId when present.
 *
 * Usage: npx tsx scripts/delete-sample-youtube-ids.ts <youtubeId> [youtubeId...]
 */

import "dotenv/config"
import { prisma } from "@/lib/db"

async function main() {
  const ids = process.argv.slice(2).filter(Boolean)
  if (ids.length === 0) {
    console.error("Usage: npx tsx scripts/delete-sample-youtube-ids.ts <youtubeId> [youtubeId...]")
    process.exit(1)
  }

  await prisma.candidate.updateMany({
    where: { youtubeId: { in: ids } },
    data: { sampleId: null },
  })

  const result = await prisma.sample.deleteMany({
    where: { youtubeId: { in: ids } },
  })

  console.log(`Deleted ${result.count} sample(s) for ${ids.length} youtube id(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
