/**
 * Database-first sample retrieval
 * Gets samples from pre-populated database instead of live YouTube API calls
 */

import { prisma } from "@/lib/db"
import { YouTubeVideo } from "@/types/sample"

/** Title phrases that suggest a drum-break or breakbeat video (case-insensitive match) */
const DRUM_BREAK_TITLE_PHRASES = [
  "drum break",
  "breakbeat",
  "break beat",
  "break loop",
  "drum solo",
  "break sample",
  "drum sample",
]

/**
 * Get a random sample from the database
 * Excludes videos that the user has already seen or saved
 * @param genre - Optional genre filter (case-insensitive); when set, only samples with this genre are returned
 * @param drumBreakOnly - When true, only return samples whose title suggests drum-break content
 */
export async function getRandomSampleFromDatabase(
  excludedVideoIds: string[] = [],
  userId?: string,
  genre?: string,
  drumBreakOnly?: boolean
): Promise<(YouTubeVideo & { genre?: string; era?: string; duration?: number }) | null> {
  try {
    // Build exclusion list
    let excludeIds = [...excludedVideoIds]
    
    // If user is authenticated, also exclude their saved samples
    if (userId) {
      const userSamples = await prisma.userSample.findMany({
        where: { userId },
        select: { sample: { select: { youtubeId: true } } }
      })
      const savedYoutubeIds = userSamples.map(us => us.sample.youtubeId).filter(Boolean) as string[]
      excludeIds = [...excludeIds, ...savedYoutubeIds]
      excludeIds = [...new Set(excludeIds)] // Remove duplicates
    }
    
    // Log exclusion details for debugging
    console.log(`[DB] Excluding ${excludeIds.length} videos (${excludeIds.slice(0, 3).join(", ")}${excludeIds.length > 3 ? "..." : ""})${genre ? `, genre=${genre}` : ""}${drumBreakOnly ? ", drumBreakOnly=true" : ""}`)
    
    // Build where: exclusions + optional genre + optional drum-break title filter
    type WhereClause = {
      youtubeId?: { notIn: string[] }
      genre?: { equals: string; mode: "insensitive" }
      OR?: { title: { contains: string; mode: "insensitive" } }[]
    }
    const whereClause: WhereClause =
      excludeIds.length > 0 ? { youtubeId: { notIn: excludeIds } } : {}
    if (genre && genre.trim() !== "") {
      whereClause.genre = { equals: genre.trim(), mode: "insensitive" }
    }
    if (drumBreakOnly) {
      whereClause.OR = DRUM_BREAK_TITLE_PHRASES.map((phrase) => ({
        title: { contains: phrase, mode: "insensitive" as const },
      }))
    }
    
    const totalCount = await prisma.sample.count({
      where: whereClause
    })
    
    if (totalCount === 0) {
      console.log(`[DB] No samples available (${excludeIds.length} excluded)`)
      return null
    }
    
    console.log(`[DB] Found ${totalCount} available samples after exclusions`)
    
    // Get random sample using OFFSET
    const randomOffset = Math.floor(Math.random() * totalCount)
    
    const sample = await prisma.sample.findFirst({
      where: whereClause,
      include: {
        channelRel: true
      },
      skip: randomOffset,
      take: 1
    })
    
    if (!sample) {
      return null
    }
    
    // CRITICAL: Double-check this sample is not in excluded list
    if (excludeIds.includes(sample.youtubeId)) {
      console.error(`[DB] ERROR: Selected sample ${sample.youtubeId} is in excluded list! Retrying...`)
      console.error(`[DB] Excluded list:`, excludeIds.slice(0, 10).join(", "), excludeIds.length > 10 ? "..." : "")
      // Retry with same exclusions
      return getRandomSampleFromDatabase(excludedVideoIds, userId, genre, drumBreakOnly)
    }
    
    console.log(`[DB] Retrieved sample from database: ${sample.youtubeId} - ${sample.title}`)
    console.log(`[DB] ✓ Sample ${sample.youtubeId} is NOT in excluded list (${excludeIds.length} exclusions checked)`)
    
    return {
      id: sample.youtubeId,
      title: sample.title,
      channelTitle: sample.channel,
      channelId: sample.channelId || undefined,
      thumbnail: sample.thumbnailUrl,
      publishedAt: sample.createdAt.toISOString(),
      genre: sample.genre || undefined,
      era: sample.era || undefined,
      duration: sample.duration ?? undefined,
    }
  } catch (error) {
    console.error("[DB] Error getting sample from database:", error)
    return null
  }
}

/**
 * Get count of available samples in database
 */
export async function getDatabaseSampleCount(excludedVideoIds: string[] = [], userId?: string): Promise<number> {
  try {
    let excludeIds = [...excludedVideoIds]
    
    if (userId) {
      const userSamples = await prisma.userSample.findMany({
        where: { userId },
        select: { sample: { select: { youtubeId: true } } }
      })
      const savedYoutubeIds = userSamples.map(us => us.sample.youtubeId).filter(Boolean) as string[]
      excludeIds = [...excludeIds, ...savedYoutubeIds]
      excludeIds = [...new Set(excludeIds)]
    }
    
    const whereClause = excludeIds.length > 0 
      ? { youtubeId: { notIn: excludeIds } }
      : {}
    
    return await prisma.sample.count({
      where: whereClause
    })
  } catch (error) {
    console.error("[DB] Error counting samples:", error)
    return 0
  }
}

/**
 * Store a sample in the database (used by pre-population and candidate pipeline)
 */
export async function storeSampleInDatabase(video: YouTubeVideo & {
  genre?: string
  era?: string
  duration?: number
  channelId?: string
  source?: "search" | "playlist" | "channel"
  qualityScore?: number
  embeddable?: boolean
}): Promise<boolean> {
  try {
    const existing = await prisma.sample.findUnique({
      where: { youtubeId: video.id }
    })

    const baseData = {
      title: video.title,
      channel: video.channelTitle,
      thumbnailUrl: video.thumbnail,
      genre: video.genre || null,
      era: video.era || null,
      duration: video.duration ?? null,
      qualityScore: video.qualityScore ?? null,
      source: video.source ?? null,
      embeddable: video.embeddable ?? null,
    }

    if (existing) {
      await prisma.sample.update({
        where: { id: existing.id },
        data: baseData,
      })
      return false // Already existed
    }

    let channelId: string | null = null
    if (video.channelId) {
      let channel = await prisma.channel.findUnique({
        where: { channelId: video.channelId }
      })
      if (!channel) {
        channel = await prisma.channel.create({
          data: {
            channelId: video.channelId,
            name: video.channelTitle,
            reputation: 0.5,
          }
        })
      }
      channelId = channel.id
    }

    await prisma.sample.create({
      data: {
        youtubeId: video.id,
        channelId: channelId,
        analysisStatus: "pending",
        ...baseData,
      }
    })
    
    return true // Newly created
  } catch (error: any) {
    // Handle unique constraint violation (race condition)
    if (error?.code === 'P2002') {
      console.log(`[DB] Sample ${video.id} already exists (race condition)`)
      return false
    }
    console.error("[DB] Error storing sample:", error)
    return false
  }
}
