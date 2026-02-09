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

/**
 * Analyze audio file for BPM using a simple autocorrelation approach
 * This is a basic implementation - for production, consider using librosa or essentia
 */
async function detectBPM(audioPath: string): Promise<number | null> {
  try {
    // For now, we'll use a Python script with librosa for accurate BPM detection
    // This requires librosa to be installed: pip install librosa numpy
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [
        '-c',
        `
import librosa
import sys
import json

try:
    y, sr = librosa.load('${audioPath}', duration=30)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    print(json.dumps({"bpm": round(float(tempo))}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
        `
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
          console.error('Python BPM detection failed:', errorOutput)
          // Fallback: return null if Python/librosa not available
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
 * Detect musical key using chroma features
 * Uses Python with librosa for key detection
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

try:
    y, sr = librosa.load('${audioPath}', duration=30)
    
    # Extract chroma features
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)
    
    # Key profiles (Krumhansl-Schmuckler key profiles)
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    
    keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    
    best_key = None
    best_score = -np.inf
    
    for i in range(12):
        # Major key
        major_score = np.dot(chroma_mean, np.roll(major_profile, i))
        if major_score > best_score:
            best_score = major_score
            best_key = keys[i]
        
        # Minor key
        minor_score = np.dot(chroma_mean, np.roll(minor_profile, i))
        if minor_score > best_score:
            best_score = minor_score
            best_key = keys[i] + 'm'
    
    print(json.dumps({"key": best_key}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
        `
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
