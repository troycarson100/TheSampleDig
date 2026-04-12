/**
 * One-off: read drum-breaks-500-spot-check.md table rows → drum-breaks-found-links.md
 * Run: npx tsx scripts/generate-drum-breaks-links-md.ts
 */

import { readFile, writeFile } from "fs/promises"
import path from "path"

const SRC = path.join(process.cwd(), "drum-breaks-500-spot-check.md")
const OUT = path.join(process.cwd(), "drum-breaks-found-links.md")

async function main() {
  const raw = await readFile(SRC, "utf-8")
  const lines = raw.split(/\r?\n/)

  const rows: { num: string; name: string; url: string }[] = []

  for (const line of lines) {
    const t = line.trim()
    if (!t.startsWith("|") || t.includes("---|") || /^#\s/.test(t)) continue
    if (!t.includes("youtube.com/watch")) continue
    if (t.includes(" — | — | — |")) continue

    const parts = t.split("|").map((s) => s.trim())
    if (parts.length < 4) continue
    const num = parts[1]
    if (!/^\d+$/.test(num)) continue
    const name = parts[2] || "(unknown)"
    const urlMatch = t.match(/https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/)
    if (!urlMatch) continue
    rows.push({ num, name, url: urlMatch[0] })
  }

  const header = `# Drum breaks — PDF listings with YouTube links found

Generated from \`drum-breaks-500-spot-check.md\` (${new Date().toISOString()}).

**${rows.length}** tracks with a resolved URL.

`

  const body = rows
    .map((r) => `${r.num}. **${r.name}**  \n   ${r.url}\n`)
    .join("\n")

  await writeFile(OUT, header + "\n" + body, "utf-8")
  console.log(`Wrote ${rows.length} rows to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
