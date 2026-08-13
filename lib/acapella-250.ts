export interface AcapellaTrack {
  index: number
  searchQuery: string
  year?: number
}

function isLikelyHeader(line: string): boolean {
  if (!line) return true
  if (line.startsWith("--")) return true
  if (/^#\s*ARTIST\s+TITLE\s+YR/i.test(line)) return true
  if (/^250 RARE SOUL/i.test(line)) return true
  if (/^WITH A CAPPELLA POTENTIAL/i.test(line)) return true
  if (/^SampleRoll Reference/i.test(line)) return true
  if (/^Each song is selected/i.test(line)) return true
  if (/^Artists capped/i.test(line)) return true
  if (/^Total:\s*250 songs/i.test(line)) return true
  return false
}

function parseSplitYear(lines: string[], i: number): { year?: number; nextIndex: number } {
  const line = lines[i] ?? ""
  if (/^\d{4}$/.test(line)) {
    return { year: Number.parseInt(line, 10), nextIndex: i + 1 }
  }
  if (/^\d{3}$/.test(line) && /^\d$/.test(lines[i + 1] ?? "")) {
    return { year: Number.parseInt(`${line}${lines[i + 1]}`, 10), nextIndex: i + 2 }
  }
  if (/^\d{2}$/.test(line) && /^\d{2}$/.test(lines[i + 1] ?? "")) {
    return { year: Number.parseInt(`${line}${lines[i + 1]}`, 10), nextIndex: i + 2 }
  }
  return { nextIndex: i }
}

export function parseAcapella250PdfText(raw: string): AcapellaTrack[] {
  const baseLines = raw
    .split(/\r?\n/)
    .map((v) => v.trim().replace(/\s+/g, " "))
    .filter((v) => !isLikelyHeader(v))

  // Merge split 3-digit indices used in the PDF (e.g. "10" + "0" + "Carla Thomas ...").
  const lines: string[] = []
  for (let i = 0; i < baseLines.length; i++) {
    const a = baseLines[i]
    const b = baseLines[i + 1] ?? ""
    const c = baseLines[i + 2] ?? ""
    if (/^\d{1,2}$/.test(a) && /^\d$/.test(b) && c.length > 0 && !/^\d+$/.test(c)) {
      lines.push(`${a}${b} ${c}`.replace(/\s+/g, " ").trim())
      i += 2
      continue
    }
    lines.push(a)
  }

  const tracks: AcapellaTrack[] = []
  const starts: Array<{ pos: number; index: number; rest: string }> = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d{1,3})\s+(.+)$/)
    if (!m) continue
    const index = Number.parseInt(m[1], 10)
    if (index < 1 || index > 250) continue
    starts.push({ pos: i, index, rest: m[2] })
  }

  for (let s = 0; s < starts.length; s++) {
    const cur = starts[s]
    const end = s + 1 < starts.length ? starts[s + 1].pos : lines.length
    let year: number | undefined
    const parts: string[] = []
    let contentStart = cur.pos + 1

    let rest = cur.rest
    const inline4 = rest.match(/^(.*)\b((?:19|20)\d{2})$/)
    if (inline4) {
      rest = inline4[1].trim()
      year = Number.parseInt(inline4[2], 10)
    } else {
      const inline3 = rest.match(/^(.*)\b((?:19|20)\d)$/)
      if (inline3 && /^\d$/.test(lines[cur.pos + 1] ?? "")) {
        rest = inline3[1].trim()
        year = Number.parseInt(`${inline3[2]}${lines[cur.pos + 1]}`, 10)
        contentStart = cur.pos + 2
      }
    }
    if (rest.length > 0) parts.push(rest)

    if (year == null) {
      for (let i = contentStart; i < end; i++) {
        const split = parseSplitYear(lines, i)
        if (split.year && split.year >= 1900 && split.year <= 2026) {
          year = split.year
          break
        }
        const line = lines[i]
        if (/^\d{1,3}$/.test(line)) continue
        parts.push(line)
        if (parts.length >= 3 && year == null) {
          // Heuristic: title should be short; avoid pulling note paragraphs.
          break
        }
      }
    }

    let query = parts.join(" ").replace(/\s+/g, " ").trim()
    // Remove note-like tails if they leaked into the query.
    query = query.split(" — ")[0].split(";")[0].trim()
    if (query.length > 120) query = query.slice(0, 120).trim()
    if (!query) continue
    tracks.push({ index: cur.index, searchQuery: query, year })
  }

  const byIndex = new Map<number, AcapellaTrack>()
  for (const t of tracks) {
    if (!byIndex.has(t.index)) byIndex.set(t.index, t)
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index)
}
