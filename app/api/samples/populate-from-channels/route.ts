/**
 * Channel-first discovery: fetch uploads from known-good channels (from Sample table)
 * and run through the same filter pipeline as search. Cost: 1 unit per 50 videos vs 100 for search.
 *
 * POST ?secret=...&limit=100&maxVideosPerChannel=200
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { processVideoItems, extractMetadata } from "@/lib/youtube"
import { fetchChannelUploadsAsSearchFormat } from "@/lib/youtube-playlists"
import { storeSampleInDatabase, getExistingYoutubeIds } from "@/lib/database-samples"
import { getYouTubeApiKeys } from "@/lib/youtube-keys"

const POPULATE_SECRET = process.env.POPULATE_SECRET || "change-me-in-production"
const POST_THRESHOLD_TAG = "post-5.5k"
const TAG_THRESHOLD = 5500

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get("secret") !== POPULATE_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (getYouTubeApiKeys().length === 0) {
      return NextResponse.json(
        { error: "No YouTube API key. Set YOUTUBE_API_KEY or YOUTUBE_API_KEYS in .env." },
        { status: 500 }
      )
    }

    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500)
    const maxVideosPerChannel = Math.min(
      parseInt(searchParams.get("maxVideosPerChannel") || "200", 10),
      500
    )

    const excludedIds = await getExistingYoutubeIds()
    const channels = await prisma.channel.findMany({
      select: { channelId: true },
      where: { samples: { some: {} } },
    })
    const uniqueChannelIds = channels.map((c) => c.channelId)

    console.log(`[Channels] Found ${uniqueChannelIds.length} distinct channels from Sample table`)
    if (uniqueChannelIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No channels with channelId in Sample table. Run search populate first to seed channels.",
        stats: { channelsProcessed: 0, samplesStored: 0, pagesQueried: 0 },
      })
    }

    let samplesStored = 0
    let samplesSkipped = 0
    let channelsProcessed = 0
    let pagesQueried = 0

    for (const channelId of uniqueChannelIds) {
      if (samplesStored >= limit) break

      try {
        const items = await fetchChannelUploadsAsSearchFormat(channelId, maxVideosPerChannel)
        if (items.length === 0) continue

        pagesQueried += 1 + Math.ceil(items.length / 50)
        const { results } = await processVideoItems(items, "channel", excludedIds, {
          verbose: false,
          breakEarlyAt: 0,
        })

        for (const video of results) {
          if (samplesStored >= limit) break

          const metadata = extractMetadata(
            "channel",
            video.snippet.title,
            video.details?.description,
            video.details?.tags
          )
          const sampleCount = excludedIds.length + samplesStored
          const wasNew = await storeSampleInDatabase({
            id: video.id.videoId,
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            channelId: video.snippet.channelId,
            thumbnail:
              video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || "",
            publishedAt: video.snippet.publishedAt || "",
            genre: metadata.genre,
            era: metadata.era,
            duration: video.duration,
            source: "channel",
            tags: sampleCount >= TAG_THRESHOLD ? POST_THRESHOLD_TAG : undefined,
          })

          if (wasNew) {
            samplesStored++
            excludedIds.push(video.id.videoId)
          } else {
            samplesSkipped++
          }
        }

        channelsProcessed++
        if (results.length > 0) {
          console.log(
            `[Channels] Channel ${channelId}: ${results.length} passed, ${samplesStored} total stored`
          )
        }
        await new Promise((r) => setTimeout(r, 200))
      } catch (err: any) {
        console.error(`[Channels] Error processing channel ${channelId}:`, err?.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Channel discovery: ${samplesStored} new stored from ${channelsProcessed} channels.`,
      stats: {
        channelsProcessed,
        samplesStored,
        samplesSkipped,
        pagesQueried,
      },
    })
  } catch (err: any) {
    console.error("[Channels]", err)
    return NextResponse.json(
      { error: err?.message || "Channel discovery failed" },
      { status: 500 }
    )
  }
}
