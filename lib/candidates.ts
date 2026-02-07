/**
 * Candidate pipeline: ingest → enrich (videos.list) → score (AI/heuristic) → process (insert into Sample).
 */

import { prisma } from "@/lib/db"
import { fetchVideoIdsFromPlaylist, fetchVideoIdsFromChannel } from "@/lib/youtube-playlists"
import { getVideoDetailsFullBatch } from "@/lib/youtube"
import { scoreCandidate, MIN_SCORE_TO_PROMOTE } from "@/lib/quality-scorer"
import { storeSampleInDatabase } from "@/lib/database-samples"

/** Ingest: add video IDs from a playlist to candidates. */
export async function ingestPlaylist(
  playlistId: string,
  maxVideos: number = 500
): Promise<{ added: number; skipped: number }> {
  const videos = await fetchVideoIdsFromPlaylist(playlistId, maxVideos)
  return upsertCandidates(
    videos.map((v) => ({ youtubeId: v.videoId, source: "playlist", sourceId: playlistId }))
  )
}

/** Ingest: add video IDs from a channel (uploads) to candidates. */
export async function ingestChannel(
  channelId: string,
  maxVideos: number = 500
): Promise<{ added: number; skipped: number }> {
  const videos = await fetchVideoIdsFromChannel(channelId, maxVideos)
  return upsertCandidates(
    videos.map((v) => ({ youtubeId: v.videoId, source: "channel", sourceId: channelId }))
  )
}

async function upsertCandidates(
  items: { youtubeId: string; source: string; sourceId: string }[]
): Promise<{ added: number; skipped: number }> {
  let added = 0
  let skipped = 0
  for (const item of items) {
    try {
      const existing = await prisma.candidate.findUnique({
        where: { youtubeId: item.youtubeId },
      })
      if (existing) {
        skipped++
        continue
      }
      await prisma.candidate.create({
        data: {
          youtubeId: item.youtubeId,
          source: item.source,
          sourceId: item.sourceId,
        },
      })
      added++
    } catch (e: any) {
      if (e?.code === "P2002") skipped++
      else throw e
    }
  }
  return { added, skipped }
}

/** Enrich: fetch metadata from YouTube (videos.list) for candidates that don't have it. */
export async function enrichCandidates(limit: number = 100): Promise<{ enriched: number }> {
  const candidates = await prisma.candidate.findMany({
    where: { enrichedAt: null },
    take: limit,
    orderBy: { addedAt: "asc" },
  })
  if (candidates.length === 0) return { enriched: 0 }
  const videoIds = candidates.map((c) => c.youtubeId)
  const details = await getVideoDetailsFullBatch(videoIds)
  let enriched = 0
  for (const c of candidates) {
    const d = details.get(c.youtubeId)
    if (!d) continue
    const publishedAt = d.publishedAt ? new Date(d.publishedAt) : null
    await prisma.candidate.update({
      where: { id: c.id },
      data: {
        title: d.title,
        description: d.description?.slice(0, 10000) ?? null,
        channelId: d.channelId,
        channelTitle: d.channelTitle,
        thumbnailUrl: d.thumbnail,
        duration: d.duration,
        tags: JSON.stringify(d.tags || []),
        publishedAt,
        enrichedAt: new Date(),
        embeddable: d.embeddable ?? null,
      },
    })
    enriched++
  }
  return { enriched }
}

/** Score: run heuristic (and optional AI) on enriched candidates. */
export async function scoreCandidates(limit: number = 200): Promise<{ scored: number }> {
  const candidates = await prisma.candidate.findMany({
    where: { enrichedAt: { not: null }, qualityScore: null },
    take: limit,
    orderBy: { enrichedAt: "asc" },
  })
  let scored = 0
  for (const c of candidates) {
    const result = scoreCandidate(
      c.title || "",
      c.description,
      c.tags ? (JSON.parse(c.tags) as string[]) : null,
      c.channelTitle
    )
    await prisma.candidate.update({
      where: { id: c.id },
      data: {
        qualityScore: result.score,
        genre: result.genre ?? null,
        era: result.era ?? null,
      },
    })
    scored++
  }
  return { scored }
}

/** Process: promote high-scoring candidates to Sample. */
export async function processCandidates(
  limit: number = 50,
  minScore: number = MIN_SCORE_TO_PROMOTE
): Promise<{ promoted: number }> {
  const candidates = await prisma.candidate.findMany({
    where: {
      qualityScore: { gte: minScore },
      processedAt: null,
      title: { not: null },
      channelTitle: { not: null },
      thumbnailUrl: { not: null },
      OR: [{ embeddable: true }, { embeddable: null }], // only promote embeddable or unknown
    },
    take: limit,
    orderBy: { qualityScore: "desc" },
  })
  let promoted = 0
  for (const c of candidates) {
    if (!c.title || !c.channelTitle || !c.thumbnailUrl) continue
    if (c.embeddable === false) continue // skip blocked videos
    const alreadyExists = await prisma.sample.findUnique({
      where: { youtubeId: c.youtubeId },
    })
    if (alreadyExists) {
      await prisma.candidate.update({
        where: { id: c.id },
        data: { processedAt: new Date(), sampleId: alreadyExists.id },
      })
      promoted++
      continue
    }
    const created = await storeSampleInDatabase({
      id: c.youtubeId,
      title: c.title,
      channelTitle: c.channelTitle,
      thumbnail: c.thumbnailUrl,
      publishedAt: c.publishedAt?.toISOString() ?? new Date().toISOString(),
      genre: c.genre ?? undefined,
      era: c.era ?? undefined,
      duration: c.duration ?? undefined,
      channelId: c.channelId ?? undefined,
      source: (c.source === "playlist" || c.source === "channel" ? c.source : "search") as "search" | "playlist" | "channel",
      qualityScore: c.qualityScore ?? undefined,
      embeddable: c.embeddable ?? undefined,
    })
    if (created) {
      const sample = await prisma.sample.findUnique({
        where: { youtubeId: c.youtubeId },
      })
      await prisma.candidate.update({
        where: { id: c.id },
        data: {
          processedAt: new Date(),
          sampleId: sample?.id ?? null,
        },
      })
      promoted++
    } else {
      await prisma.candidate.update({
        where: { id: c.id },
        data: { processedAt: new Date() },
      })
    }
  }
  return { promoted }
}

/** Run full pipeline: enrich → score → process (for one batch). */
export async function runPipelineBatch(
  enrichLimit: number = 50,
  scoreLimit: number = 100,
  processLimit: number = 30
): Promise<{ enriched: number; scored: number; promoted: number }> {
  const { enriched } = await enrichCandidates(enrichLimit)
  const { scored } = await scoreCandidates(scoreLimit)
  const { promoted } = await processCandidates(processLimit)
  return { enriched, scored, promoted }
}
