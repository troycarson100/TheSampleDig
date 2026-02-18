/**
 * YouTube Data API: fetch video IDs from playlists and channel uploads.
 * Used for quota-efficient discovery (1 unit per 50 items vs 100 for search).
 * Uses key rotation (YOUTUBE_API_KEYS or YOUTUBE_API_KEY) on quota exceeded.
 */

import { fetchWithKeyRotation, fetchWithKeyRoundRobin, getYouTubeApiKeys } from "./youtube-keys"

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
const PLAYLIST_ITEMS_URL = "https://www.googleapis.com/youtube/v3/playlistItems"
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"

/** Search for playlists by query. Cost: 100 units per request. */
export async function searchPlaylists(
  query: string,
  maxResults: number = 50
): Promise<{ playlistId: string; title: string }[]> {
  const out: { playlistId: string; title: string }[] = []
  if (getYouTubeApiKeys().length === 0) return out
  const res = await fetchWithKeyRoundRobin((key) => {
    const params = new URLSearchParams({
      part: "snippet",
      type: "playlist",
      q: query,
      maxResults: String(Math.min(maxResults, 50)),
      key,
    })
    return fetch(`${SEARCH_URL}?${params}`)
  })
  const data = await res.json()
  for (const item of data.items || []) {
    const id = item.id?.playlistId
    if (id) out.push({ playlistId: id, title: item.snippet?.title || "" })
  }
  return out
}

export interface PlaylistItemVideo {
  videoId: string
  title?: string
  publishedAt?: string
}

/** Full playlist item (search-compatible format for processVideoItems). */
export interface PlaylistItemSearchFormat {
  id: { videoId: string }
  snippet: { title: string; channelTitle: string; channelId?: string; thumbnails?: any; publishedAt?: string }
}

/**
 * Get the "uploads" playlist ID for a channel (required to list channel videos).
 * Cost: 1 unit.
 */
export async function getChannelUploadsPlaylistId(channelId: string): Promise<string | null> {
  if (getYouTubeApiKeys().length === 0) return null
  try {
    const res = await fetchWithKeyRotation((key) => {
      const params = new URLSearchParams({
        part: "contentDetails",
        id: channelId,
        key,
      })
      return fetch(`${CHANNELS_URL}?${params}`)
    })
    const data = await res.json()
    const uploads = data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    return uploads || null
  } catch {
    return null
  }
}

/**
 * Fetch all video IDs from a playlist (paginated).
 * Cost: 1 unit per 50 items.
 */
export async function fetchVideoIdsFromPlaylist(
  playlistId: string,
  maxVideos: number = 500
): Promise<PlaylistItemVideo[]> {
  const videos: PlaylistItemVideo[] = []
  let pageToken: string | undefined
  if (getYouTubeApiKeys().length === 0) return videos

  do {
    const res = await fetchWithKeyRoundRobin((key) => {
      const params = new URLSearchParams({
        part: "snippet",
        playlistId,
        maxResults: "50",
        key,
      })
      if (pageToken) params.set("pageToken", pageToken)
      return fetch(`${PLAYLIST_ITEMS_URL}?${params}`)
    })
    const data = await res.json()

    for (const item of data.items || []) {
      const videoId = item.snippet?.resourceId?.videoId
      if (videoId) {
        videos.push({
          videoId,
          title: item.snippet?.title,
          publishedAt: item.snippet?.publishedAt,
        })
        if (videos.length >= maxVideos) return videos
      }
    }
    pageToken = data.nextPageToken
    if (pageToken) await new Promise((r) => setTimeout(r, 100))
  } while (pageToken)

  return videos
}

/**
 * Fetch playlist items in search-compatible format (id.videoId + full snippet).
 * Used by channel discovery to run through the same filter pipeline as search.
 * Cost: 1 unit per 50 items.
 */
export async function fetchPlaylistItemsAsSearchFormat(
  playlistId: string,
  maxVideos: number = 500
): Promise<PlaylistItemSearchFormat[]> {
  const items: PlaylistItemSearchFormat[] = []
  let pageToken: string | undefined
  if (getYouTubeApiKeys().length === 0) return items

  do {
    const res = await fetchWithKeyRoundRobin((key) => {
      const params = new URLSearchParams({
        part: "snippet",
        playlistId,
        maxResults: "50",
        key,
      })
      if (pageToken) params.set("pageToken", pageToken)
      return fetch(`${PLAYLIST_ITEMS_URL}?${params}`)
    })
    const data = await res.json()
    for (const item of data.items || []) {
      const videoId = item.snippet?.resourceId?.videoId
      if (videoId && item.snippet) {
        items.push({
          id: { videoId },
          snippet: item.snippet,
        })
        if (items.length >= maxVideos) return items
      }
    }
    pageToken = data.nextPageToken
    if (pageToken) await new Promise((r) => setTimeout(r, 100))
  } while (pageToken)

  return items
}

/**
 * Fetch channel uploads in search-compatible format (for filter pipeline).
 * Cost: 1 (channels.list) + ceil(n/50) units.
 */
export async function fetchChannelUploadsAsSearchFormat(
  channelId: string,
  maxVideos: number = 500
): Promise<PlaylistItemSearchFormat[]> {
  const playlistId = await getChannelUploadsPlaylistId(channelId)
  if (!playlistId) return []
  return fetchPlaylistItemsAsSearchFormat(playlistId, maxVideos)
}

/**
 * Fetch video IDs from a channel (uses uploads playlist).
 * Cost: 1 + ceil(videoCount/50) units.
 */
export async function fetchVideoIdsFromChannel(
  channelId: string,
  maxVideos: number = 500
): Promise<PlaylistItemVideo[]> {
  const playlistId = await getChannelUploadsPlaylistId(channelId)
  if (!playlistId) {
    console.warn(`[Channel] No uploads playlist for channel ${channelId}`)
    return []
  }
  return fetchVideoIdsFromPlaylist(playlistId, maxVideos)
}
