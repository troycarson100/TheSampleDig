/**
 * Pre-population API route
 * Runs YouTube searches and stores results in database
 * Should be called by a background job/cron
 */

import { NextResponse } from "next/server"
import { generateQueryTemplates, searchWithQueryPaginated, extractMetadata } from "@/lib/youtube"
import { storeSampleInDatabase, getExistingYoutubeIds } from "@/lib/database-samples"
import { loadPopulateResumeState, savePopulateResumeState, clearPopulateResumeState } from "@/lib/populate-resume-state"

// Secret key to protect this endpoint (set in .env)
const POPULATE_SECRET = process.env.POPULATE_SECRET || "change-me-in-production"

/** Stop early if this many pages in a row return 0 passed filter (saves quota when filter is broken). */
const MAX_CONSECUTIVE_ZERO_FILTER_PAGES = 8

/** In dry run, cap pages to avoid burning quota while verifying the pipeline. */
const DRY_RUN_MAX_PAGES = 5

/** Max pages per batch so we don't burn quota when most results are already in DB. */
const MAX_PAGES_PER_BATCH = 200

/**
 * POST /api/samples/populate
 * Pre-populates the database with samples from YouTube
 *
 * Query params:
 * - limit: Number of samples to fetch (default: 100)
 * - secret: Secret key to authorize the request
 * - dryRun: If "true", run search+filter but do not store; cap at DRY_RUN_MAX_PAGES pages. Use to verify filter before a real run.
 * - startFresh: If "true", clear saved resume state and start from page 1 of template 0.
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get("secret")
    const limit = parseInt(searchParams.get("limit") || "100", 10)
    const dryRun = searchParams.get("dryRun") === "true"
    const startFresh = searchParams.get("startFresh") === "true"

    if (secret !== POPULATE_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    console.log(`[Populate] Starting pre-population: ${limit} samples${dryRun ? " (dry run – no store)" : ""}`)

    const existingIds = await getExistingYoutubeIds()
    const excludedIds = dryRun ? [] : existingIds
    if (!dryRun) console.log(`[Populate] Excluding ${existingIds.length} existing samples from search (saving quota)`)
    const templates = generateQueryTemplates()

    let startTemplateIndex = 0
    let initialPageToken: string | undefined
    if (!dryRun && !startFresh) {
      const resume = await loadPopulateResumeState()
      if (resume && resume.templateIndex < templates.length) {
        startTemplateIndex = resume.templateIndex
        initialPageToken = resume.pageToken ?? undefined
        console.log(`[Populate] Resuming from template ${startTemplateIndex + 1}/${templates.length}${initialPageToken ? " (next page token saved)" : ""}`)
      }
    }
    if (startFresh) {
      await clearPopulateResumeState()
      console.log(`[Populate] Start fresh: cleared resume state`)
    }

    let samplesStored = 0
    let samplesSkipped = 0
    let errors = 0
    let pagesQueried = 0
    let pagesWithCandidatesScored = 0
    let totalPassedFilter = 0
    let consecutiveZeroFilterPages = 0
    let stoppedEarly: string | null = null
    const startTime = Date.now()

    // No YouTube upload-date filter: we want vintage *content* (songs from before 2010), not old uploads.
    const publishedBefore: Date | undefined = undefined

    for (let i = startTemplateIndex; i < templates.length && samplesStored < limit; i++) {
      if (stoppedEarly) break
      if (dryRun && pagesQueried >= DRY_RUN_MAX_PAGES) {
        stoppedEarly = "dry_run_page_cap"
        break
      }

      const query = templates[i]
      let pageToken: string | undefined = i === startTemplateIndex ? initialPageToken : undefined
      let pageNum = 0

      try {
        do {
          if (dryRun && pagesQueried >= DRY_RUN_MAX_PAGES) {
            stoppedEarly = "dry_run_page_cap"
            break
          }
          if (!dryRun && pagesQueried >= MAX_PAGES_PER_BATCH) {
            stoppedEarly = "max_pages_per_batch"
            console.log(`[Populate] Reached ${MAX_PAGES_PER_BATCH} pages this batch; stopping to save quota.`)
            break
          }

          pageNum++
          console.log(`[Populate] Template ${i + 1}/${templates.length} page ${pageNum}: ${query.substring(0, 50)}...`)

          const { results, nextPageToken, hadCandidates } = await searchWithQueryPaginated(
            query,
            excludedIds,
            publishedBefore,
            pageToken
          )

          pagesQueried++
          if (hadCandidates) pagesWithCandidatesScored++
          totalPassedFilter += results.length

          // Only count consecutive zero when we had candidates to score and 0 passed (not when page was all excluded)
          if (results.length === 0 && hadCandidates) {
            consecutiveZeroFilterPages++
            if (consecutiveZeroFilterPages >= MAX_CONSECUTIVE_ZERO_FILTER_PAGES) {
              stoppedEarly = "consecutive_zero_filter_pages"
              console.log(`[Populate] Stopping early: ${MAX_CONSECUTIVE_ZERO_FILTER_PAGES} consecutive pages with 0 passed filter (saving quota).`)
              break
            }
          } else {
            consecutiveZeroFilterPages = 0
          }

          // Stop only when we've actually scored many pages and still 0 passed (not when pages were all excluded).
          // When startFresh, require more pages so we don't quit early while most pages are "all excluded".
          const minScoredPagesBeforeNoResultStop = startFresh ? 80 : 25
          if (pagesWithCandidatesScored >= minScoredPagesBeforeNoResultStop && totalPassedFilter === 0 && samplesStored === 0) {
            stoppedEarly = "no_results_after_multiple_pages"
            console.log(`[Populate] Stopping early: 0 passed filter after ${pagesWithCandidatesScored} pages with candidates (saving quota).`)
            break
          }

          console.log(`[Populate] Template ${i + 1} page ${pageNum}: ${results.length} passed filter`)

          for (const video of results) {
            if (!dryRun && samplesStored >= limit) break

            try {
              if (dryRun) continue

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

              if (wasNew) {
                samplesStored++
                if (samplesStored % 10 === 0) {
                  console.log(`[Populate] Stored ${samplesStored}/${limit} samples...`)
                }
              } else {
                samplesSkipped++
              }
            } catch (error: any) {
              console.error(`[Populate] Error storing video ${video.id.videoId}:`, error?.message)
              errors++
            }
          }

          pageToken = nextPageToken
          if (!dryRun) {
            await savePopulateResumeState({
              templateIndex: nextPageToken ? i : (i + 1 < templates.length ? i + 1 : 0),
              pageToken: nextPageToken ?? null,
            })
          }
          if (pageToken) await new Promise((r) => setTimeout(r, 800))
        } while (pageToken && samplesStored < limit && !stoppedEarly)

        await new Promise((r) => setTimeout(r, 1000))
      } catch (error: any) {
        console.error(`[Populate] Error processing query "${query}":`, error?.message)
        errors++
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    const message = dryRun
      ? `Dry run: ${totalPassedFilter} passed filter over ${pagesQueried} pages (no samples stored). ${stoppedEarly ? `Stopped: ${stoppedEarly}.` : ""}`
      : `Pre-population complete: ${samplesStored} new stored, ${samplesSkipped} skipped, ${pagesQueried} pages. ${stoppedEarly ? `Stopped early: ${stoppedEarly}.` : ""}`

    return NextResponse.json({
      success: true,
      stats: {
        samplesStored: dryRun ? 0 : samplesStored,
        samplesSkipped: dryRun ? 0 : samplesSkipped,
        errors,
        pagesQueried,
        totalPassedFilter,
        elapsedSeconds: elapsed,
      },
      paginated: true,
      dryRun: dryRun || undefined,
      stoppedEarly: stoppedEarly || undefined,
      message,
    })
  } catch (error: any) {
    console.error("[Populate] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to populate database" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/samples/populate
 * Returns stats about database population
 */
export async function GET() {
  try {
    const { prisma } = await import("@/lib/db")
    const count = await prisma.sample.count()
    
    return NextResponse.json({
      totalSamples: count,
      message: `Database contains ${count} pre-populated samples`
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to get stats" },
      { status: 500 }
    )
  }
}
