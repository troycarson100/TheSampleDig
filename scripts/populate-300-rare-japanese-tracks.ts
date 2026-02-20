/**
 * Populate DB with videos for the "300 Rare Japanese Tracks" list.
 * Reads the PDF (or raw .txt), searches YouTube for each track, stores the first
 * result as a sample, and writes all added video names to a text file.
 *
 * Usage:
 *   npx tsx scripts/populate-300-rare-japanese-tracks.ts [path-to-pdf-or-txt] [--limit=N] [--dry-run] [--output=added-names.txt] [--replace]
 *
 *   --replace: Process every track (don't exclude existing IDs); upsert DB and write "Title, Genre, Year, Link" for each. Use with USE_YOUTUBE_SCRAPER=true for real titles.
 *
 * Default PDF path: ~/Downloads/300_rare_japanese_tracks.pdf
 * Default output: 300-rare-japanese-tracks-added.txt (project root)
 */

import "dotenv/config"
import "./ensure-single-db-connection"
import { readFile } from "fs/promises"
import { writeFileSync, appendFileSync } from "fs"
import path from "path"
import { parseTrackLines } from "../lib/300-rare-japanese-tracks"
import { searchWithQueryPaginated } from "../lib/youtube"
import { extractMetadata } from "../lib/youtube"
import { storeSampleInDatabase, getExistingYoutubeIds } from "../lib/database-samples"

const DEFAULT_PDF_PATH = path.join(process.env.HOME || "", "Downloads", "300_rare_japanese_tracks.pdf")
const DEFAULT_OUTPUT = "300-rare-japanese-tracks-added.txt"

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

async function main() {
  const useScraper = process.env.USE_YOUTUBE_SCRAPER === "true"
  console.log("[300JP] USE_YOUTUBE_SCRAPER:", useScraper ? "true (scraper only, no API)" : "false (uses YouTube API)")

  const args = process.argv.slice(2)
  const pathArg = args.find((a) => !a.startsWith("--"))
  const limitArg = args.find((a) => a.startsWith("--limit="))
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1], 10)) : 0
  const dryRun = args.includes("--dry-run")
  const replaceMode = args.includes("--replace")
  const outputArg = args.find((a) => a.startsWith("--output="))
  const outputPath = path.resolve(
    process.cwd(),
    outputArg ? outputArg.split("=")[1] : DEFAULT_OUTPUT
  )

  const inputPath = path.resolve(pathArg || DEFAULT_PDF_PATH)
  const ext = path.extname(inputPath).toLowerCase()

  let rawText: string
  if (ext === ".pdf") {
    console.log("[300JP] Reading PDF:", inputPath)
    rawText = await getPdfText(inputPath)
  } else {
    console.log("[300JP] Reading text file:", inputPath)
    rawText = await getRawText(inputPath)
  }

  const queries = parseTrackLines(rawText)
  console.log("[300JP] Parsed", queries.length, "track queries.")

  if (queries.length === 0) {
    console.error("[300JP] No track lines found. Use PDF or a .txt with lines like: 1 Artist Track 1980")
    process.exit(1)
  }

  const toRun = limit > 0 ? queries.slice(0, limit) : queries
  const existingIds = replaceMode ? [] : await getExistingYoutubeIds()
  if (replaceMode) {
    console.log("[300JP] Replace mode: process every track, upsert DB, write Title, Genre, Year, Link for each.")
  } else {
    console.log("[300JP] Excluding", existingIds.length, "existing YouTube IDs.")
  }
  console.log("[300JP] Dry run:", dryRun)

  const addedNames: string[] = []
  let stored = 0
  let skipped = 0
  let errors = 0
  const publishedBefore = undefined
  const options = { verbose: false, relaxVinylIndicators: true } as { verbose?: boolean; relaxVinylIndicators?: boolean }

  // Start fresh list for this run
  writeFileSync(outputPath, "", "utf-8")

  for (let i = 0; i < toRun.length; i++) {
    const query = toRun[i]
    const short = query.length > 55 ? query.slice(0, 55) + "…" : query
    console.log(`[300JP] ${i + 1}/${toRun.length}: ${short}`)

    try {
      const { results } = await searchWithQueryPaginated(
        query,
        existingIds,
        publishedBefore,
        undefined,
        options
      )

      if (results.length === 0) {
        console.log(`[300JP]   No results for: ${short}`)
        errors++
        continue
      }

      const video = results[0]
      if (dryRun) {
        addedNames.push(video.snippet?.title || query)
        stored++
        continue
      }

      const metadata = extractMetadata(
        query,
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
        publishedAt: video.snippet.publishedAt,
        genre: metadata.genre,
        era: metadata.era,
        duration: video.duration,
      })

      if (wasNew) {
        stored++
        existingIds.push(video.id.videoId)
      } else {
        skipped++
      }
      addedNames.push(video.snippet.title)

      // In replace mode write every processed track; otherwise only new ones. Always use new format when writing.
      const shouldWrite = replaceMode ? true : wasNew
      if (shouldWrite) {
        const title = (video.snippet.title ?? "").trim()
        const isJunk =
          !title ||
          /^\d+\s*videos?\s*$/i.test(title) ||
          /^now playing\s*$/i.test(title) ||
          /^\s*\d+:\d+(:\d+)?\s*$/.test(title) ||
          title.length < 4
        if (!isJunk) {
          const link = `https://www.youtube.com/watch?v=${video.id.videoId}`
          const genre = metadata.genre ?? ""
          const year = metadata.year ?? metadata.era ?? ""
          appendFileSync(outputPath, `${title}, ${genre}, ${year}, ${link}\n`, "utf-8")
        }
      }
    } catch (err) {
      console.error(`[300JP]   Error:`, (err as Error).message)
      errors++
    }

    await new Promise((r) => setTimeout(r, 500))
  }

  console.log("[300JP] Done. Stored:", stored, "| Skipped (dupes):", skipped, "| Errors:", errors)
  console.log("[300JP] Videos added:", outputPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
