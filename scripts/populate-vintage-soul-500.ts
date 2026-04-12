/**
 * Populate DB from "500 Rare Vintage Soul Samples" PDF — same discovery pattern as
 * populate-500-rare-vintage-jazz.ts: Playwright search (no YouTube Data API), one plain
 * `artist + title` query per track, relaxVinylIndicators: true, max 2 tracks per artist.
 * Writes markdown for spot-check / revert reference.
 *
 * Usage:
 *   USE_YOUTUBE_SCRAPER=true npx tsx scripts/populate-vintage-soul-500.ts [path-to.pdf] [--limit=N] [--dry-run]
 *   [--start-fresh] [--output=vintage-soul-500-spot-check.md] [--parse-only]
 *
 * Resume: by default continues from .populate-vintage-soul-500-state.json if present; use --start-fresh to reset.
 *
 * Default PDF: ~/Downloads/500_Rare_Vintage_Soul_Samples.pdf
 * Do not set USE_CRAWL4AI=true here — it takes precedence and skips Playwright.
 * After a Crawl4AI run, use --start-fresh once so resume state does not skip rows wrongly.
 */

import "dotenv/config"
import "./ensure-single-db-connection"
import { readFile, writeFile, unlink } from "fs/promises"
import { writeFileSync, appendFileSync } from "fs"
import path from "path"
import { PDFParse } from "pdf-parse"
import { parseVintageSoulPdfText, type VintageSoulTrack } from "../lib/vintage-soul-500"
import { searchWithQueryPaginated, extractMetadata } from "../lib/youtube"
import { storeSampleInDatabase, getExistingYoutubeIds } from "../lib/database-samples"

const DEFAULT_PDF = path.join(process.env.HOME || "", "Downloads", "500_Rare_Vintage_Soul_Samples.pdf")
const STATE_FILE = path.join(process.cwd(), ".populate-vintage-soul-500-state.json")
const DEFAULT_MD = "vintage-soul-500-spot-check.md"
const MAX_TRACKS_PER_ARTIST = 2

interface State {
  trackOffset: number
}

function mdCell(s: string): string {
  return s.replace(/\|/g, "/").replace(/\r?\n/g, " ").trim()
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
  const useScraper = process.env.USE_YOUTUBE_SCRAPER === "true"
  console.log("[Soul500] USE_YOUTUBE_SCRAPER:", useScraper ? "true" : "false")

  const args = process.argv.slice(2)
  const pathArg = args.find((a) => !a.startsWith("--"))
  const limitArg = args.find((a) => a.startsWith("--limit="))
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1], 10)) : 0
  const dryRun = args.includes("--dry-run")
  const parseOnly = args.includes("--parse-only")
  const startFresh = args.includes("--start-fresh")
  const outputArg = args.find((a) => a.startsWith("--output="))
  const mdPath = path.resolve(process.cwd(), outputArg ? outputArg.split("=")[1] : DEFAULT_MD)

  const pdfPath = path.resolve(pathArg || DEFAULT_PDF)
  console.log("[Soul500] PDF:", pdfPath)

  const rawText = await loadPdfText(pdfPath)
  const tracks = parseVintageSoulPdfText(rawText)
  console.log("[Soul500] Parsed tracks:", tracks.length, "(expected 500)")

  if (parseOnly) {
    if (tracks.length < 500) {
      console.warn("[Soul500] Parse-only: count mismatch; check PDF text extraction.")
    }
    const sample = tracks.slice(0, 3).map((t) => `${t.index}. ${t.artist} – ${t.title}`)
    console.log("[Soul500] Sample:", sample.join("\n"))
    return
  }

  if (tracks.length === 0) {
    console.error("[Soul500] No tracks parsed. Check PDF path and format.")
    process.exit(1)
  }

  let startOffset = 0
  if (!startFresh) {
    const st = await loadState()
    if (st && st.trackOffset < tracks.length) {
      startOffset = st.trackOffset
      console.log("[Soul500] Resuming at track offset", startOffset)
    }
  }
  if (startFresh) {
    await clearState()
    console.log("[Soul500] Cleared resume state.")
  }

  const slice = limit > 0 ? tracks.slice(startOffset, startOffset + limit) : tracks.slice(startOffset)
  const existingIds = dryRun ? [] : await getExistingYoutubeIds()
  const artistCount = new Map<string, number>()
  console.log(
    "[Soul500] Excluding",
    existingIds.length,
    "existing YouTube IDs. Max",
    MAX_TRACKS_PER_ARTIST,
    "tracks per artist. Run size:",
    slice.length,
    "| dryRun:",
    dryRun
  )

  const searchOptions = { verbose: false, relaxVinylIndicators: true } as {
    verbose?: boolean
    relaxVinylIndicators?: boolean
  }
  const publishedBefore = undefined

  const header = `# Vintage Soul 500 – YouTube spot check

Generated: ${new Date().toISOString()}
Source PDF: \`${pdfPath}\`

Discovery: same as \`populate-500-rare-vintage-jazz.ts\` — \`USE_YOUTUBE_SCRAPER=true\`, plain \`artist + title\` query, Playwright scrape (no Data API). **Genre and tags set to \`soul\`.** Max ${MAX_TRACKS_PER_ARTIST} stored tracks per artist.

| # | Artist | Song (list) | YouTube title | Channel | URL |
|---|--------|-------------|---------------|---------|-----|
`
  if (startOffset === 0) {
    writeFileSync(mdPath, header, "utf-8")
  } else if (!dryRun) {
    console.log("[Soul500] Append mode: not rewriting header (offset > 0).")
  }

  let stored = 0
  let skippedDup = 0
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
        `[Soul500] ${globalIdx + 1}/${tracks.length}: ${track.artist} – "${track.title}" (skip: already ${MAX_TRACKS_PER_ARTIST} for this artist)`
      )
      skippedArtistCap++
      if (!dryRun) await saveState({ trackOffset: globalIdx + 1 })
      await new Promise((r) => setTimeout(r, 500))
      continue
    }

    const searchQuery = `${track.artist} ${track.title}`.replace(/\s+/g, " ")
    const short = searchQuery.length > 55 ? searchQuery.slice(0, 55) + "…" : searchQuery
    console.log(`[Soul500] ${globalIdx + 1}/${tracks.length}: ${short}`)

    try {
      const { results } = await searchWithQueryPaginated(
        searchQuery,
        existingIds,
        publishedBefore,
        undefined,
        searchOptions
      )

      if (results.length === 0) {
        console.log(`[Soul500]   No results for: ${short}`)
        misses++
        missLines.push(`- **${track.index}** ${track.artist} – *${track.title}* — no video passed filters`)
        appendFileSync(
          mdPath,
          `| ${track.index} | ${mdCell(track.artist)} | ${mdCell(track.title)} | — | — | — |\n`,
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

      if (existingIds.includes(videoId)) {
        skippedDup++
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
          `| ${track.index} | ${mdCell(track.artist)} | ${mdCell(track.title)} | ${mdCell(title)} | ${mdCell(channelTitle)} | ${url} |\n`,
          "utf-8"
        )
        await new Promise((r) => setTimeout(r, 500))
        continue
      }

      const metadata = extractMetadata(
        searchQuery,
        title,
        video.details?.description,
        video.details?.tags
      )
      const wasNew = await storeSampleInDatabase({
        id: videoId,
        title,
        channelTitle,
        channelId: video.snippet?.channelId,
        thumbnail:
          video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || "",
        publishedAt: video.snippet?.publishedAt,
        genre: "soul",
        era: metadata.era,
        duration: video.duration,
        source: "search",
        tags: "soul",
      })

      if (wasNew) {
        stored++
        existingIds.push(videoId)
        artistCount.set(artistKey, currentArtistCount + 1)
        appendFileSync(
          mdPath,
          `| ${track.index} | ${mdCell(track.artist)} | ${mdCell(track.title)} | ${mdCell(title)} | ${mdCell(channelTitle)} | ${url} |\n`,
          "utf-8"
        )
      } else {
        skippedDup++
      }

      if (!dryRun) await saveState({ trackOffset: globalIdx + 1 })
    } catch (e) {
      console.error("[Soul500] Error:", (e as Error).message)
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
    `[Soul500] Done. Stored: ${stored}, skipped (dup/cap): ${skippedDup + skippedArtistCap}, misses/errors: ${misses}. MD: ${mdPath}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
