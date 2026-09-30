/**
 * Builds fltr's before-and-after player's web assets from the WAV masters -
 * the same job scripts/build-drft-ab-peaks.mjs does for drft, for the same
 * player (components/plugin-page/AbCompare.tsx).
 *
 * Reads the Dry/Wet pairs out of public/fltr/ab/_src (gitignored - masters
 * never reach the bundle), and writes:
 *
 *   public/fltr/ab/<slug>-off.mp3   the clip a visitor actually streams
 *   public/fltr/ab/<slug>-on.mp3
 *   app/fltr/ab-peaks.json          precomputed waveforms + the manifest
 *
 * The peaks file is committed so the landing page draws both traces on first
 * paint without decoding a thing. This sits directly under the hero - it can't
 * afford to pull megabytes of audio just to show a waveform.
 *
 * Run with: npm run fltr:ab-peaks
 */

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC_DIR = join(ROOT, "public/fltr/ab/_src")
const OUT_DIR = join(ROOT, "public/fltr/ab")
const PEAKS_OUT = join(ROOT, "app/fltr/ab-peaks.json")

/** Horizontal resolution of the scope. 400 buckets is past the point where a
    ~900px-wide waveform shows any more detail, and keeps the JSON small. */
const BUCKETS = 400

/** Source stem -> slug + chip label. Order here is the order of the chips on
    the page. See resolvePair for how the stem maps onto filenames. */
const EXAMPLES = [
  // Ableton consolidates as "Drums 1 Dry [2026-09-30 102941].wav": the stem,
  // then Dry or Wet. Dry is the plugin off, Wet is fltr on.
  { stem: "Drums 1", slug: "drums-01", label: "DRUMS 01" },
  { stem: "Drums 2", slug: "drums-02", label: "DRUMS 02" },
  // One of each of these, so no number: a lone "01" implies a sibling that
  // isn't there. The case of Dry/Wet in the filename varies; matching ignores it.
  { stem: "Bass 1", slug: "bass", label: "BASS" },
  { stem: "Piano 1", slug: "piano", label: "PIANO" },
  { stem: "Vocal 1", slug: "vocal", label: "VOCAL" },
  // Held back for now (2026-09-30); its WAVs stay in _src, so putting this
  // line back and rebuilding is all it takes.
  // { stem: "Granular 1", slug: "granular", label: "GRANULAR" },
]

/** Finds a pair's two source files: any .wav starting with the stem, then
    split by an OFF/ON word appearing anywhere in the name.

    Deliberately loose, because every batch so far has invented its own
    convention - "Keys 01 - DRFT OFF.wav", "Full Mix 01 - EFFECT OFF.wav",
    "Bounce EFFECT OFF [2026-08-20 221508]-1.wav". Matching on word boundaries
    survives all three and whatever comes next; renaming exports by hand does
    not. Anything ambiguous fails loudly rather than building the wrong clip. */
function resolvePair(stem) {
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const stemRe = new RegExp(`^${escaped}\\b`, "i")
  const candidates = readdirSync(SRC_DIR).filter((f) => /\.wav$/i.test(f) && stemRe.test(f))

  const find = (side) => {
    // \bON\b cannot match the word "OFF", but exclude it explicitly anyway so
    // a name carrying both markers can never be silently misfiled.
    const word = side === "OFF" ? "Dry" : "Wet"
    const hits = candidates.filter((f) =>
      new RegExp(`\\b${word}\\b`, "i").test(f) && !new RegExp(`\\b${side === "OFF" ? "Wet" : "Dry"}\\b`, "i").test(f)
    )
    if (hits.length !== 1) {
      console.error(
        hits.length
          ? `Ambiguous ${side} file for "${stem}":\n  ${hits.join("\n  ")}`
          : `No ${side} file for "${stem}" in ${SRC_DIR}`
      )
      process.exit(1)
    }
    return join(SRC_DIR, hits[0])
  }
  return { off: find("OFF"), on: find("ON") }
}

function probeDuration(file) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" }
  )
  return parseFloat(out.trim())
}

function probeRate(file) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" }
  )
  return parseInt(out.trim(), 10)
}

/** Decodes to mono 16-bit PCM and returns the raw samples. Mono because the
    scope draws one trace per file - the stereo image isn't what's being shown. */
function decodeMono(file) {
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-ac", "1", "-f", "s16le", "-acodec", "pcm_s16le", "-"],
    { encoding: "buffer", maxBuffer: 1024 * 1024 * 512 }
  )
  return new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2))
}

/** Peak envelope over `seconds` worth of samples, split into BUCKETS columns.
    Both files in a pair are bucketed over the SAME span so the ghost trace and
    the lit trace line up on the x-axis. */
function envelope(samples, sampleRate, seconds) {
  const span = Math.min(samples.length, Math.floor(sampleRate * seconds))
  const per = span / BUCKETS
  const out = new Array(BUCKETS)
  for (let i = 0; i < BUCKETS; i++) {
    const start = Math.floor(i * per)
    const end = Math.min(span, Math.floor((i + 1) * per))
    let peak = 0
    for (let j = start; j < end; j++) {
      const v = Math.abs(samples[j])
      if (v > peak) peak = v
    }
    out[i] = peak
  }
  return out
}

function encodeMp3(input, output) {
  // -q:a 2 is ~190kbps VBR, the same as drft's: drum transients through a
  // resonant filter are exactly what a thrifty encoder smears.
  execFileSync(
    "ffmpeg",
    ["-v", "error", "-y", "-i", input, "-codec:a", "libmp3lame", "-q:a", "2", output],
    { stdio: "inherit" }
  )
}

function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`Missing ${SRC_DIR} - put the fltr Dry/Wet master WAVs there.`)
    process.exit(1)
  }
  mkdirSync(OUT_DIR, { recursive: true })

  const manifest = []

  for (const ex of EXAMPLES) {
    const { off: offSrc, on: onSrc } = resolvePair(ex.stem)

    // A pair is only ever as long as its shorter half. Every pair currently in
    // the folder matches its partner exactly, so this clamp is defensive - but
    // an engaged render can easily ring out past its bypassed twin, because
    // drift smear keeps decaying after the last hit. Two earlier pairs ran
    // 149ms and 922ms long that way. Without the clamp the two players wrap at
    // different moments and walk apart; with it, the tail gets cut instead.
    const duration = Math.min(probeDuration(offSrc), probeDuration(onSrc))

    const offPcm = decodeMono(offSrc)
    const onPcm = decodeMono(onSrc)
    // Bucketed at each file's own rate: not every export is 48k.
    const offEnv = envelope(offPcm, probeRate(offSrc), duration)
    const onEnv = envelope(onPcm, probeRate(onSrc), duration)

    // Normalise the pair against a shared peak, never each file on its own -
    // if fltr changes the level, that difference is part of what's being shown.
    const ceiling = Math.max(1, ...offEnv, ...onEnv)
    const toBytes = (env) => env.map((v) => Math.round((v / ceiling) * 255))

    encodeMp3(offSrc, join(OUT_DIR, `${ex.slug}-off.mp3`))
    encodeMp3(onSrc, join(OUT_DIR, `${ex.slug}-on.mp3`))

    manifest.push({
      slug: ex.slug,
      label: ex.label,
      duration: Number(duration.toFixed(3)),
      peaks: { off: toBytes(offEnv), on: toBytes(onEnv) },
    })

    console.log(`${ex.label.padEnd(9)} ${duration.toFixed(2)}s  ->  ${ex.slug}-{off,on}.mp3`)
  }

  writeFileSync(PEAKS_OUT, JSON.stringify({ buckets: BUCKETS, examples: manifest }))
  console.log(`\nWrote ${PEAKS_OUT}`)
}

main()
