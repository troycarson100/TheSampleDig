/**
 * Pre-population API route
 * Runs YouTube searches and stores results in database
 * Should be called by a background job/cron
 */

import { NextResponse } from "next/server"
import { generateQueryTemplates, searchWithQuery, extractMetadata } from "@/lib/youtube"
import { storeSampleInDatabase } from "@/lib/database-samples"

// Secret key to protect this endpoint (set in .env)
const POPULATE_SECRET = process.env.POPULATE_SECRET || "change-me-in-production"

/**
 * POST /api/samples/populate
 * Pre-populates the database with samples from YouTube
 * 
 * Query params:
 * - limit: Number of samples to fetch (default: 100)
 * - secret: Secret key to authorize the request
 */
export async function POST(request: Request) {
  try {
    // Check authorization
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get("secret")
    const limit = parseInt(searchParams.get("limit") || "100", 10)
    
    if (secret !== POPULATE_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    console.log(`[Populate] Starting pre-population: ${limit} samples`)
    
    const templates = generateQueryTemplates()
    let samplesStored = 0
    let samplesSkipped = 0
    let errors = 0
    const startTime = Date.now()
    
    // Try each query template
    for (let i = 0; i < templates.length && samplesStored < limit; i++) {
      const query = templates[i]
      console.log(`[Populate] Processing template ${i + 1}/${templates.length}: ${query.substring(0, 60)}...`)
      
      try {
        // Search YouTube (no exclusions for pre-population)
        const results = await searchWithQuery(query, false, [], new Date("2010-01-01"))
        
        console.log(`[Populate] Found ${results.length} videos for query`)
        
        // Store each result in database
        for (const video of results) {
          if (samplesStored >= limit) break
          
          try {
            // Extract metadata
            const metadata = extractMetadata(
              query,
              video.snippet.title,
              video.details?.description,
              video.details?.tags
            )
            
            // Store in database
            const wasNew = await storeSampleInDatabase({
              id: video.id.videoId,
              title: video.snippet.title,
              channelTitle: video.snippet.channelTitle,
              channelId: video.snippet.channelId,
              thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url,
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
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error: any) {
        console.error(`[Populate] Error processing query "${query}":`, error?.message)
        errors++
        // Continue with next query
      }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    
    return NextResponse.json({
      success: true,
      stats: {
        samplesStored,
        samplesSkipped,
        errors,
        elapsedSeconds: elapsed,
      },
      message: `Pre-population complete: ${samplesStored} new samples stored, ${samplesSkipped} skipped, ${errors} errors`
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
