/**
 * Detects YouTube *player UI* strings mistaken for video titles during scrape/ingest.
 * Example: "3:08 3:08 Now playing" (duplicate duration + screen-reader chrome).
 */
export function titleLooksLikeYoutubePlayerChrome(title: string | null | undefined): boolean {
  if (title == null || typeof title !== "string") return false
  const t = title.replace(/\u00a0/g, " ").replace(/\u2009/g, " ").trim()
  if (!t) return false
  if (!/\bnow playing\b/i.test(t)) return false
  // Two mm:ss tokens (current/total or duplicated) — real API titles almost never contain this phrase
  const timeTokens = t.match(/\d{1,3}:\d{2}/g)
  if (timeTokens && timeTokens.length >= 2) return true
  // "0:06 / 3:58" style sometimes scraped into one field
  if (/\d{1,3}:\d{2}\s*\/\s*\d{1,3}:\d{2}/.test(t)) return true
  // Legacy tight patterns
  if (/\b\d{1,3}:\d{2}\s+\d{1,3}:\d{2}\b/.test(t)) return true
  if (/^\s*\d{1,3}:\d{2}\s+\d{1,3}:\d{2}\s+now playing\s*$/i.test(t)) return true
  return false
}
