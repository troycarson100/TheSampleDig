/**
 * Test BPM and key detection accuracy against known samples.
 *
 * Requires: yt-dlp, ffmpeg, Python 3 with librosa (pip install librosa numpy)
 *
 * 1. Edit scripts/test-samples-bpm-key.json and add entries with expectedBpm and expectedKey
 *    (use youtubeId for YouTube or audioPath for a local .wav file).
 * 2. Run: npx tsx scripts/test-bpm-key-accuracy.ts
 *
 * Output: per-sample results and summary (exact match %, octave-error %, key match %).
 */

import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import { analyzeYouTubeVideo, analyzeAudioFile } from "../lib/audio-analysis"

const RELATIVE_MINOR: Record<string, string> = {
  C: "Am", "C#": "A#m", D: "Bm", "D#": "Cm", E: "C#m", F: "Dm", "F#": "D#m",
  G: "Em", "G#": "Fm", A: "F#m", "A#": "Gm", B: "G#m",
}
const RELATIVE_MAJOR: Record<string, string> = Object.fromEntries(
  Object.entries(RELATIVE_MINOR).map(([maj, min]) => [min, maj])
)

function keyMatches(got: string | null, expected: string): boolean {
  if (!got || !expected) return got === expected
  const g = got.trim()
  const e = expected.trim()
  if (g === e) return true
  if (e.endsWith("m") && RELATIVE_MAJOR[e] === g) return true
  if (!e.endsWith("m") && RELATIVE_MINOR[e] === g) return true
  return false
}

function bpmOctaveMatch(got: number | null, expected: number): boolean {
  if (got == null || expected <= 0) return got === expected
  if (got === expected) return true
  if (got === expected * 2 || got === expected / 2) return true
  if (got === expected * 0.5 || got === expected * 4) return true
  return false
}

interface TestCase {
  youtubeId?: string
  audioPath?: string
  expectedBpm?: number
  expectedKey?: string
  note?: string
}

interface TestFile {
  description?: string
  samples: TestCase[]
}

async function main() {
  const configPath = resolve(process.cwd(), "scripts/test-samples-bpm-key.json")
  if (!existsSync(configPath)) {
    console.error("Missing scripts/test-samples-bpm-key.json")
    console.error("Create it with a 'samples' array of { youtubeId or audioPath, expectedBpm, expectedKey }.")
    process.exit(1)
  }

  const config: TestFile = JSON.parse(readFileSync(configPath, "utf-8"))
  const samples = config.samples?.filter(
    (s) => (s.youtubeId || s.audioPath) && (s.expectedBpm != null || s.expectedKey != null)
  )
  if (!samples?.length) {
    console.error("No valid samples in test-samples-bpm-key.json (need youtubeId or audioPath and expectedBpm/expectedKey).")
    process.exit(1)
  }

  console.log(`Running BPM/Key accuracy test on ${samples.length} sample(s)...\n`)

  let bpmExact = 0,
    bpmOctave = 0,
    bpmWrong = 0,
    bpmMissing = 0
  let keyExact = 0,
    keyWrong = 0,
    keyMissing = 0
  const hasBpm = (s: TestCase) => s.expectedBpm != null && s.expectedBpm > 0
  const hasKey = (s: TestCase) => s.expectedKey != null && s.expectedKey.trim() !== ""

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    const label = s.youtubeId ?? s.audioPath ?? `#${i + 1}`
    console.log(`[${i + 1}/${samples.length}] ${label}`)

    let result: { bpm: number | null; key: string | null }
    try {
      if (s.audioPath) {
        const path = resolve(process.cwd(), s.audioPath)
        if (!existsSync(path)) {
          console.log("  Skip: file not found")
          continue
        }
        result = await analyzeAudioFile(path)
      } else if (s.youtubeId) {
        result = await analyzeYouTubeVideo(s.youtubeId)
      } else {
        continue
      }
    } catch (e: unknown) {
      console.log("  Error:", (e as Error)?.message ?? e)
      continue
    }

    const { bpm, key } = result
    console.log(`  Got  BPM: ${bpm ?? "—"}, Key: ${key ?? "—"}`)
    console.log(`  Want BPM: ${s.expectedBpm ?? "—"}, Key: ${s.expectedKey ?? "—"}`)

    if (hasBpm(s)) {
      const exp = s.expectedBpm!
      if (bpm == null) bpmMissing++
      else if (bpm === exp) {
        bpmExact++
        console.log("  BPM: exact match")
      } else if (bpmOctaveMatch(bpm, exp)) {
        bpmOctave++
        console.log("  BPM: octave error (2x/0.5x)")
      } else {
        bpmWrong++
        console.log("  BPM: wrong")
      }
    }
    if (hasKey(s)) {
      const exp = s.expectedKey!.trim()
      if (!key || !key.trim()) keyMissing++
      else if (keyMatches(key, exp)) {
        keyExact++
        console.log("  Key: match")
      } else {
        keyWrong++
        console.log("  Key: wrong")
      }
    }
    console.log("")
  }

  const totalBpm = bpmExact + bpmOctave + bpmWrong + bpmMissing
  const totalKey = keyExact + keyWrong + keyMissing
  console.log("--- Summary ---")
  if (totalBpm > 0) {
    console.log(`BPM: ${bpmExact}/${totalBpm} exact, ${bpmOctave} octave errors, ${bpmWrong} wrong, ${bpmMissing} missing`)
    console.log(`     Exact: ${((bpmExact / totalBpm) * 100).toFixed(0)}%  |  Exact+octave: ${(((bpmExact + bpmOctave) / totalBpm) * 100).toFixed(0)}%`)
  }
  if (totalKey > 0) {
    console.log(`Key: ${keyExact}/${totalKey} match, ${keyWrong} wrong, ${keyMissing} missing`)
    console.log(`     Match: ${((keyExact / totalKey) * 100).toFixed(0)}%`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
