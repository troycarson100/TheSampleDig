/**
 * Parser for "500 Rare Vintage Soul Samples" PDF list.
 * Lines like: 1. William Bell – "You Don't Miss Your Water"
 */

export interface VintageSoulTrack {
  index: number
  artist: string
  title: string
}

/**
 * Lines like: 1. William Bell – "You Don't Miss Your Water"
 * Optional suffix after closing quote: (original), (with X), (Pt. 1), etc.
 */
const TRACK_LINE_RE =
  /^\s*(\d+)\.\s+(.+?)\s+[–-]\s+"(.+?)"(?:\s*(\([^)]*\)))?\s*$/

/**
 * Parse text extracted from 500_Rare_Vintage_Soul_Samples.pdf
 */
export function parseVintageSoulPdfText(raw: string): VintageSoulTrack[] {
  const tracks: VintageSoulTrack[] = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("--") || /^Sources span/i.test(trimmed)) continue
    const m = trimmed.match(TRACK_LINE_RE)
    if (!m) continue
    const idx = parseInt(m[1], 10)
    if (idx < 1 || idx > 500) continue
    const artist = m[2].trim().replace(/\s+/g, " ")
    let title = m[3].trim().replace(/\s+/g, " ")
    if (m[4]) title = `${title} ${m[4].trim()}`.replace(/\s+/g, " ").trim()
    tracks.push({ index: idx, artist, title })
  }
  tracks.sort((a, b) => a.index - b.index)
  return dedupeByIndex(tracks)
}

function dedupeByIndex(tracks: VintageSoulTrack[]): VintageSoulTrack[] {
  const map = new Map<number, VintageSoulTrack>()
  for (const t of tracks) map.set(t.index, t)
  return [...map.values()].sort((a, b) => a.index - b.index)
}
