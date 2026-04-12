/**
 * Parser for "500 Rare Drum Breaks"–style PDF text: index, artist, title, break start (seconds).
 * PDF layout may vary — run populate with --parse-only and adjust regexes if counts are wrong.
 */

export interface DrumBreakTrack {
  index: number
  artist: string
  title: string
  /** Seconds from start of track to the drum break */
  breakStartSec: number
}

/** Parse "2:34", "02:34", "1:02:34" → seconds */
export function parseTimeToSeconds(raw: string): number | null {
  const t = raw.trim()
  const parts = t.split(":").map((p) => p.trim())
  if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null
  const nums = parts.map((p) => parseInt(p, 10))
  if (nums.some((n) => Number.isNaN(n))) return null
  if (nums.length === 2) return nums[0] * 60 + nums[1]
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2]
  if (nums.length === 1) return nums[0]
  return null
}

/** `1. Artist – "Title" 2:34` — time required after title (optional paren suffix before time). */
const LINE_QUOTED_TIME_END =
  /^\s*(\d+)\.\s+(.+?)\s+[–-]\s+"(.+?)"(?:\s*(\([^)]*\)))?\s+(\d+:\d+(?::\d+)?)\s*$/i

/** Same line shape as vintage soul with optional dash and time at end. */
const LINE_SOUL_LIKE =
  /^\s*(\d+)\.\s+(.+?)\s+[–-]\s+"(.+?)"(?:\s*(\([^)]*\)))?\s*(?:[–—\-]\s*)?(?:(\d+:\d+(?::\d+)?)|(?:break\s*)?@?\s*(\d+:\d+(?::\d+)?))?\s*$/i

/** `1. Artist – Title 2:34` (no quotes) */
const LINE_UNQUOTED =
  /^\s*(\d+)\.\s+(.+?)\s+[–-]\s+(.+?)\s+(?:(\d+:\d+(?::\d+)?))\s*$/

/** "500 Rare Drum Breaks" PDF: `1 The Winstons Amen, Brother 1:26` (index, artist+song, mm:ss at end). */
const CRATE_LINE =
  /^\s*(\d+)\s+(.+)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$/

function lineLooksLikeHeaderOrSection(s: string): boolean {
  const t = s.trim()
  if (!t) return true
  if (/^#/.test(t)) return true
  if (/^--\s/.test(t)) return true
  if (/^\d+\s+RARE\s+DRUM/i.test(t)) return true
  if (/^Timestamps\s+mark/i.test(t)) return true
  if (/^For\s+educational/i.test(t)) return true
  if (/^\([0-9]+[–-][0-9]+\)/.test(t)) return true
  if (/^[A-Z][A-Z &/+\-]+ \([0-9]+[–-]/.test(t)) return true
  return false
}

/**
 * Parse extracted PDF text into tracks. Tries multiple line patterns.
 */
export function parseDrumBreaksPdfText(raw: string): DrumBreakTrack[] {
  const tracks: DrumBreakTrack[] = []
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("--") || /^page\s+\d+/i.test(trimmed)) continue
    if (lineLooksLikeHeaderOrSection(trimmed)) continue

    const crate = trimmed.match(CRATE_LINE)
    if (crate) {
      const idx = parseInt(crate[1], 10)
      if (idx >= 1 && idx <= 9999) {
        const query = crate[2].trim().replace(/\s+/g, " ")
        const sec = parseTimeToSeconds(crate[3])
        if (sec != null && query.length > 0) {
          tracks.push({ index: idx, artist: query, title: "", breakStartSec: sec })
          continue
        }
      }
    }

    let m = trimmed.match(LINE_QUOTED_TIME_END)
    if (m) {
      const idx = parseInt(m[1], 10)
      if (idx >= 1 && idx <= 9999) {
        const artist = m[2].trim().replace(/\s+/g, " ")
        let title = m[3].trim().replace(/\s+/g, " ")
        if (m[4]) title = `${title} ${m[4].trim()}`.replace(/\s+/g, " ").trim()
        const sec = parseTimeToSeconds(m[5])
        if (sec != null) {
          tracks.push({ index: idx, artist, title, breakStartSec: sec })
          continue
        }
      }
    }

    m = trimmed.match(LINE_SOUL_LIKE)
    if (m) {
      const idx = parseInt(m[1], 10)
      if (idx < 1 || idx > 9999) continue
      const artist = m[2].trim().replace(/\s+/g, " ")
      let title = m[3].trim().replace(/\s+/g, " ")
      if (m[4]) title = `${title} ${m[4].trim()}`.replace(/\s+/g, " ").trim()
      const timeStr = m[5] || m[6]
      const sec = timeStr ? parseTimeToSeconds(timeStr) : null
      if (sec == null) continue
      tracks.push({ index: idx, artist, title, breakStartSec: sec })
      continue
    }

    m = trimmed.match(LINE_UNQUOTED)
    if (m) {
      const idx = parseInt(m[1], 10)
      if (idx < 1 || idx > 9999) continue
      const artist = m[2].trim().replace(/\s+/g, " ")
      const title = m[3].trim().replace(/\s+/g, " ")
      const sec = parseTimeToSeconds(m[4])
      if (sec == null) continue
      tracks.push({ index: idx, artist, title, breakStartSec: sec })
    }
  }

  tracks.sort((a, b) => a.index - b.index)
  const byIndex = new Map<number, DrumBreakTrack>()
  for (const t of tracks) byIndex.set(t.index, t)
  return [...byIndex.values()].sort((a, b) => a.index - b.index)
}
