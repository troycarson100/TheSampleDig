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

/** Title phrases for Sample Packs mode: royalty-free or sample pack videos (case-insensitive) */
const ROYALTY_FREE_TITLE_PHRASES = [
  "royalty free",
  "royalty-free",
  "royaltyfree",
  "creative commons",
  "cc0",
  "public domain",
  "free to use",
  "no copyright",
  "free sample pack",
  "sample pack",
  "sample packs",
  "samplepack",
  "samplepacks",
  "sample kit",
  "loop pack",
  "loop packs",
  "drum pack",
  "drum packs",
  "free samples",
  "free loops",
  "free drums",
  "sample loops",
  "one shot",
  "one shots",
]

/**
 * Get a random sample from the database
 * Excludes videos that the user has already seen or saved
 * @param genre - Optional genre filter (case-insensitive); when set, only samples with this genre are returned
 * @param era - Optional era filter (e.g. "1960s", "1970s"); when set, only samples with this era are returned (ignored when royaltyFreeOnly)
 * @param drumBreakOnly - When true, only return samples whose title suggests drum-break content
 * @param royaltyFreeOnly - When true, only return samples whose title contains "royalty free" or "sample pack" etc.; disables era filter
 */
export async function getRandomSampleFromDatabase(
  excludedVideoIds: string[] = [],
  userId?: string,
  genre?: string,
  drumBreakOnly?: boolean,
  era?: string,
  royaltyFreeOnly?: boolean
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
    console.log(`[DB] Excluding ${excludeIds.length} videos (${excludeIds.slice(0, 3).join(", ")}${excludeIds.length > 3 ? "..." : ""})${genre ? `, genre=${genre}` : ""}${era && !royaltyFreeOnly ? `, era=${era}` : ""}${drumBreakOnly ? ", drumBreakOnly=true" : ""}${royaltyFreeOnly ? ", royaltyFreeOnly=true" : ""}`)
    
    // Build where: exclusions + optional genre + optional era (skipped when royaltyFree) + optional title filters
    type WhereClause = {
      youtubeId?: { notIn: string[] }
      genre?: { equals: string; mode: "insensitive" }
      era?: { equals: string }
      OR?: { title: { contains: string; mode: "insensitive" } }[]
      AND?: { OR: { title: { contains: string; mode: "insensitive" } }[] }[]
    }
    const whereClause: WhereClause =
      excludeIds.length > 0 ? { youtubeId: { notIn: excludeIds } } : {}
    if (genre && genre.trim() !== "") {
      whereClause.genre = { equals: genre.trim(), mode: "insensitive" }
    }
    if (era && era.trim() !== "" && !royaltyFreeOnly) {
      whereClause.era = { equals: era.trim() }
    }
    const andClauses: { OR: { title: { contains: string; mode: "insensitive" } }[] }[] = []
    if (drumBreakOnly) {
      andClauses.push({
        OR: DRUM_BREAK_TITLE_PHRASES.map((phrase) => ({
          title: { contains: phrase, mode: "insensitive" as const },
        })),
      })
    }
    if (royaltyFreeOnly) {
      andClauses.push({
        OR: ROYALTY_FREE_TITLE_PHRASES.map((phrase) => ({
          title: { contains: phrase, mode: "insensitive" as const },
        })),
      })
    }
    if (andClauses.length > 0) {
      whereClause.AND = andClauses
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
      return getRandomSampleFromDatabase(excludedVideoIds, userId, genre, drumBreakOnly, era, royaltyFreeOnly)
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
 * Get all YouTube video IDs already in the database (for populate exclusion).
 * Used so we only fetch details for candidates we don't already have.
 */
export async function getExistingYoutubeIds(): Promise<string[]> {
  try {
    const rows = await prisma.sample.findMany({
      select: { youtubeId: true },
    })
    return rows.map((r) => r.youtubeId)
  } catch (error) {
    console.error("[DB] Error loading existing youtubeIds:", error)
    return []
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
  tags?: string
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
    const createData = {
      ...baseData,
      tags: video.tags ?? null,
    }

    if (existing) {
      const updateData = video.tags !== undefined ? { ...baseData, tags: video.tags } : baseData
      await prisma.sample.update({
        where: { id: existing.id },
        data: updateData,
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
        ...createData,
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
