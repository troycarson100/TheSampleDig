/**
 * Populate DB with videos from the crate digger list (PDF-parsed artist/album entries).
 * Runs YouTube search for each crate digger query and stores results via storeSampleInDatabase.
 *
 * Usage:
 *   npx tsx scripts/populate-crate-digger.ts [--limit=N] [--pages-per-query=N] [--dry-run] [--resume] [--start-fresh]
 *
 * - limit: max number of queries to run this run (default 100; total list ~549).
 * - pages-per-query: max pages to fetch per query (default 1).
 * - dry-run: don't store, only log how many would be stored.
 * - resume: continue from last saved query index (default true if state file exists).
 * - start-fresh: ignore resume state and start from query 0.
 */

import "dotenv/config"
import { getCrateDiggerSearchQueries } from "../lib/crate-digger-list"
import { searchWithQueryPaginated, extractMetadata } from "../lib/youtube"
import { storeSampleInDatabase, getExistingYoutubeIds } from "../lib/database-samples"
import { readFile, writeFile, unlink } from "fs/promises"
import path from "path"

const STATE_FILE = path.join(process.cwd(), ".populate-crate-digger-state.json")

interface State {
  queryIndex: number
}

async function loadState(): Promise<State | null> {
  try {
    const raw = await readFile(STATE_FILE, "utf-8")
    const data = JSON.parse(raw) as State
    if (typeof data.queryIndex !== "number" || data.queryIndex < 0) return null
    return data
  } catch {
    return null
  }
}

async function saveState(state: State): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify(state), "utf-8")
}

async function clearState(): Promise<void> {
  try {
    await unlink(STATE_FILE)
  } catch {
    // ignore
  }
}

async function main() {
  const args = process.argv.slice(2)
  const limit = Math.max(1, parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "100", 10))
  const pagesPerQuery = Math.max(1, Math.min(5, parseInt(args.find((a) => a.startsWith("--pages-per-query="))?.split("=")[1] || "1", 10)))
  const dryRun = args.includes("--dry-run")
  const startFresh = args.includes("--start-fresh")
  const resume = args.includes("--resume") || !startFresh

  const queries = getCrateDiggerSearchQueries()
  const totalQueries = queries.length
  console.log(`[CrateDigger] Total crate digger queries: ${totalQueries}`)
  if (dryRun) console.log("[CrateDigger] DRY RUN – no samples will be stored.")

  let startIndex = 0
  if (resume && !startFresh) {
    const state = await loadState()
    if (state && state.queryIndex < totalQueries) {
      startIndex = state.queryIndex
      console.log(`[CrateDigger] Resuming from query index ${startIndex}`)
    }
  }
  if (startFresh) {
    await clearState()
    console.log("[CrateDigger] Start fresh: cleared resume state.")
  }

  const existingIds = await getExistingYoutubeIds()
  const excludedIds = dryRun ? [] : existingIds
  console.log(`[CrateDigger] Excluding ${existingIds.length} existing YouTube IDs from search.`)

  let samplesStored = 0
  let samplesSkipped = 0
  let errors = 0
  const endIndex = Math.min(startIndex + limit, totalQueries)

  for (let i = startIndex; i < endIndex; i++) {
    const query = queries[i]
    const shortQuery = query.substring(0, 60) + (query.length > 60 ? "…" : "")
    console.log(`[CrateDigger] Query ${i + 1}/${totalQueries}: ${shortQuery}`)

    let pageToken: string | undefined
    let pageNum = 0
    try {
      do {
        const { results, nextPageToken } = await searchWithQueryPaginated(
          query,
          excludedIds,
          undefined,
          pageToken,
          { verbose: false, relaxVinylIndicators: true }
        )
        pageNum++
        console.log(`[CrateDigger]   Page ${pageNum}: ${results.length} passed filter`)

        for (const video of results) {
          try {
            if (dryRun) {
              samplesStored++
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
              thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
              publishedAt: video.snippet.publishedAt,
              genre: metadata.genre,
              era: metadata.era,
              duration: video.duration,
            })
            if (wasNew) samplesStored++
            else samplesSkipped++
          } catch (err: unknown) {
            console.error(`[CrateDigger]   Error storing ${video.id.videoId}:`, (err as Error).message)
            errors++
          }
        }

        pageToken = nextPageToken ?? undefined
        if (pageToken && pageNum < pagesPerQuery) {
          await new Promise((r) => setTimeout(r, 800))
        } else {
          break
        }
      } while (pageToken)

      if (!dryRun) await saveState({ queryIndex: i + 1 })
      await new Promise((r) => setTimeout(r, 600))
    } catch (err: unknown) {
      console.error(`[CrateDigger] Error on query ${i + 1}:`, (err as Error).message)
      errors++
    }
  }

  console.log(
    `[CrateDigger] Done. Stored: ${samplesStored}, skipped (dupes): ${samplesSkipped}, errors: ${errors}. Next run will resume from query ${endIndex}.`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
