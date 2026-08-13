/**
 * Quick acapella search probe.
 * Scans the full first page and applies acapella-specific filtering.
 *
 * Usage:
 *   npx tsx scripts/try-acapella-search.ts "artist song title"
 *   npx tsx scripts/try-acapella-search.ts "artist song title" --limit=15
 */

import "dotenv/config"
import { searchWithQueryPaginated } from "@/lib/youtube"

function parseLimitArg(args: string[]): number {
  const raw = args.find((a) => a.startsWith("--limit="))?.split("=")[1]
  if (!raw) return 10
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 10
}

function toVideoId(item: any): string | null {
  if (typeof item?.id?.videoId === "string") return item.id.videoId
  if (typeof item?.id === "string") return item.id
  return null
}

async function main() {
  const args = process.argv.slice(2)
  const queryBase = args.find((a) => !a.startsWith("--"))
  if (!queryBase) {
    console.error('Usage: npx tsx scripts/try-acapella-search.ts "artist song title" [--limit=15]')
    process.exit(1)
  }

  const limit = parseLimitArg(args)
  const variants = [
    `${queryBase} acapella`,
    `${queryBase} a cappella`,
    `${queryBase} vocals only`,
  ]

  for (const query of variants) {
    console.log(`\n[acapella-probe] Query: ${query}`)
    const { results } = await searchWithQueryPaginated(
      query,
      [],
      undefined,
      undefined,
      { mode: "acapella" }
    )

    if (!results.length) {
      console.log("[acapella-probe]   No acapella-filtered matches on first page")
      continue
    }

    const top = results.slice(0, limit)
    for (let i = 0; i < top.length; i++) {
      const row = top[i]
      const id = toVideoId(row)
      const title = String(row?.snippet?.title ?? "Untitled")
      const channel = String(row?.snippet?.channelTitle ?? "Unknown")
      const url = id ? `https://www.youtube.com/watch?v=${id}` : "(no id)"
      console.log(`${i + 1}. ${title} — ${channel}\n   ${url}`)
    }
  }
}

main().catch((err) => {
  console.error("[acapella-probe] Failed:", err)
  process.exit(1)
})
