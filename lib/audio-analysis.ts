/**
 * Audio Analysis Service
 * Downloads YouTube audio and analyzes BPM and key
 */

import { spawn } from 'child_process'
import { createWriteStream, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { pipeline } from 'stream/promises'

const TEMP_DIR = join(process.cwd(), 'tmp')
const MAX_AUDIO_DURATION = 60 // Analyze first 60 seconds for speed

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

/**
 * Analyze audio file for BPM using librosa with tempo folding to fix 2x/half-time errors.
 * Uses harmonic-percussive separation and runs tempo on the percussive component for more stable BPM on drum-heavy material.
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

def fold_tempo_to_range(tempo):
    """Correct 2x (double-time) and 0.5x (half-time) octave errors. Prefer 55-175 BPM."""
    if tempo is None or tempo <= 0:
        return None
    candidates = [tempo]
    if tempo > BPM_MAX:
        candidates.append(tempo / 2)
        if tempo > BPM_MAX * 2:
            candidates.append(tempo / 4)
    if tempo < BPM_MIN:
        candidates.append(tempo * 2)
        if tempo < BPM_MIN / 2:
            candidates.append(tempo * 4)
    in_range = [c for c in candidates if BPM_MIN <= c <= BPM_MAX]
    if in_range:
        return round(in_range[0])
    mid = (BPM_MIN + BPM_MAX) / 2
    best = min(candidates, key=lambda c: abs(c - mid))
    return round(best)

BPM_MIN = ${BPM_MIN}
BPM_MAX = ${BPM_MAX}

try:
    y, sr = librosa.load(sys.argv[1], duration=45)
    # Harmonic-percussive separation: run tempo on percussive for more stable BPM on drums/beats
    y_harm, y_perc = librosa.effects.harmonic_percussive_separate(y, margin=2.0)
    # Prefer percussive (drums); fall back to full signal if percussive is too quiet
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
        '--',
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
 * Detect musical key using chroma from the harmonic component (HPSS) and optional multi-segment voting for stability.
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

def chroma_to_key(chroma_mean):
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    best_key, best_score = None, -np.inf
    for i in range(12):
        major_score = np.dot(chroma_mean, np.roll(major_profile, i))
        if major_score > best_score:
            best_score, best_key = major_score, keys[i]
        minor_score = np.dot(chroma_mean, np.roll(minor_profile, i))
        if minor_score > best_score:
            best_score, best_key = minor_score, keys[i] + 'm'
    return best_key

try:
    y, sr = librosa.load(sys.argv[1], duration=45)
    # Use harmonic component only for chroma (reduces drum/percussion noise)
    y_harm, y_perc = librosa.effects.harmonic_percussive_separate(y, margin=2.0)
    # Multi-segment: compute key on 15s windows and vote
    segment_frames = 15 * sr
    keys = []
    for start in range(0, min(len(y_harm), 45 * sr) - segment_frames, int(segment_frames)):
        seg = y_harm[start:start + segment_frames]
        chroma = librosa.feature.chroma_stft(y=seg, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        keys.append(chroma_to_key(chroma_mean))
    if not keys:
        chroma = librosa.feature.chroma_stft(y=y_harm, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        best_key = chroma_to_key(chroma_mean)
    else:
        # Vote: most common key wins
        from collections import Counter
        best_key = Counter(keys).most_common(1)[0][0]
    print(json.dumps({"key": best_key}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
        `,
        '--',
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
          console.error('Python key detection failed:', errorOutput)
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
 * Main analysis function
 * Downloads audio from YouTube and analyzes BPM and key
 */
export async function analyzeYouTubeVideo(
  youtubeId: string
): Promise<AnalysisResult> {
  const audioPath = join(TEMP_DIR, `${youtubeId}.wav`)

  try {
    console.log(`[Analysis] Starting for ${youtubeId}`)
    
    // Ensure temp directory exists
    const { mkdir } = await import('fs/promises')
    try {
      await mkdir(TEMP_DIR, { recursive: true })
      console.log(`[Analysis] Temp directory ready: ${TEMP_DIR}`)
    } catch (e) {
      // Directory might already exist
      console.log(`[Analysis] Temp directory already exists`)
    }

    // Download audio with shorter timeout (15 seconds)
    console.log(`[Analysis] Downloading audio for ${youtubeId}...`)
    const downloadPromise = downloadYouTubeAudio(youtubeId, audioPath)
    const downloadTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.warn(`[Analysis] Download timeout after 15 seconds for ${youtubeId}`)
        reject(new Error('Download timeout after 15 seconds'))
      }, 15000) // Reduced to 15 seconds
    })
    
    try {
      await Promise.race([downloadPromise, downloadTimeout])
      console.log(`[Analysis] Audio downloaded: ${audioPath}`)
    } catch (downloadError: any) {
      console.error(`[Analysis] Download failed for ${youtubeId}:`, downloadError?.message)
      return { bpm: null, key: null }
    }

    // Analyze BPM and key in parallel with shorter timeout (10 seconds)
    console.log(`[Analysis] Starting BPM and key detection...`)
    const analysisPromise = Promise.all([
      detectBPM(audioPath),
      detectKey(audioPath)
    ])
    const analysisTimeout = new Promise<[null, null]>((resolve) => {
      setTimeout(() => {
        console.warn(`[Analysis] Analysis timeout after 10 seconds for ${youtubeId}`)
        resolve([null, null])
      }, 10000) // Reduced to 10 seconds
    })
    
    const [bpm, key] = await Promise.race([analysisPromise, analysisTimeout])
    console.log(`[Analysis] Complete - BPM: ${bpm}, Key: ${key}`)

    // Cleanup
    try {
      if (existsSync(audioPath)) {
        unlinkSync(audioPath)
        console.log(`[Analysis] Cleaned up audio file`)
      }
    } catch (e) {
      console.warn('Failed to cleanup audio file:', e)
    }

    return { bpm, key }
  } catch (error: any) {
    // Cleanup on error
    try {
      if (existsSync(audioPath)) {
        unlinkSync(audioPath)
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    console.error(`[Analysis] Error for ${youtubeId}:`, error?.message || error)
    return { bpm: null, key: null }
  }
}
