/**
 * Discover playlists via YouTube API search (type=playlist), then ingest their video IDs into candidates.
 * Uses curated queries (rare samples, vintage jazz, genres, artists/albums).
 *
 * POST body (optional):
 *   seedPlaylistIds: string[] - curated playlist IDs to ingest first (no search, 1 unit/50 videos)
 *   queries: string[] - override default search queries
 *   maxPlaylistSearches: number - max API search calls (default 25, 100 units each)
 *   maxPlaylistsToIngest: number - max playlists to fetch videos from (default 80)
 *   maxVideosPerPlaylist: number - max videos to take per playlist (default 400)
 *   skipSearch: boolean - if true and seedPlaylistIds provided, skip search entirely
 */

import { NextResponse } from "next/server"
import { searchPlaylists } from "@/lib/youtube-playlists"
import { ingestPlaylist } from "@/lib/candidates"
import { DISCOVER_PLAYLIST_QUERIES } from "@/lib/discover-playlists-queries"
import { getYouTubeApiKeys } from "@/lib/youtube-keys"

const SECRET = process.env.POPULATE_SECRET || "change-me-in-production"

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get("secret") !== SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (getYouTubeApiKeys().length === 0) {
      return NextResponse.json(
        { error: "No YouTube API key set. Add YOUTUBE_API_KEY or YOUTUBE_API_KEYS (comma-separated) to .env." },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const queries: string[] = Array.isArray(body.queries)
      ? body.queries
      : DISCOVER_PLAYLIST_QUERIES
    const maxPlaylistSearches = Math.min(
      parseInt(String(body.maxPlaylistSearches || 25), 10),
      50
    )
    const maxPlaylistsToIngest = Math.min(
      parseInt(String(body.maxPlaylistsToIngest || 80), 10),
      200
    )
    const maxVideosPerPlaylist = Math.min(
      parseInt(String(body.maxVideosPerPlaylist || 400), 10),
      500
    )
    const seedPlaylistIds: string[] = Array.isArray(body.seedPlaylistIds)
      ? body.seedPlaylistIds.filter((id: unknown) => typeof id === "string" && id.trim().length > 0)
      : []
    const skipSearch = body.skipSearch === true

    const seenPlaylistIds = new Set<string>()
    const playlistsToIngest: { playlistId: string; title: string }[] = []

    // Seed playlists first (curated, no search cost)
    for (const pid of seedPlaylistIds) {
      if (!seenPlaylistIds.has(pid)) {
        seenPlaylistIds.add(pid)
        playlistsToIngest.push({ playlistId: pid, title: "(seed)" })
      }
    }

    if (!skipSearch) {
      for (let i = 0; i < Math.min(queries.length, maxPlaylistSearches); i++) {
        const q = queries[i]
        const results = await searchPlaylists(q, 50)
        for (const p of results) {
          if (!seenPlaylistIds.has(p.playlistId)) {
            seenPlaylistIds.add(p.playlistId)
            playlistsToIngest.push(p)
          }
        }
        if (i < queries.length - 1) await new Promise((r) => setTimeout(r, 200))
      }
    }

    const toIngest = playlistsToIngest.slice(0, maxPlaylistsToIngest)
    let totalAdded = 0
    let totalSkipped = 0

    for (let i = 0; i < toIngest.length; i++) {
      const { playlistId } = toIngest[i]
      const { added, skipped } = await ingestPlaylist(playlistId, maxVideosPerPlaylist)
      totalAdded += added
      totalSkipped += skipped
      if ((i + 1) % 10 === 0) {
        console.log(`[Discover] Ingested ${i + 1}/${toIngest.length} playlists, candidates +${totalAdded}`)
      }
      await new Promise((r) => setTimeout(r, 150))
    }

    return NextResponse.json({
      success: true,
      seedPlaylistsIngested: seedPlaylistIds.length,
      playlistsFound: playlistsToIngest.length - seedPlaylistIds.length,
      playlistsIngested: toIngest.length,
      candidatesAdded: totalAdded,
      candidatesSkipped: totalSkipped,
      message: `Ingested ${toIngest.length} playlists (${seedPlaylistIds.length} seed). ${totalAdded} new candidate videos added.`,
    })
  } catch (e: any) {
    console.error("[Discover Playlists]", e)
    return NextResponse.json(
      { error: e?.message || "Discover playlists failed" },
      { status: 500 }
    )
  }
}
