/**
 * Ingest: add video IDs from playlists and/or channels to the candidates table.
 * POST body: { playlists?: string[], channels?: string[] }
 * Query: secret, maxPerSource (default 500)
 */

import { NextResponse } from "next/server"
import { ingestPlaylist, ingestChannel } from "@/lib/candidates"

const SECRET = process.env.POPULATE_SECRET || "change-me-in-production"

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get("secret") !== SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const maxPerSource = Math.min(parseInt(searchParams.get("maxPerSource") || "500", 10), 2000)

    const body = await request.json().catch(() => ({}))
    let playlists: string[] = Array.isArray(body.playlists) ? body.playlists : []
    let channels: string[] = Array.isArray(body.channels) ? body.channels : []
    // Env fallback: CANDIDATE_PLAYLIST_IDS, CANDIDATE_CHANNEL_IDS (comma-separated)
    if (playlists.length === 0 && process.env.CANDIDATE_PLAYLIST_IDS) {
      playlists = process.env.CANDIDATE_PLAYLIST_IDS.split(",").map((s) => s.trim()).filter(Boolean)
    }
    if (channels.length === 0 && process.env.CANDIDATE_CHANNEL_IDS) {
      channels = process.env.CANDIDATE_CHANNEL_IDS.split(",").map((s) => s.trim()).filter(Boolean)
    }
    if (playlists.length === 0 && channels.length === 0) {
      return NextResponse.json({
        error: "Provide playlists and/or channels in body or set CANDIDATE_PLAYLIST_IDS / CANDIDATE_CHANNEL_IDS",
        example: { playlists: ["PLxxx"], channels: ["UCxxx"] },
      }, { status: 400 })
    }

    let totalAdded = 0
    let totalSkipped = 0

    for (const playlistId of playlists) {
      const { added, skipped } = await ingestPlaylist(playlistId, maxPerSource)
      totalAdded += added
      totalSkipped += skipped
    }
    for (const channelId of channels) {
      const { added, skipped } = await ingestChannel(channelId, maxPerSource)
      totalAdded += added
      totalSkipped += skipped
    }

    return NextResponse.json({
      success: true,
      added: totalAdded,
      skipped: totalSkipped,
      playlistsProcessed: playlists.length,
      channelsProcessed: channels.length,
    })
  } catch (e: any) {
    console.error("[Candidates Ingest]", e)
    return NextResponse.json({ error: e?.message || "Ingest failed" }, { status: 500 })
  }
}
