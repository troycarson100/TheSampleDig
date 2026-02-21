/**
 * Audio Analysis Service
 * Downloads YouTube audio and analyzes BPM and key
 */

import { spawn } from 'child_process'
import { createWriteStream, existsSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { pipeline } from 'stream/promises'

const TEMP_DIR = join(process.cwd(), 'tmp')
/** Persistent cache so we never have to re-download the same YouTube audio for BPM/key. */
const AUDIO_CACHE_DIR = join(TEMP_DIR, 'audio-cache')
const MAX_AUDIO_DURATION = 60 // Analyze first 60 seconds for speed

/**
 * Path where a cached snippet for a YouTube ID would be stored.
 * Does not check existence.
 */
export function getCachedAudioPath(youtubeId: string): string {
  return join(AUDIO_CACHE_DIR, `${youtubeId}.wav`)
}

/**
 * Returns the path to cached audio for this YouTube ID if the file exists; otherwise null.
 * Use this to re-analyze BPM/key without re-downloading.
 */
export function findCachedAudio(youtubeId: string): string | null {
  const path = getCachedAudioPath(youtubeId)
  return existsSync(path) ? path : null
}

export interface AnalysisResult {
  bpm: number | null
  key: string | null
}

/**
 * Download audio from YouTube using yt-dlp
 * Returns path to downloaded audio file
 */
async function downloadYouTubeAudio(
  youtubeId: string,
  outputPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use yt-dlp to download audio (best audio quality, first 60 seconds)
    // yt-dlp will add .wav extension automatically
    const outputTemplate = outputPath.replace('.wav', '.%(ext)s')
    
    const ytdlp = spawn('yt-dlp', [
      `https://www.youtube.com/watch?v=${youtubeId}`,
      '--extract-audio',
      '--audio-format', 'wav',
      '--audio-quality', '0',
      '--postprocessor-args', `ffmpeg:-ss 0 -t ${MAX_AUDIO_DURATION}`, // Limit to 60 seconds from start
      '-o', outputTemplate,
      '--no-playlist',
      '--quiet',
      '--no-warnings'
    ])

    let errorOutput = ''
    let stdoutOutput = ''

    ytdlp.stdout.on('data', (data) => {
      stdoutOutput += data.toString()
    })

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    ytdlp.on('close', (code) => {
      // yt-dlp creates file with .wav extension
      const actualPath = outputPath
      if (code === 0 && existsSync(actualPath)) {
        resolve(actualPath)
      } else {
        // Try without extension in case yt-dlp added it differently
        const altPath = outputPath.replace('.wav', '') + '.wav'
        if (existsSync(altPath)) {
          resolve(altPath)
        } else {
          reject(new Error(`yt-dlp failed (code ${code}): ${errorOutput || stdoutOutput || 'Unknown error'}`))
        }
      }
    })

    ytdlp.on('error', (error) => {
      reject(new Error(`Failed to spawn yt-dlp: ${error.message}. Make sure yt-dlp is installed.`))
    })
  })
}

/** Preferred BPM range for sample material (avoids 2x / 0.5x octave errors). */
const BPM_MIN = 55
const BPM_MAX = 175
/** Sweet spot for sample material; when multiple candidates in range, prefer closest to this (reduces double-speed). */
const BPM_PREFERRED_CENTER = 92

/**
 * Analyze audio file for BPM using librosa with tempo folding to fix 2x/half-time errors.
 * Always considers halved/doubled candidates even when raw is in-range, then picks the one
 * closest to BPM_PREFERRED_CENTER to avoid double-speed (e.g. 140 -> 70).
 */
async function detectBPM(audioPath: string): Promise<number | null> {
  try {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [
        '-c',
        `
import librosa
import sys
import json
import numpy as np

BPM_MIN = ${BPM_MIN}
BPM_MAX = ${BPM_MAX}
BPM_PREFERRED = ${BPM_PREFERRED_CENTER}

def fold_tempo_to_range(tempo):
    """Build all 2x/0.5x candidates, keep in-range, prefer closest to BPM_PREFERRED (fixes double-speed)."""
    if tempo is None or tempo <= 0:
        return None
    candidates = [tempo]
    if tempo > BPM_MIN:
        candidates.append(tempo / 2)
        if tempo > BPM_MIN * 2:
            candidates.append(tempo / 4)
    if tempo < BPM_MAX:
        candidates.append(tempo * 2)
        if tempo < BPM_MAX / 2:
            candidates.append(tempo * 4)
    in_range = [c for c in candidates if BPM_MIN <= c <= BPM_MAX]
    if not in_range:
        mid = (BPM_MIN + BPM_MAX) / 2
        best = min(candidates, key=lambda c: abs(c - mid))
        return round(best)
    # Prefer candidate closest to sweet spot (reduces double-speed: 140 and 70 -> prefer 70)
    best = min(in_range, key=lambda c: abs(c - BPM_PREFERRED))
    return round(best)

try:
    y, sr = librosa.load(sys.argv[1], duration=45)
    try:
        y_harm, y_perc = librosa.effects.harmonic_percussive_separate(y, margin=2.0)
    except AttributeError:
        y_harm, y_perc = y, y
    if np.sqrt(np.mean(y_perc ** 2)) < 0.01:
        y_use = y
    else:
        y_use = y_perc
    tempo, _ = librosa.beat.beat_track(y=y_use, sr=sr, start_bpm=120.0)
    raw_bpm = float(np.atleast_1d(tempo).flat[0])
    bpm = fold_tempo_to_range(raw_bpm)
    print(json.dumps({"bpm": bpm}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
        `,
        audioPath
      ])

      let output = ''
      let errorOutput = ''

      python.stdout.on('data', (data) => {
        output += data.toString()
      })

      python.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim())
            if (result.error) {
              console.error('BPM detection error:', result.error)
              resolve(null)
            } else {
              resolve(result.bpm)
            }
          } catch (e) {
            console.error('Failed to parse BPM result:', e)
            resolve(null)
          }
        } else {
          // Script may print {"error": "..."} to stdout before exit(1)
          try {
            const result = JSON.parse(output.trim())
            if (result.error) console.error('BPM detection error:', result.error)
          } catch {
            if (errorOutput) console.error('Python BPM stderr:', errorOutput)
          }
          resolve(null)
        }
      })

      python.on('error', (error) => {
        // Python not available or librosa not installed - return null
        console.warn('Python/librosa not available for BPM detection:', error.message)
        resolve(null)
      })
    })
  } catch (error) {
    console.error('BPM detection error:', error)
    return null
  }
}

/**
 * Detect musical key using CQT chroma (more accurate pitch), smoothing, and multi-segment voting.
 */
async function detectKey(audioPath: string): Promise<string | null> {
  try {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [
        '-c',
        `
import librosa
import sys
import json
import numpy as np
from collections import Counter

# Krumhansl-Schmuckler profiles
major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
# Small bias for very common keys when scores are close (soul/funk/sample material)
common_key_bias = {'C': 0.03, 'Cm': 0.03, 'G': 0.02, 'Gm': 0.02, 'Am': 0.03, 'F': 0.02, 'Dm': 0.02, 'Em': 0.02}

def chroma_to_key(chroma_mean):
    best_key, best_score = None, -np.inf
    for i in range(12):
        major_score = np.dot(chroma_mean, np.roll(major_profile, i))
        key_name = keys[i]
        if key_name in common_key_bias:
            major_score += common_key_bias[key_name]
        if major_score > best_score:
            best_score, best_key = major_score, key_name
        minor_score = np.dot(chroma_mean, np.roll(minor_profile, i))
        key_name_m = keys[i] + 'm'
        if key_name_m in common_key_bias:
            minor_score += common_key_bias[key_name_m]
        if minor_score > best_score:
            best_score, best_key = minor_score, key_name_m
    return best_key

try:
    y, sr = librosa.load(sys.argv[1], duration=45)
    try:
        y_harm, y_perc = librosa.effects.harmonic_percussive_separate(y, margin=2.0)
    except AttributeError:
        y_harm = y
    segment_frames = 15 * sr
    segment_keys = []
    n_frames = min(len(y_harm), 45 * sr)
    for start in range(0, n_frames - segment_frames, int(segment_frames)):
        seg = y_harm[start:start + segment_frames]
        # CQT chroma: better pitch resolution than STFT
        chroma = librosa.feature.chroma_cqt(y=seg, sr=sr, hop_length=2048)
        # Smooth: median over time (reduces noise, stabilizes key)
        chroma_smooth = np.median(chroma, axis=1)
        chroma_smooth = chroma_smooth / (np.linalg.norm(chroma_smooth) + 1e-8)
        segment_keys.append(chroma_to_key(chroma_smooth))
    if not segment_keys:
        chroma = librosa.feature.chroma_cqt(y=y_harm, sr=sr, hop_length=2048)
        chroma_smooth = np.median(chroma, axis=1)
        chroma_smooth = chroma_smooth / (np.linalg.norm(chroma_smooth) + 1e-8)
        best_key = chroma_to_key(chroma_smooth)
    else:
        best_key = Counter(segment_keys).most_common(1)[0][0]
    print(json.dumps({"key": best_key}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
        `,
        audioPath
      ])

      let output = ''
      let errorOutput = ''

      python.stdout.on('data', (data) => {
        output += data.toString()
      })

      python.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim())
            if (result.error) {
              console.error('Key detection error:', result.error)
              resolve(null)
            } else {
              resolve(result.key)
            }
          } catch (e) {
            console.error('Failed to parse key result:', e)
            resolve(null)
          }
        } else {
          // Python writes exceptions to stdout as {"error": "..."}; stderr is often empty
          let msg = errorOutput.trim()
          if (!msg && output.trim()) {
            try {
              const parsed = JSON.parse(output.trim()) as { error?: string }
              if (parsed.error) msg = parsed.error
            } catch {
              msg = output.trim().slice(0, 200)
            }
          }
          console.error('Python key detection failed:', msg || `exit code ${code}`)
          resolve(null)
        }
      })

      python.on('error', (error) => {
        console.warn('Python/librosa not available for key detection:', error.message)
        resolve(null)
      })
    })
  } catch (error) {
    console.error('Key detection error:', error)
    return null
  }
}

/**
 * Analyze an existing audio file for BPM and key.
 * Does not delete the file. Requires Python with librosa: pip install librosa numpy
 */
export async function analyzeAudioFile(
  audioPath: string
): Promise<AnalysisResult> {
  const analysisPromise = Promise.all([
    detectBPM(audioPath),
    detectKey(audioPath)
  ])
  const timeout = new Promise<[null, null]>((resolve) => {
    setTimeout(() => resolve([null, null]), 15000)
  })
  const [bpm, key] = await Promise.race([analysisPromise, timeout])
  return { bpm, key }
}

/**
 * Re-analyze BPM/key from cached audio only. No download.
 * Returns null if no cached file exists for this youtubeId.
 */
export async function reAnalyzeFromCache(youtubeId: string): Promise<AnalysisResult | null> {
  const path = findCachedAudio(youtubeId)
  if (!path) return null
  const result = await analyzeAudioFile(path)
  return result
}

/**
 * Main analysis function.
 * Uses persistent cache: if audio already exists at cache path, skips download.
 * Never deletes the cached file so we never have to re-download for the same video.
 */
export async function analyzeYouTubeVideo(
  youtubeId: string
): Promise<AnalysisResult> {
  const audioPath = getCachedAudioPath(youtubeId)

  try {
    console.log(`[Analysis] Starting for ${youtubeId}`)

    const { mkdir } = await import('fs/promises')
    await mkdir(AUDIO_CACHE_DIR, { recursive: true })

    if (!existsSync(audioPath)) {
      console.log(`[Analysis] Downloading audio for ${youtubeId}...`)
      const downloadPromise = downloadYouTubeAudio(youtubeId, audioPath)
      const downloadTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.warn(`[Analysis] Download timeout after 15 seconds for ${youtubeId}`)
          reject(new Error('Download timeout after 15 seconds'))
        }, 15000)
      })
      try {
        await Promise.race([downloadPromise, downloadTimeout])
        console.log(`[Analysis] Audio downloaded: ${audioPath}`)
      } catch (downloadError: any) {
        console.error(`[Analysis] Download failed for ${youtubeId}:`, downloadError?.message)
        return { bpm: null, key: null }
      }
    } else {
      console.log(`[Analysis] Using cached audio: ${audioPath}`)
    }

    console.log(`[Analysis] Starting BPM and key detection...`)
    const analysisPromise = Promise.all([
      detectBPM(audioPath),
      detectKey(audioPath)
    ])
    const analysisTimeout = new Promise<[null, null]>((resolve) => {
      setTimeout(() => {
        console.warn(`[Analysis] Analysis timeout after 10 seconds for ${youtubeId}`)
        resolve([null, null])
      }, 10000)
    })

    const [bpm, key] = await Promise.race([analysisPromise, analysisTimeout])
    console.log(`[Analysis] Complete - BPM: ${bpm}, Key: ${key}`)

    return { bpm, key }
  } catch (error: any) {
    console.error(`[Analysis] Error for ${youtubeId}:`, error?.message || error)
    return { bpm: null, key: null }
  }
}
