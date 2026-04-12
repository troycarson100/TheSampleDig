import { titleLooksLikeYoutubePlayerChrome } from "./youtube-title-garbage"

/** Public oEmbed — no API key; works when Data API keys are unset on the server. */
async function fetchYoutubeTitleViaOEmbed(youtubeId: string): Promise<string | null> {
  const watch = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`
  try {
    const res = await fetch(oembed, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { title?: string }
    const next = data.title?.trim()
    if (!next || titleLooksLikeYoutubePlayerChrome(next)) return null
    return next
  } catch {
    return null
  }
}

/**
 * When the stored title is player chrome, fetch the real title: Data API first, then oEmbed fallback.
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
    const fromApi = details?.title?.trim()
    if (fromApi && !titleLooksLikeYoutubePlayerChrome(fromApi)) return fromApi
  } catch (e) {
    console.warn("[youtube-sample-title] Data API title fetch failed for", youtubeId, (e as Error)?.message)
  }

  const fromOembed = await fetchYoutubeTitleViaOEmbed(youtubeId)
  if (fromOembed) return fromOembed

  return currentTitle
}
