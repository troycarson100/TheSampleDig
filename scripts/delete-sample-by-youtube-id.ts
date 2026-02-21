/**
 * Delete a single sample by YouTube ID (and any user saves referencing it).
 * Usage: npx tsx scripts/delete-sample-by-youtube-id.ts <youtubeId>
 */
import "dotenv/config"
import "./ensure-single-db-connection"
import { prisma } from "@/lib/db"

const YOUTUBE_ID = process.argv[2] || "10llfskRJEs"

async function main() {
  const sample = await prisma.sample.findUnique({
    where: { youtubeId: YOUTUBE_ID },
    select: { id: true, title: true },
  })
  if (!sample) {
    console.log("[Delete] No sample found for youtube_id:", YOUTUBE_ID)
    return
  }
  await prisma.userSample.deleteMany({ where: { sampleId: sample.id } })
  await prisma.sample.delete({ where: { id: sample.id } })
  console.log("[Delete] Removed:", sample.title, "| youtube_id:", YOUTUBE_ID)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
