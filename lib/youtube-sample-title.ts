import { titleLooksLikeYoutubePlayerChrome } from "./youtube-title-garbage"

/**
 * When the stored title is player chrome, fetch the real title from YouTube Data API (videos.list).
 * Uses dynamic import to avoid circular init with lib/youtube.ts ↔ lib/database-samples.ts.
 */
export async function fetchCanonicalYoutubeTitleIfGarbage(
  youtubeId: string,
  currentTitle: string
): Promise<string> {
  if (!titleLooksLikeYoutubePlayerChrome(currentTitle)) return currentTitle
  try {
    const { getVideoDetailsFullBatch } = await import("./youtube")
    const map = await getVideoDetailsFullBatch([youtubeId])
    const details = map.get(youtubeId)
    const next = details?.title?.trim()
    if (!next || titleLooksLikeYoutubePlayerChrome(next)) return currentTitle
    return next
  } catch (e) {
    console.warn("[youtube-sample-title] Could not resolve title for", youtubeId, (e as Error)?.message)
    return currentTitle
  }
}
