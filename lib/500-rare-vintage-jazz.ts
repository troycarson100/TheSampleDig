/**
 * Parser for "500 Rare Vintage Jazz Tracks" PDF text.
 * Format: "N. Artist – "Track"" or "N. Artist – "Track" (optional suffix)"
 * Returns { artist, track, searchQuery } for each line.
 */

/** Match "1. Artist – "Track"" or "1. Artist – "Track" (alternate take)" */
const TRACK_LINE_RE = /^\s*\d+\.\s*(.+?)\s*[–\-]\s*"([^"]+)"\s*(?:\(.*)?$/

export interface JazzTrack {
  artist: string
  track: string
  searchQuery: string
}

/**
 * Parse raw PDF/text lines into jazz track entries.
 * Skips headers, section titles, and non-track lines.
 */
export function parse500JazzLines(rawText: string): JazzTrack[] {
  const lines = rawText.split(/\r?\n/)
  const out: JazzTrack[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(TRACK_LINE_RE)
    if (match) {
      const artist = match[1].trim().replace(/\s+/g, " ")
      const track = match[2].trim()
      const searchQuery = `${artist} ${track}`.replace(/\s+/g, " ")
      out.push({ artist, track, searchQuery })
    }
  }
  return out
}
