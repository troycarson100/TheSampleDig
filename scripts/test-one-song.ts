/**
 * One-off: search for one song with the scraper, store in DB, insert line at 46 in added txt.
 * Usage: USE_YOUTUBE_SCRAPER=true npx tsx scripts/test-one-song.ts
 */

import "dotenv/config"
import "./ensure-single-db-connection"
import { readFileSync, writeFileSync } from "fs"
import path from "path"
import { searchWithQueryPaginated } from "../lib/youtube"
import { extractMetadata } from "../lib/youtube"
import { storeSampleInDatabase, getExistingYoutubeIds } from "../lib/database-samples"

const QUERY = "Can't Help but Love You The Whispers"
const OUTPUT_PATH = path.join(process.cwd(), "300-rare-japanese-tracks-added.txt")
const INSERT_AT_LINE = 46 // 1-based; new line becomes line 46

async function main() {
  process.env.USE_YOUTUBE_SCRAPER = "true"
  console.log("[Test] Query:", QUERY)
  console.log("[Test] Scraper enabled (enrich first result with watch-page title/details)")

  const existingIds = await getExistingYoutubeIds()
  const { results } = await searchWithQueryPaginated(
    QUERY,
    existingIds,
    undefined,
    undefined,
    { verbose: false }
  )

  if (results.length === 0) {
    console.error("[Test] No results")
    process.exit(1)
  }

  const video = results[0]
  const metadata = extractMetadata(
    QUERY,
    video.snippet.title,
    video.details?.description,
    video.details?.tags
  )

  const wasNew = await storeSampleInDatabase({
    id: video.id.videoId,
    title: video.snippet.title,
    channelTitle: video.snippet.channelTitle,
    channelId: video.snippet.channelId,
    thumbnail:
      video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
    publishedAt: video.snippet.publishedAt ?? "",
    genre: metadata.genre,
    era: metadata.era,
    duration: video.duration ?? undefined,
  })

  const title = (video.snippet.title ?? "").trim()
  const link = `https://www.youtube.com/watch?v=${video.id.videoId}`
  const genre = metadata.genre ?? ""
  const year = metadata.year ?? metadata.era ?? ""
  const line = `${title}, ${genre}, ${year}, ${link}`

  console.log("[Test] Title:", title)
  console.log("[Test] Genre:", genre || "(none)")
  console.log("[Test] Year:", year || "(none)")
  console.log("[Test] Link:", link)
  console.log("[Test] Stored in DB (new?):", wasNew)

  const content = readFileSync(OUTPUT_PATH, "utf-8")
  const lines = content.split(/\r?\n/)
  const index = Math.min(Math.max(0, INSERT_AT_LINE - 1), lines.length)
  lines.splice(index, 0, line)
  writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf-8")
  console.log("[Test] Inserted at line", INSERT_AT_LINE, "in", OUTPUT_PATH)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
