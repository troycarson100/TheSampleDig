/**
 * One-off script: parses the crate digger list raw text and writes data/crate-digger-list.json.
 * Run: npx tsx scripts/parse-crate-digger-pdf.ts
 * Expects: data/crate-digger-list-raw.txt (one line per PDF line, no line numbers)
 */

import * as fs from "fs"
import * as path from "path"

const RAW_PATH = path.join(process.cwd(), "data", "crate-digger-list-raw.txt")
const OUT_PATH = path.join(process.cwd(), "data", "crate-digger-list.json")

export interface CrateDiggerEntry {
  artist: string
  album: string
  year?: number
  category?: string
}

const SKIP_PATTERNS = [
  /^Sample Roll$/,
  /^Ultimate Crate Digger/,
  /^700\+/,
  /^— \d+ of \d+ —$/,
  /^Compiled for Sample Roll/,
  /^SOUL & FUNK$/,
  /^JAZZ$/,
  /^LIBRARY & PRODUCTION MUSIC$/,
  /^BOSSA NOVA, LATIN & BRAZILIAN$/,
  /^AFRICAN, AFROBEAT & WORLD$/,
  /^REGGAE, DUB & SKA$/,
  /^PSYCHEDELIC, ROCK & BREAKS$/,
  /^PRIVATE PRESS & RARE GROOVE$/,
  /^ELECTRONIC, DISCO & EARLY HIP-HOP$/,
]

function shouldSkip(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  for (const re of SKIP_PATTERNS) if (re.test(t)) return true
  return false
}

/** Match "1. Artist — Album (1999)" or "1. Artist — Album" */
const ENTRY_RE = /^\d+\.\s+(.+?)\s+—\s+(.+)$/
const YEAR_RE = /\s*\((\d{4})\)\s*$/

function parse(rawText: string): CrateDiggerEntry[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim())
  const entries: CrateDiggerEntry[] = []
  let category: string | undefined

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (shouldSkip(line)) continue

    const match = line.match(ENTRY_RE)
    if (match) {
      const artist = match[1].trim().replace(/\s+/g, " ")
      let albumPart = match[2].trim().replace(/\s+/g, " ")
      const yearMatch = albumPart.match(YEAR_RE)
      const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined
      if (yearMatch) albumPart = albumPart.replace(YEAR_RE, "").trim()
      const album = albumPart.replace(/\s+R&B;\/?\s*/g, " R&B ").replace(/\s*R&B;\s*/g, " R&B ")
      entries.push({ artist, album, year, category })
      continue
    }

    if (line.includes(" · ")) {
      category = line.split(" · ")[0].trim()
    }
  }

  return entries
}

function main() {
  if (!fs.existsSync(RAW_PATH)) {
    console.error("Missing:", RAW_PATH)
    console.error("Create it with one line per PDF line (no line numbers).")
    process.exit(1)
  }
  const raw = fs.readFileSync(RAW_PATH, "utf8")
  const entries = parse(raw)
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2), "utf8")
  console.log("Wrote", entries.length, "entries to", OUT_PATH)
}

main()
