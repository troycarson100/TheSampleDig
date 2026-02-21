/**
 * Populate DB and txt for "500 Rare Vintage Jazz Tracks" list.
 * - No duplicates (excludes existing YouTube IDs).
 * - Max 2 songs per artist for this list.
 * - Output txt: "Artist name, track name, year, genre, link"
 *
 * Usage:
 *   USE_YOUTUBE_SCRAPER=true npx tsx scripts/populate-500-rare-vintage-jazz.ts [path-to-pdf] [--limit=N] [--dry-run] [--output=filename.txt]
 *
 * Default PDF: ~/Downloads/500_Rare_Vintage_Jazz_Tracks.pdf
 * Default output: 500-rare-vintage-jazz-added.txt
 */

import "dotenv/config"
import "./ensure-single-db-connection"
import { readFile } from "fs/promises"
import { writeFileSync, appendFileSync } from "fs"
import path from "path"
import { parse500JazzLines, type JazzTrack } from "../lib/500-rare-vintage-jazz"
import { searchWithQueryPaginated } from "../lib/youtube"
import { extractMetadata } from "../lib/youtube"
import { storeSampleInDatabase, getExistingYoutubeIds } from "../lib/database-samples"

const DEFAULT_PDF_PATH = path.join(process.env.HOME || "", "Downloads", "500_Rare_Vintage_Jazz_Tracks.pdf")
const DEFAULT_OUTPUT = "500-rare-vintage-jazz-added.txt"
const MAX_TRACKS_PER_ARTIST = 2

async function getPdfText(pdfPath: string): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse")
    const buf = await readFile(pdfPath)
    const parser = new PDFParse({ data: new Uint8Array(buf) })
    const result = await parser.getText()
    await parser.destroy()
    return result?.text ?? ""
  } catch (e) {
    throw new Error(`Failed to read PDF: ${(e as Error).message}`)
  }
}

async function getRawText(txtPath: string): Promise<string> {
  return readFile(txtPath, "utf-8")
}

function normalizeArtist(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

async function main() {
  const useScraper = process.env.USE_YOUTUBE_SCRAPER === "true"
  console.log("[500Jazz] USE_YOUTUBE_SCRAPER:", useScraper ? "true" : "false")

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

  const inputPath = path.resolve(pathArg || DEFAULT_PDF_PATH)
  const ext = path.extname(inputPath).toLowerCase()

  let rawText: string
  if (ext === ".pdf") {
    console.log("[500Jazz] Reading PDF:", inputPath)
    rawText = await getPdfText(inputPath)
  } else {
    console.log("[500Jazz] Reading text file:", inputPath)
    rawText = await getRawText(inputPath)
  }

  const entries = parse500JazzLines(rawText)
  console.log("[500Jazz] Parsed", entries.length, "track entries.")

  if (entries.length === 0) {
    console.error("[500Jazz] No track lines found. Expected format: 1. Artist – \"Track\"")
    process.exit(1)
  }

  const toRun = limit > 0 ? entries.slice(0, limit) : entries
  const existingIds = await getExistingYoutubeIds()
  const artistCount = new Map<string, number>()
  console.log("[500Jazz] Excluding", existingIds.length, "existing YouTube IDs. Max", MAX_TRACKS_PER_ARTIST, "tracks per artist.")

  let stored = 0
  let skippedDup = 0
  let skippedArtistCap = 0
  let errors = 0
  const publishedBefore = undefined
  const options = { verbose: false, relaxVinylIndicators: true } as { verbose?: boolean; relaxVinylIndicators?: boolean }

  writeFileSync(outputPath, "", "utf-8")

  for (let i = 0; i < toRun.length; i++) {
    const { artist, track, searchQuery } = toRun[i]
    const key = normalizeArtist(artist)
    const currentCount = artistCount.get(key) ?? 0
    if (currentCount >= MAX_TRACKS_PER_ARTIST) {
      console.log(`[500Jazz] ${i + 1}/${toRun.length}: ${artist} – "${track}" (skip: already ${MAX_TRACKS_PER_ARTIST} for this artist)`)
      skippedArtistCap++
      continue
    }

    const short = searchQuery.length > 55 ? searchQuery.slice(0, 55) + "…" : searchQuery
    console.log(`[500Jazz] ${i + 1}/${toRun.length}: ${short}`)

    try {
      const { results } = await searchWithQueryPaginated(
        searchQuery,
        existingIds,
        publishedBefore,
        undefined,
        options
      )

      if (results.length === 0) {
        console.log(`[500Jazz]   No results for: ${short}`)
        errors++
        continue
      }

      const video = results[0]
      const videoId = video.id.videoId
      if (existingIds.includes(videoId)) {
        skippedDup++
        continue
      }

      if (dryRun) {
        stored++
        continue
      }

      const metadata = extractMetadata(
        searchQuery,
        video.snippet.title,
        video.details?.description,
        video.details?.tags
      )
      const wasNew = await storeSampleInDatabase({
        id: videoId,
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        channelId: video.snippet.channelId,
        thumbnail:
          video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
        publishedAt: video.snippet.publishedAt,
        genre: metadata.genre ?? "jazz",
        era: metadata.era,
        duration: video.duration,
      })

      if (wasNew) {
        stored++
        existingIds.push(videoId)
        artistCount.set(key, currentCount + 1)

        const title = (video.snippet.title ?? "").trim()
        const isJunk =
          !title ||
          /^\d+\s*videos?\s*$/i.test(title) ||
          /^now playing\s*$/i.test(title) ||
          /^\s*\d+:\d+(:\d+)?\s*$/.test(title) ||
          title.length < 4
        if (!isJunk) {
          const link = `https://www.youtube.com/watch?v=${videoId}`
          const year = metadata.year ?? metadata.era ?? ""
          const genre = metadata.genre ?? "jazz"
          appendFileSync(outputPath, `${artist}, ${track}, ${year}, ${genre}, ${link}\n`, "utf-8")
        }
      } else {
        skippedDup++
      }
    } catch (err) {
      console.error(`[500Jazz]   Error:`, (err as Error).message)
      errors++
    }

    await new Promise((r) => setTimeout(r, 500))
  }

  console.log("[500Jazz] Done. Stored:", stored, "| Skipped (dup/cap):", skippedDup + skippedArtistCap, "| Errors:", errors)
  console.log("[500Jazz] Output:", outputPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
