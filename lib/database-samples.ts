/**
 * Database-first sample retrieval
 * Gets samples from pre-populated database instead of live YouTube API calls
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { DRUM_BREAK_CURATED_TAG, DRUM_BREAK_TITLE_PHRASES } from "@/lib/drum-break-title-match"
import { YouTubeVideo } from "@/types/sample"
import { fetchCanonicalYoutubeTitleIfGarbage } from "./youtube-sample-title"
import { titleLooksLikeYoutubePlayerChrome } from "./youtube-title-garbage"

/**
 * If `title` is YouTube player chrome (e.g. "3:08 3:08 Now playing"), replace with the real
 * title from the Data API and persist on `samples` when a row exists (or when later created).
 */
export async function ensureUsableYoutubeTitle(youtubeId: string, title: string): Promise<string> {
  if (!titleLooksLikeYoutubePlayerChrome(title)) return title
  const fixed = await fetchCanonicalYoutubeTitleIfGarbage(youtubeId, title)
  if (fixed !== title) {
    await prisma.sample.updateMany({
      where: { youtubeId },
      data: { title: fixed },
    })
    console.log(`[DB] Repaired garbage YouTube title for ${youtubeId}`)
  }
  return fixed
}

/** PostgreSQL regex: at least one character in Hiragana, Katakana, or CJK Unified Ideographs (common Kanji). Inlined in SQL to avoid parameter encoding issues. */
const JAPANESE_TITLE_REGEX_LITERAL = "[ぁ-んァ-ン一-龥]"

/**
 * Get a random sample when genre filter is "japanese": matches genre, tags containing "japanese",
 * or title/channel containing Japanese script (Hiragana, Katakana, Kanji). Uses raw SQL for regex.
 */
async function getRandomSampleJapanese(
  excludeIds: string[],
  era?: string,
  drumBreakOnly?: boolean,
  royaltyFreeOnly?: boolean
): Promise<(YouTubeVideo & { genre?: string; era?: string; duration?: number; breakStartSeconds?: number }) | null> {
  const excludeCondition =
    excludeIds.length === 0
      ? Prisma.sql`true`
      : Prisma.sql`s.youtube_id NOT IN (${Prisma.join(excludeIds.map((id) => Prisma.sql`${id}`), ", ")})`
  // Use Prisma.raw for regex so pattern is inlined (constant, no injection); parameterized regex can break in some drivers
  const japaneseMatch = Prisma.raw(
    `(s.genre ILIKE 'japanese' OR s.tags ILIKE '%japanese%' OR s.title ~ '${JAPANESE_TITLE_REGEX_LITERAL.replace(/'/g, "''")}' OR s.channel ~ '${JAPANESE_TITLE_REGEX_LITERAL.replace(/'/g, "''")}')`
  )
  const eraCondition =
    era && era.trim() !== "" && !royaltyFreeOnly ? Prisma.sql`AND s.era = ${era.trim()}` : Prisma.empty
  const drumCondition =
    drumBreakOnly && DRUM_BREAK_TITLE_PHRASES.length > 0
      ? Prisma.sql`AND (${Prisma.join(
          [
            ...DRUM_BREAK_TITLE_PHRASES.map((p) => Prisma.sql`s.title ILIKE ${"%" + p + "%"}`),
            Prisma.sql`s.tags ILIKE ${"%" + DRUM_BREAK_CURATED_TAG + "%"}`,
          ],
          " OR "
        )})`
      : Prisma.empty
  const royaltyCondition =
    royaltyFreeOnly && ROYALTY_FREE_TITLE_PHRASES.length > 0
      ? Prisma.sql`AND (${Prisma.join(
          ROYALTY_FREE_TITLE_PHRASES.map((p) => Prisma.sql`s.title ILIKE ${"%" + p + "%"}`),
          " OR "
        )})`
      : Prisma.empty

  type Row = {
    youtube_id: string
    title: string
    channel: string
    channel_id: string | null
    thumbnail_url: string
    created_at: Date
    genre: string | null
    era: string | null
    duration_seconds: number | null
    break_start_seconds: number | null
  }
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT s.youtube_id, s.title, s.channel, s.channel_id, s.thumbnail_url, s.created_at, s.genre, s.era, s.duration_seconds, s.break_start_seconds
    FROM samples s
    WHERE ${excludeCondition}
      AND ${japaneseMatch}
      ${eraCondition}
      ${drumCondition}
      ${royaltyCondition}
    ORDER BY random()
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  const title = await ensureUsableYoutubeTitle(row.youtube_id, row.title)
  return {
    id: row.youtube_id,
    title,
    channelTitle: row.channel,
    channelId: row.channel_id ?? undefined,
    thumbnail: row.thumbnail_url,
    publishedAt: row.created_at.toISOString(),
    genre: row.genre ?? undefined,
    era: row.era ?? undefined,
    duration: row.duration_seconds ?? undefined,
    breakStartSeconds: row.break_start_seconds ?? undefined,
  }
}

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
): Promise<(YouTubeVideo & { genre?: string; era?: string; duration?: number; breakStartSeconds?: number }) | null> {
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

    // Japanese filter: try raw SQL (genre/tags/title/channel with Japanese script) first; on error fall back to Prisma (genre OR tags only)
    if (genre?.trim().toLowerCase() === "japanese") {
      try {
        const jp = await getRandomSampleJapanese(
          excludeIds,
          era?.trim() || undefined,
          drumBreakOnly,
          royaltyFreeOnly
        )
        if (jp) return jp
      } catch (err) {
        console.error("[DB] Japanese raw query failed, using Prisma fallback:", (err as Error)?.message)
      }
    }

    // Build where: exclusions + optional genre + optional era (skipped when royaltyFree) + optional title filters
    const whereClause: Prisma.SampleWhereInput =
      excludeIds.length > 0 ? { youtubeId: { notIn: excludeIds } } : {}
    if (genre && genre.trim() !== "") {
      const g = genre.trim()
      if (g.toLowerCase() === "japanese") {
        whereClause.OR = [
          { genre: { equals: g, mode: "insensitive" } },
          { tags: { contains: "japanese", mode: "insensitive" } },
        ]
      } else {
        whereClause.genre = { equals: g, mode: "insensitive" }
      }
    }
    if (era && era.trim() !== "" && !royaltyFreeOnly) {
      whereClause.era = { equals: era.trim() }
    }
    const andClauses: Prisma.SampleWhereInput[] = []
    if (drumBreakOnly) {
      andClauses.push({
        OR: [
          ...DRUM_BREAK_TITLE_PHRASES.map((phrase) => ({
            title: { contains: phrase, mode: "insensitive" as const },
          })),
          { tags: { contains: DRUM_BREAK_CURATED_TAG, mode: "insensitive" as const } },
        ],
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
    
    const resolvedTitle = await ensureUsableYoutubeTitle(sample.youtubeId, sample.title)
    console.log(`[DB] Retrieved sample from database: ${sample.youtubeId} - ${resolvedTitle}`)
    console.log(`[DB] ✓ Sample ${sample.youtubeId} is NOT in excluded list (${excludeIds.length} exclusions checked)`)
    
    return {
      id: sample.youtubeId,
      title: resolvedTitle,
      channelTitle: sample.channel,
      channelId: sample.channelId || undefined,
      thumbnail: sample.thumbnailUrl,
      publishedAt: sample.createdAt.toISOString(),
      genre: sample.genre || undefined,
      era: sample.era || undefined,
      duration: sample.duration ?? undefined,
      breakStartSeconds: sample.breakStartSeconds ?? undefined,
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

/** Merge comma-separated tags without duplicates (preserves non-drum tags on update). */
function mergeSampleTags(existing: string | null | undefined, incoming: string | undefined): string | null {
  if (incoming === undefined) return existing ?? null
  const set = new Set<string>()
  for (const t of (existing ?? "").split(",")) {
    const s = t.trim()
    if (s) set.add(s)
  }
  for (const t of incoming.split(",")) {
    const s = t.trim()
    if (s) set.add(s)
  }
  const arr = [...set]
  return arr.length > 0 ? arr.join(", ") : null
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
  /** Curated drum-break start (seconds); stored on Sample for Dig seek */
  breakStartSeconds?: number
}): Promise<boolean> {
  try {
    const existing = await prisma.sample.findUnique({
      where: { youtubeId: video.id }
    })

    const safeTitle = await ensureUsableYoutubeTitle(video.id, video.title)

    const baseData = {
      title: safeTitle,
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
      breakStartSeconds: video.breakStartSeconds ?? null,
      dateAddedDb: new Date(),
    }

    if (existing) {
      const updateData: Prisma.SampleUpdateInput = { ...baseData }
      if (video.tags !== undefined) {
        updateData.tags = mergeSampleTags(existing.tags ?? null, video.tags) ?? video.tags
      }
      if (video.breakStartSeconds !== undefined) updateData.breakStartSeconds = video.breakStartSeconds
      await prisma.sample.update({
        where: { id: existing.id },
        data: updateData,
      })
      return false // Already existed (updated in place — preserves user saves)
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
