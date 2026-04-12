/**
 * Detects YouTube *player UI* strings mistaken for video titles during scrape/ingest.
 * Example: "3:08 3:08 Now playing" (duplicate duration + screen-reader chrome).
 */
export function titleLooksLikeYoutubePlayerChrome(title: string | null | undefined): boolean {
  if (title == null || typeof title !== "string") return false
  const t = title.trim()
  if (!t) return false
  // Two mm:ss groups in a row + "now playing" is never a real song title from the API
  if (/\b\d{1,3}:\d{2}\s+\d{1,3}:\d{2}\b/.test(t) && /\bnow playing\b/i.test(t)) return true
  // Strict: entire string is only times + now playing
  if (/^\s*\d{1,3}:\d{2}\s+\d{1,3}:\d{2}\s+now playing\s*$/i.test(t)) return true
  return false
}
