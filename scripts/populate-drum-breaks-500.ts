/**
 * Populate DB from "500 Rare Drum Breaks" PDF: Crawl4AI or Playwright search (no YouTube Data API),
 * one `artist + title` query per track, `relaxVinylIndicators: true`, max 2 tracks per artist.
 * Stores PDF break time on Sample.breakStartSeconds and tags `drum-break-curated` for Dig filter.
 *
 * Usage:
 *   USE_CRAWL4AI=true npx tsx scripts/populate-drum-breaks-500.ts [path-to.pdf] [--limit=N] [--offset=N] [--dry-run]
 *   [--start-fresh] [--output=drum-breaks-500-spot-check.md] [--parse-only]
 *
 * `--offset=20` starts at PDF row index 20 (0-based). Combine with `--limit=480` for rows 20–499.
 * Existing samples with the same YouTube ID are **updated** (break time + tags), not skipped.
 *
 * Resume: .populate-drum-breaks-500-state.json — use --start-fresh after changing discovery backend.
 *
 * Default PDF: ~/Downloads/500_Rare_Drum_Breaks.pdf
 */

import "dotenv/config"
import "./ensure-single-db-connection"
import { readFile, writeFile, unlink } from "fs/promises"
import { writeFileSync, appendFileSync } from "fs"
import path from "path"
import { PDFParse } from "pdf-parse"
import { parseDrumBreaksPdfText, type DrumBreakTrack } from "../lib/drum-breaks-500"
import { DRUM_BREAK_CURATED_TAG } from "../lib/drum-break-title-match"
import { searchWithQueryPaginated, extractMetadata } from "../lib/youtube"
import { storeSampleInDatabase } from "../lib/database-samples"

const DEFAULT_PDF = path.join(process.env.HOME || "", "Downloads", "500_Rare_Drum_Breaks.pdf")
const STATE_FILE = path.join(process.cwd(), ".populate-drum-breaks-500-state.json")
const DEFAULT_MD = "drum-breaks-500-spot-check.md"
const MAX_TRACKS_PER_ARTIST = 2

interface State {
  trackOffset: number
}

function mdCell(s: string): string {
  return s.replace(/\|/g, "/").replace(/\r?\n/g, " ").trim()
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function normalizeArtist(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

async function loadPdfText(pdfPath: string): Promise<string> {
  const buf = await readFile(pdfPath)
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  const result = await parser.getText()
  await parser.destroy()
  return result?.text ?? ""
}

async function loadState(): Promise<State | null> {
  try {
    const raw = await readFile(STATE_FILE, "utf-8")
    const data = JSON.parse(raw) as State
    if (typeof data.trackOffset !== "number" || data.trackOffset < 0) return null
    return data
  } catch {
    return null
  }
}

async function saveState(s: State): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify(s), "utf-8")
}

async function clearState(): Promise<void> {
  try {
    await unlink(STATE_FILE)
  } catch {
    // ignore
  }
}

async function main() {
  const useCrawl4ai = process.env.USE_CRAWL4AI === "true"
  const useScraper = process.env.USE_YOUTUBE_SCRAPER === "true"
  console.log("[Drum500] USE_CRAWL4AI:", useCrawl4ai ? "true" : "false", "| USE_YOUTUBE_SCRAPER:", useScraper ? "true" : "false")

  const args = process.argv.slice(2)
  const pathArg = args.find((a) => !a.startsWith("--"))
  const limitArg = args.find((a) => a.startsWith("--limit="))
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1], 10)) : 0
  const offsetArg = args.find((a) => a.startsWith("--offset="))
  const explicitOffset = offsetArg ? Math.max(0, parseInt(offsetArg.split("=")[1], 10)) : 0
  const dryRun = args.includes("--dry-run")
  const parseOnly = args.includes("--parse-only")
  const startFresh = args.includes("--start-fresh")
  const outputArg = args.find((a) => a.startsWith("--output="))
  const mdPath = path.resolve(process.cwd(), outputArg ? outputArg.split("=")[1] : DEFAULT_MD)

  const pdfPath = path.resolve(pathArg || DEFAULT_PDF)
  console.log("[Drum500] PDF:", pdfPath)

  const rawText = await loadPdfText(pdfPath)
  const tracks = parseDrumBreaksPdfText(rawText)
  console.log("[Drum500] Parsed tracks with times:", tracks.length)

  if (parseOnly) {
    if (tracks.length === 0) {
      console.warn("[Drum500] Parse-only: zero tracks — check PDF path and line format in lib/drum-breaks-500.ts")
    }
    const sample = tracks.slice(0, 5).map(
      (t) => `${t.index}. ${t.artist} – "${t.title}" @ ${formatSec(t.breakStartSec)} (${t.breakStartSec}s)`
    )
    console.log("[Drum500] Sample:\n", sample.join("\n"))
    return
  }

  if (tracks.length === 0) {
    console.error("[Drum500] No tracks parsed. Check PDF path and format.")
    process.exit(1)
  }

  if (!useCrawl4ai && !useScraper) {
    console.error("[Drum500] Set USE_CRAWL4AI=true or USE_YOUTUBE_SCRAPER=true (no YouTube Data API on this path).")
    process.exit(1)
  }

  let startOffset = 0
  if (startFresh) {
    await clearState()
    console.log("[Drum500] Cleared resume state.")
    startOffset = explicitOffset
    if (explicitOffset > 0) console.log("[Drum500] Starting at offset", explicitOffset)
  } else {
    const st = await loadState()
    if (st && st.trackOffset < tracks.length) {
      startOffset = st.trackOffset
      console.log("[Drum500] Resuming at track offset", startOffset)
    } else if (explicitOffset > 0) {
      startOffset = explicitOffset
      console.log("[Drum500] No state file; using offset", explicitOffset)
    }
  }

  const slice = limit > 0 ? tracks.slice(startOffset, startOffset + limit) : tracks.slice(startOffset)
  // Do not exclude DB youtube IDs from search — we need the natural top hit per row; upsert updates duplicates.
  const searchExcludeIds: string[] = []
  const artistCount = new Map<string, number>()
  console.log(
    "[Drum500] Search exclusion list: empty (duplicates updated in DB). Max",
    MAX_TRACKS_PER_ARTIST,
    "new tracks per artist. Run size:",
    slice.length,
    "from offset",
    startOffset,
    "| dryRun:",
    dryRun
  )

  const searchOptions = { verbose: false, relaxVinylIndicators: true } as {
    verbose?: boolean
    relaxVinylIndicators?: boolean
  }
  const publishedBefore = undefined

  const header = `# Drum breaks 500 – YouTube spot check

Generated: ${new Date().toISOString()}
Source PDF: \`${pdfPath}\`

Discovery: \`USE_CRAWL4AI\` or \`USE_YOUTUBE_SCRAPER\`, plain \`artist + title\` query. Stored with **tags** \`${DRUM_BREAK_CURATED_TAG}\` and **breakStartSeconds** from PDF. Max ${MAX_TRACKS_PER_ARTIST} stored tracks per artist.

| # | Artist | Song (list) | Break (PDF) | YouTube title | Channel | URL |
|---|--------|-------------|---------------|---------------|---------|-----|
`
  if (startOffset === 0) {
    writeFileSync(mdPath, header, "utf-8")
  } else {
    appendFileSync(
      mdPath,
      `\n## Batch from offset ${startOffset}\n\n| # | Artist | Song (list) | Break (PDF) | YouTube title | Channel | URL |\n|---|--------|-------------|---------------|---------------|---------|-----|\n`,
      "utf-8"
    )
    console.log("[Drum500] Appending to MD from offset", startOffset)
  }

  let stored = 0
  let updated = 0
  let skippedArtistCap = 0
  let misses = 0
  const missLines: string[] = []

  for (let i = 0; i < slice.length; i++) {
    const globalIdx = startOffset + i
    const track = tracks[globalIdx]
    const artistKey = normalizeArtist(track.artist)
    const currentArtistCount = artistCount.get(artistKey) ?? 0
    if (currentArtistCount >= MAX_TRACKS_PER_ARTIST) {
      console.log(
        `[Drum500] ${globalIdx + 1}/${tracks.length}: ${track.artist} – "${track.title}" (skip: already ${MAX_TRACKS_PER_ARTIST} for this artist)`
      )
      skippedArtistCap++
      if (!dryRun) await saveState({ trackOffset: globalIdx + 1 })
      await new Promise((r) => setTimeout(r, 500))
      continue
    }

    const searchQuery = `${track.artist} ${track.title}`.replace(/\s+/g, " ")
    const short = searchQuery.length > 55 ? searchQuery.slice(0, 55) + "…" : searchQuery
    console.log(`[Drum500] ${globalIdx + 1}/${tracks.length}: ${short}`)

    try {
      const { results } = await searchWithQueryPaginated(
        searchQuery,
        searchExcludeIds,
        publishedBefore,
        undefined,
        searchOptions
      )

      if (results.length === 0) {
        console.log(`[Drum500]   No results for: ${short}`)
        misses++
        missLines.push(
          `- **${track.index}** ${track.artist} – *${track.title}* — no video passed filters`
        )
        appendFileSync(
          mdPath,
          `| ${track.index} | ${mdCell(track.artist)} | ${mdCell(track.title)} | ${formatSec(track.breakStartSec)} | — | — | — |\n`,
          "utf-8"
        )
        if (!dryRun) await saveState({ trackOffset: globalIdx + 1 })
        await new Promise((r) => setTimeout(r, 500))
        continue
      }

      const video = results[0]
      const videoId = video.id?.videoId
      if (!videoId) {
        misses++
        missLines.push(`- **${track.index}** ${track.artist} – *${track.title}* — missing video id`)
        if (!dryRun) await saveState({ trackOffset: globalIdx + 1 })
        await new Promise((r) => setTimeout(r, 500))
        continue
      }

      const title = video.snippet?.title ?? ""
      const channelTitle = video.snippet?.channelTitle ?? ""
      const url = `https://www.youtube.com/watch?v=${videoId}`

      if (dryRun) {
        stored++
        appendFileSync(
          mdPath,
          `| ${track.index} | ${mdCell(track.artist)} | ${mdCell(track.title)} | ${formatSec(track.breakStartSec)} | ${mdCell(title)} | ${mdCell(channelTitle)} | ${url} |\n`,
          "utf-8"
        )
        await new Promise((r) => setTimeout(r, 500))
        continue
      }

      const metadata = extractMetadata(searchQuery, title, video.details?.description, video.details?.tags)
      const wasNew = await storeSampleInDatabase({
        id: videoId,
        title,
        channelTitle,
        channelId: video.snippet?.channelId,
        thumbnail: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || "",
        publishedAt: video.snippet?.publishedAt,
        genre: metadata.genre,
        era: metadata.era,
        duration: video.duration,
        source: "search",
        tags: DRUM_BREAK_CURATED_TAG,
        breakStartSeconds: track.breakStartSec,
      })

      if (wasNew) {
        stored++
        artistCount.set(artistKey, currentArtistCount + 1)
      } else {
        updated++
        console.log(`[Drum500]   Updated existing youtubeId=${videoId} (PDF break ${formatSec(track.breakStartSec)})`)
      }
      appendFileSync(
        mdPath,
        `| ${track.index} | ${mdCell(track.artist)} | ${mdCell(track.title)} | ${formatSec(track.breakStartSec)} | ${mdCell(title)} | ${mdCell(channelTitle)} | ${url} |\n`,
        "utf-8"
      )

      if (!dryRun) await saveState({ trackOffset: globalIdx + 1 })
    } catch (e) {
      console.error("[Drum500] Error:", (e as Error).message)
      misses++
      missLines.push(`- **${track.index}** ${track.artist} – *${track.title}* — error: ${(e as Error).message}`)
      if (!dryRun) await saveState({ trackOffset: globalIdx + 1 })
    }

    await new Promise((r) => setTimeout(r, 500))
  }

  if (missLines.length > 0) {
    appendFileSync(mdPath, `\n## No result / error\n\n${missLines.join("\n")}\n`, "utf-8")
  }

  console.log(
    `[Drum500] Done. New: ${stored}, updated (same YouTube ID): ${updated}, skipped (artist cap): ${skippedArtistCap}, misses/errors: ${misses}. MD: ${mdPath}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
