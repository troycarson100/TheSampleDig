/**
 * Ingest YouTube videos whose title contains "drum break" (any case) and title/description
 * has a recording year 1960–1989, using Search mode drumBreakEra (no vinyl-rip scorer).
 *
 * Saved command (project root):
 *   npm run populate:drum-break-era
 *
 * Same with overrides (args after `--`):
 *   npm run populate:drum-break-era -- --target=50
 *   npm run populate:drum-break-era -- --dry-run --target=5
 *   npm run populate:drum-break-era -- --output=reports/drum-break-era-added.txt
 *
 * Direct:
 *   npx tsx scripts/populate-drum-break-era.ts [--target=300] [--dry-run] [--output=reports/drum-break-era-added.txt]
 *
 * Quota: uses **no** YouTube Data API — Playwright search + watch-page scrape only (`searchWithQueryPaginated` mode drumBreakEra).
 * Slow but avoids API keys/quota entirely.
 */

import "dotenv/config"
import "./ensure-single-db-connection"
import path from "path"
import { appendFileSync, writeFileSync } from "fs"
import { searchWithQueryPaginated, extractMetadata } from "../lib/youtube"
import { storeSampleInDatabase, getExistingYoutubeIds } from "../lib/database-samples"

const DEFAULT_OUTPUT = path.join("reports", "drum-break-era-added.txt")

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`
  const exact = process.argv.find((a) => a.startsWith(prefix))
  return exact ? exact.slice(prefix.length) : undefined
}

function parseNumArg(name: string, fallback: number): number {
  const raw = argValue(name)
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function escapeCsvField(value: string | number): string {
  const s = String(value ?? "")
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function buildQueries(): string[] {
  const genres = [
    "soul",
    "funk",
    "jazz",
    "r&b",
    "disco",
    "latin",
    "rock",
    "psych",
    "blues",
    "boogie",
    "breakbeat",
    "rare groove",
    "library",
    "soundtrack",
    "afrobeat",
    "reggae",
    "fusion",
  ]
  const years = [
    "1965",
    "1968",
    "1969",
    "1970",
    "1971",
    "1972",
    "1973",
    "1974",
    "1975",
    "1976",
    "1977",
    "1978",
    "1979",
    "1980",
    "1981",
    "1982",
    "1983",
    "1984",
    "1985",
    "1986",
    "1987",
    "1988",
    "1989",
  ]
  const out = new Set<string>()
  for (const g of genres) {
    for (const y of years) {
      out.add(`"DRUM BREAK" ${g} ${y}`)
    }
  }
  const extras = [
    '"DRUM BREAK" vinyl 1970',
    '"DRUM BREAK" vinyl 1975',
    '"DRUM BREAK" vinyl 1980',
    '"DRUM BREAK" full track 1972',
    '"DRUM BREAK" classic 1970s',
    '"DRUM BREAK" classic 1980s',
    '"DRUM BREAK" sample 1973',
    '"DRUM BREAK" loop 1976',
    '"DRUM BREAK" 1970s soul',
    '"DRUM BREAK" 1980s funk',
    '"DRUM BREAK" rare 1974',
    '"DRUM BREAK" obscure 1971',
    '"DRUM BREAK" lp 1978',
    '"DRUM BREAK" album cut 1975',
    '"DRUM BREAK" breakbeat 1972',
    '"DRUM BREAK" drums only 1970',
  ]
  for (const e of extras) out.add(e)
  return [...out]
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const target = parseNumArg("target", 300)
  const dryRun = process.argv.includes("--dry-run")
  const outputPath = path.resolve(process.cwd(), argValue("output") ?? DEFAULT_OUTPUT)

  const queries = buildQueries()
  console.log("[DrumBreakEra] Queries:", queries.length, "| target:", target, "| dry-run:", dryRun)

  const existingList = await getExistingYoutubeIds()
  const existingSet = new Set(existingList)
  console.log("[DrumBreakEra] Excluding", existingSet.size, "existing YouTube IDs")

  writeFileSync(
    outputPath,
    "title,channel,genre,era,url,tags\n",
    "utf-8"
  )

  let stored = 0
  let skippedDup = 0

  outer: for (const q of queries) {
    if (stored >= target) break

    let pageToken: string | undefined
    let pagesForQuery = 0
    const maxPagesPerQuery = 15

    while (stored < target && pagesForQuery < maxPagesPerQuery) {
      const excluded = [...existingSet]
      let results: any[]
      let nextPageToken: string | undefined
      try {
        const out = await searchWithQueryPaginated(q, excluded, undefined, pageToken, {
          mode: "drumBreakEra",
        })
        results = out.results
        nextPageToken = out.nextPageToken
      } catch (e) {
        console.error(`[DrumBreakEra] Search error for "${q.slice(0, 60)}...":`, e)
        break
      }

      pagesForQuery++
      console.log(
        `[DrumBreakEra] Query (${pagesForQuery}p): ${q.slice(0, 72)}... → ${results.length} passed filters`
      )

      for (const video of results) {
        if (stored >= target) break outer
        const id = typeof video?.id?.videoId === "string" ? video.id.videoId : null
        if (!id) continue
        if (existingSet.has(id)) {
          skippedDup++
          continue
        }

        const title = String(video.snippet?.title ?? "")
        const channelTitle = String(video.snippet?.channelTitle ?? "")
        const thumb =
          video.snippet?.thumbnails?.medium?.url ||
          video.snippet?.thumbnails?.default?.url ||
          ""
        const desc = String(video.details?.description ?? "")
        const tagsArr = Array.isArray(video.details?.tags) ? video.details.tags : []

        const metadata = extractMetadata(q, title, desc, tagsArr)
        const genre = metadata.genre
        const era = metadata.era

        const link = `https://www.youtube.com/watch?v=${id}`
        const tagStr = "drum-break-youtube-ingest"

        if (dryRun) {
          console.log(`[DrumBreakEra] DRY ${stored + 1}/${target}: ${title.slice(0, 70)}`)
          stored++
          existingSet.add(id)
          const line =
            [title, channelTitle, genre ?? "", era ?? "", link, tagStr]
              .map((v) => escapeCsvField(v ?? ""))
              .join(",") + "\n"
          appendFileSync(outputPath, line, "utf-8")
          continue
        }

        let wasNew = false
        try {
          wasNew = await storeSampleInDatabase({
            id,
            title,
            channelTitle,
            channelId: video.snippet?.channelId,
            thumbnail: thumb,
            publishedAt: video.snippet?.publishedAt ?? new Date().toISOString(),
            duration: video.duration,
            genre: genre ?? undefined,
            era: era ?? undefined,
            source: "search",
            tags: tagStr,
          })
        } catch (err) {
          console.error(`[DrumBreakEra] Store failed ${id}:`, err)
          continue
        }

        if (wasNew) {
          stored++
          existingSet.add(id)
          const line =
            [title, channelTitle, genre ?? "", era ?? "", link, tagStr]
              .map((v) => escapeCsvField(v ?? ""))
              .join(",") + "\n"
          appendFileSync(outputPath, line, "utf-8")
          console.log(`[DrumBreakEra] Stored ${stored}/${target}: ${title.slice(0, 70)}`)
        } else {
          existingSet.add(id)
          skippedDup++
        }

        await sleep(400)
      }

      if (!nextPageToken) break
      pageToken = nextPageToken
      await sleep(350)
    }
  }

  console.log(
    `[DrumBreakEra] Done. New stored: ${stored}${dryRun ? " (dry-run)" : ""} / target ${target}. Skipped dupes/race: ${skippedDup}. Output: ${outputPath}`
  )
  if (stored < target && !dryRun) {
    console.warn(
      `[DrumBreakEra] Reached end of query rotation at ${stored} new rows — increase queries or re-run later.`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
