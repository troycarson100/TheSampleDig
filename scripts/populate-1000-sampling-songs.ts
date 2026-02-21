/**
 * Populate DB with videos for the "1000 Sampling Songs" list.
 * Reads the JSON (artist_name, track_title, genre, year), searches YouTube for each track,
 * stores the first result as a sample (cross-referencing DB to avoid duplicates), and writes
 * "Artist Name, Track Name, Year, Genre, Link" to a text file for each newly added video.
 *
 * Usage:
 *   npx tsx scripts/populate-1000-sampling-songs.ts [path-to-json] [--limit=N] [--dry-run] [--output=filename.txt]
 *
 * Default JSON path: ~/Downloads/1000_sampling_songs_clean.json
 * Default output: 1000-sampling-songs-added.txt (project root)
 */

import "dotenv/config"
import "./ensure-single-db-connection"
import path from "path"
import { writeFileSync, appendFileSync } from "fs"
import { load1000SamplingSongs, buildSearchQuery } from "../lib/1000-sampling-songs"
import { searchWithQueryPaginated } from "../lib/youtube"
import { extractMetadata } from "../lib/youtube"
import { storeSampleInDatabase, getExistingYoutubeIds } from "../lib/database-samples"

const DEFAULT_JSON_PATH = path.join(process.env.HOME || "", "Downloads", "1000_sampling_songs_clean.json")
const DEFAULT_OUTPUT = "1000-sampling-songs-added.txt"

function escapeCsvField(value: string | number): string {
  const s = String(value ?? "")
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

async function main() {
  const useScraper = process.env.USE_YOUTUBE_SCRAPER === "true"
  console.log("[1000] USE_YOUTUBE_SCRAPER:", useScraper ? "true (scraper only, no API)" : "false (uses YouTube API)")

  const args = process.argv.slice(2)
  const pathArg = args.find((a) => !a.startsWith("--"))
  const limitArg = args.find((a) => a.startsWith("--limit="))
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1], 10)) : 0
  const dryRun = args.includes("--dry-run")
  const outputArg = args.find((a) => a.startsWith("--output="))
  const outputPath = path.resolve(
    process.cwd(),
    outputArg ? outputArg.split("=")[1] : DEFAULT_OUTPUT
  )

  const inputPath = path.resolve(pathArg || DEFAULT_JSON_PATH)
  console.log("[1000] Reading JSON:", inputPath)

  const entries = await load1000SamplingSongs(inputPath)
  console.log("[1000] Loaded", entries.length, "songs.")

  if (entries.length === 0) {
    console.error("[1000] No entries found in JSON.")
    process.exit(1)
  }

  const toRun = limit > 0 ? entries.slice(0, limit) : entries
  const existingIds = await getExistingYoutubeIds()
  console.log("[1000] Cross-referencing DB: excluding", existingIds.length, "existing YouTube IDs.")
  console.log("[1000] Dry run:", dryRun)

  writeFileSync(outputPath, "Artist Name, Track Name, Year, Genre, Link\n", "utf-8")

  let stored = 0
  let skipped = 0
  let errors = 0
  const publishedBefore = undefined
  const options = { verbose: false, relaxVinylIndicators: true }

  for (let i = 0; i < toRun.length; i++) {
    const entry = toRun[i]
    const query = buildSearchQuery(entry)
    const short = query.length > 55 ? query.slice(0, 55) + "…" : query
    console.log(`[1000] ${i + 1}/${toRun.length}: ${short}`)

    try {
      const { results } = await searchWithQueryPaginated(
        query,
        existingIds,
        publishedBefore,
        undefined,
        options
      )

      if (results.length === 0) {
        console.log(`[1000]   No results for: ${short}`)
        errors++
        continue
      }

      const video = results[0]
      if (dryRun) {
        const link = `https://www.youtube.com/watch?v=${video.id.videoId}`
        const line = [entry.artist_name, entry.track_title, entry.year, entry.genre, link]
          .map((v) => escapeCsvField(v))
          .join(", ") + "\n"
        appendFileSync(outputPath, line, "utf-8")
        stored++
        continue
      }

      const metadata = extractMetadata(
        query,
        video.snippet.title,
        video.details?.description,
        video.details?.tags
      )
      const genre = entry.genre || metadata.genre
      const era = metadata.era || (entry.year ? String(entry.year) : undefined)

      let wasNew = false
      try {
        wasNew = await storeSampleInDatabase({
          id: video.id.videoId,
          title: video.snippet.title,
          channelTitle: video.snippet.channelTitle,
          channelId: video.snippet.channelId,
          thumbnail:
            video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
          publishedAt: video.snippet.publishedAt,
          genre: genre ?? undefined,
          era: era ?? undefined,
          duration: video.duration,
        })
      } catch (dbErr) {
        console.error(`[1000]   DB store failed:`, (dbErr as Error).message)
        errors++
      }

      if (wasNew) {
        stored++
        existingIds.push(video.id.videoId)
      } else {
        skipped++
      }

      // Always write when we found a link so the txt has results even if DB store failed (e.g. connection limit)
      const link = `https://www.youtube.com/watch?v=${video.id.videoId}`
      const line = [entry.artist_name, entry.track_title, entry.year, entry.genre, link]
        .map((v) => escapeCsvField(v))
        .join(", ") + "\n"
      appendFileSync(outputPath, line, "utf-8")
    } catch (err) {
      console.error(`[1000]   Error:`, (err as Error).message)
      errors++
    }

    await new Promise((r) => setTimeout(r, 500))
  }

  console.log("[1000] Done. Stored:", stored, "| Skipped (dupes):", skipped, "| Errors:", errors)
  console.log("[1000] Output:", outputPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
