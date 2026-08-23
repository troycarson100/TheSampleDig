/**
 * Builds the drft A/B section's web assets from the 24-bit masters.
 *
 * Reads the OFF/ON pairs out of public/drft/ab/_src (gitignored - the masters
 * are ~33MB and must never reach the bundle), and writes two things:
 *
 *   public/drft/ab/<slug>-off.mp3   the clip a visitor actually streams
 *   public/drft/ab/<slug>-on.mp3
 *   app/drft/ab-peaks.json          precomputed waveforms + the manifest
 *
 * The peaks file is committed so the landing page draws both traces on first
 * paint without decoding a thing. This sits directly under the hero - it can't
 * afford to pull megabytes of audio just to show a waveform.
 *
 * Run with: npm run drft:ab-peaks
 */

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC_DIR = join(ROOT, "public/drft/ab/_src")
const OUT_DIR = join(ROOT, "public/drft/ab")
const PEAKS_OUT = join(ROOT, "app/drft/ab-peaks.json")

/** Horizontal resolution of the scope. 400 buckets is past the point where a
    ~900px-wide waveform shows any more detail, and keeps the JSON small. */
const BUCKETS = 400

/** Source stem -> slug + chip label. Files are "<stem> - DRFT OFF.wav" /
    "<stem> - DRFT ON.wav". Order here is the order of the chips on the page. */
const EXAMPLES = [
  { stem: "Track 2", slug: "full-mix", label: "FULL MIX" },
  { stem: "Guitar 01", slug: "guitar", label: "GUITAR" },
  { stem: "Keys 01", slug: "keys-01", label: "KEYS 01" },
  { stem: "Keys 02", slug: "keys-02", label: "KEYS 02" },
]

function probeDuration(file) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" }
  )
  return parseFloat(out.trim())
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
  // -q:a 2 is ~190kbps VBR. Deliberately not lower: drft's whole character is
  // noise, snow and dropouts, and a thrifty encoder smears exactly that.
  execFileSync(
    "ffmpeg",
    ["-v", "error", "-y", "-i", input, "-codec:a", "libmp3lame", "-q:a", "2", output],
    { stdio: "inherit" }
  )
}

function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`Missing ${SRC_DIR} - put the DRFT OFF/ON master WAVs there.`)
    process.exit(1)
  }
  mkdirSync(OUT_DIR, { recursive: true })

  const manifest = []

  for (const ex of EXAMPLES) {
    const offSrc = join(SRC_DIR, `${ex.stem} - DRFT OFF.wav`)
    const onSrc = join(SRC_DIR, `${ex.stem} - DRFT ON.wav`)
    for (const f of [offSrc, onSrc]) {
      if (!existsSync(f)) {
        console.error(`Missing source: ${f}`)
        process.exit(1)
      }
    }

    // A pair is only ever as long as its shorter half. Track 2's ON render is
    // ~149ms shorter than its OFF; clamping keeps the two players locked and
    // stops the scope from drawing past the end of one of them.
    const duration = Math.min(probeDuration(offSrc), probeDuration(onSrc))

    const offPcm = decodeMono(offSrc)
    const onPcm = decodeMono(onSrc)
    const offEnv = envelope(offPcm, 48000, duration)
    const onEnv = envelope(onPcm, 48000, duration)

    // Normalise the pair against a shared peak, never each file on its own -
    // if drft changes the level, that difference is part of what's being shown.
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
