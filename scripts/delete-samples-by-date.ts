/**
 * Delete samples added to the DB within a date range (by dateAddedDb).
 * Use after a bad populate batch to remove those samples.
 *
 * Usage:
 *   npx tsx scripts/delete-samples-by-date.ts 2025-02-18 2025-02-18
 *   npx tsx scripts/delete-samples-by-date.ts 2025-02-18T10:00 2025-02-18T12:00
 *   npx tsx scripts/delete-samples-by-date.ts --dry-run 2025-02-18
 *
 * Dates are inclusive (start of day to end of day if only date given).
 * Requires DATABASE_URL in .env.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function parseDate(s: string): Date {
  const d = new Date(s)
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`)
  return d
}

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setUTCHours(0, 0, 0, 0)
  return out
}

function endOfDay(d: Date): Date {
  const out = new Date(d)
  out.setUTCHours(23, 59, 59, 999)
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args[0] === "--dry-run"
  if (dryRun) args.shift()
  const [fromStr, toStr] = args
  if (!fromStr || !toStr) {
    console.error("Usage: npx tsx scripts/delete-samples-by-date.ts [--dry-run] <fromDate> <toDate>")
    console.error("Example: npx tsx scripts/delete-samples-by-date.ts 2025-02-18 2025-02-18")
    process.exit(1)
  }

  let from = parseDate(fromStr)
  let to = parseDate(toStr)
  if (fromStr.length <= 10) from = startOfDay(from)
  if (toStr.length <= 10) to = endOfDay(to)
  if (from > to) {
    console.error("from must be <= to")
    process.exit(1)
  }

  const count = await prisma.sample.count({
    where: {
      dateAddedDb: { gte: from, lte: to },
    },
  })

  console.log(`Samples with dateAddedDb between ${from.toISOString()} and ${to.toISOString()}: ${count}`)
  if (count === 0) {
    console.log("Nothing to delete.")
    return
  }

  if (dryRun) {
    console.log("Dry run: no rows deleted. Run without --dry-run to delete.")
    const sample = await prisma.sample.findFirst({
      where: { dateAddedDb: { gte: from, lte: to } },
      select: { youtubeId: true, title: true, dateAddedDb: true },
    })
    if (sample) console.log("Example:", sample)
    return
  }

  // Delete UserSample first (FK), then Sample
  const userSamplesDeleted = await prisma.userSample.deleteMany({
    where: {
      sample: { dateAddedDb: { gte: from, lte: to } },
    },
  })
  const samplesDeleted = await prisma.sample.deleteMany({
    where: { dateAddedDb: { gte: from, lte: to } },
  })

  console.log(`Deleted ${userSamplesDeleted.count} user_sample rows and ${samplesDeleted.count} samples.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
