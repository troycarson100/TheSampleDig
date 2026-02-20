/**
 * Parser for "300 Rare Japanese Tracks" PDF text.
 * Format: "N Artist Track Year" per line. Returns search queries "Artist Track".
 */

const TRACK_LINE_RE = /^\s*\d+\s+(.+)\s+\d{4}\s*$/

/**
 * Parse raw PDF/text lines into YouTube search queries (Artist + Track).
 * Skips headers, section titles, and page markers.
 */
export function parseTrackLines(rawText: string): string[] {
  const lines = rawText.split(/\r?\n/)
  const queries: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(TRACK_LINE_RE)
    if (match) {
      queries.push(match[1].trim().replace(/\s+/g, " "))
    }
  }
  return queries
}
