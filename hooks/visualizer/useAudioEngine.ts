"use client"

import { create } from "zustand"
import * as Tone from "tone"
import type { AudioState } from "@/lib/visualizer/types"
import { bandsFromFftMagnitudes } from "@/lib/visualizer/modulation/AudioReactiveBinding"

const MAX_BYTES = 50 * 1024 * 1024
export const WAVEFORM_POINTS = 800

export type AudioLoadStage = "idle" | "reading" | "decoding" | "ready" | "error"

const emptyAnalysis: Pick<AudioState, "bpm" | "beats" | "sections" | "frequencyBands"> = {
  bpm: null,
  beats: [],
  sections: [],
  frequencyBands: [],
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const len = buffer.length
  const out = new Float32Array(len)
  const n = buffer.numberOfChannels
  for (let c = 0; c < n; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < len; i++) out[i] += ch[i] / n
  }
  return out
}

function downsampleWaveform(buffer: AudioBuffer, points: number): Float32Array {
  const mono = mixToMono(buffer)
  const len = mono.length
  const block = Math.max(1, Math.floor(len / points))
  const out = new Float32Array(points)
  for (let i = 0; i < points; i++) {
    const start = i * block
    const end = Math.min(start + block, len)
    let peak = 0
    for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(mono[j]))
    out[i] = peak
  }
  return out
}

function validateAudioFile(file: File): string | null {
  if (file.size > MAX_BYTES) return "File must be 50MB or smaller."
  const okMime =
    /^(audio\/(mpeg|wav|wave|x-wav|ogg|flac|aac|mp4|x-m4a)|application\/ogg)/i.test(file.type) ||
    file.type === ""
  const okExt = /\.(mp3|wav|ogg|flac|aac)$/i.test(file.name)
  if (!okMime && !okExt) return "Use MP3, WAV, OGG, FLAC, or AAC."
  return null
}

function readFileWithProgress(file: File, onProgress: (p: number) => void): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    reader.onload = () => {
      onProgress(1)
      resolve(reader.result as ArrayBuffer)
    }
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"))
    reader.readAsArrayBuffer(file)
  })
}

let tonePlayer: Tone.Player | null = null
let toneAnalyser: Tone.Analyser | null = null
let rafId: number | null = null
/** Buffer time (seconds) where Transport.seconds === 0 maps to */
let anchorOffset = 0

/** Avoid negative transport / position epsilon from breaking Tone.js Time asserts */
function clampTime(t: number, duration: number): number {
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.min(t, duration))
}

function cancelRaf() {
  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function disposeTonePlayer() {
  cancelRaf()
  const transport = Tone.getTransport()
  transport.stop()
  transport.seconds = 0
  if (tonePlayer) {
    try {
      // Unsync first: synced `stop()` uses transport.seconds and can throw on ~0 negatives.
      tonePlayer.unsync()
      tonePlayer.dispose()
    } catch {
      /* ignore */
    }
    tonePlayer = null
  }
  if (toneAnalyser) {
    try {
      toneAnalyser.dispose()
    } catch {
      /* ignore */
    }
    toneAnalyser = null
  }
}

function attachOnStop() {
  if (!tonePlayer) return
  tonePlayer.onstop = () => {
    cancelRaf()
    const transport = Tone.getTransport()
    transport.pause()
    transport.stop()
    transport.seconds = 0
    const dur = useAudioEngineStore.getState().duration
    anchorOffset = dur
    useAudioEngineStore.setState({ isPlaying: false, currentTime: dur })
  }
}

function scheduleTransportTick() {
  cancelRaf()
  const tick = () => {
    const transport = Tone.getTransport()
    const { isPlaying, duration } = useAudioEngineStore.getState()
    if (!isPlaying || transport.state !== "started") return
    const t = clampTime(anchorOffset + transport.seconds, duration)
    if (t >= duration - 0.02) {
      cancelRaf()
      transport.pause()
      transport.stop()
      transport.seconds = 0
      tonePlayer?.unsync()
      anchorOffset = duration
      useAudioEngineStore.setState({ isPlaying: false, currentTime: duration })
      return
    }
    let bandsUpdate: { frequencyBands: number[] } | null = null
    if (toneAnalyser) {
      const v = toneAnalyser.getValue()
      const arr = v instanceof Float32Array ? v : new Float32Array(typeof v === "number" ? [v] : [])
      if (arr.length > 0) {
        bandsUpdate = { frequencyBands: bandsFromFftMagnitudes(arr) }
      }
    }
    useAudioEngineStore.setState(
      bandsUpdate ? { currentTime: t, ...bandsUpdate } : { currentTime: t }
    )
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

export interface AudioEngineStore extends AudioState {
  waveformData: Float32Array | null
  loadStage: AudioLoadStage
  loadProgress: number
  errorMessage: string | null
  loadFile: (file: File) => Promise<void>
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  dispose: () => void
}

const baseState: Omit<
  AudioEngineStore,
  "loadFile" | "play" | "pause" | "seek" | "dispose"
> = {
  ...emptyAnalysis,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  waveformData: null,
  loadStage: "idle",
  loadProgress: 0,
  errorMessage: null,
}

export const useAudioEngineStore = create<AudioEngineStore>((set, get) => ({
  ...baseState,

  loadFile: async (file: File) => {
    const err = validateAudioFile(file)
    if (err) {
      set({ loadStage: "error", errorMessage: err, loadProgress: 0 })
      return
    }

    disposeTonePlayer()
    anchorOffset = 0
    set({
      ...baseState,
      loadStage: "reading",
      loadProgress: 0,
      errorMessage: null,
    })

    try {
      await Tone.start()
      const arrayBuffer = await readFileWithProgress(file, (p) =>
        set({ loadProgress: p, loadStage: "reading" })
      )
      set({ loadStage: "decoding", loadProgress: 1 })

      // Use Tone's context API — rawContext may be a standardized-audio-context
      // wrapper that fails `instanceof AudioContext` but still decodes correctly.
      const decoded = await Tone.getContext().decodeAudioData(arrayBuffer.slice(0))
      const duration = decoded.duration

      toneAnalyser?.dispose()
      toneAnalyser = new Tone.Analyser("fft", 256)
      tonePlayer = new Tone.Player(decoded)
      tonePlayer.connect(toneAnalyser)
      toneAnalyser.toDestination()
      tonePlayer.loop = false
      attachOnStop()

      const waveformData = downsampleWaveform(decoded, WAVEFORM_POINTS)

      set({
        duration,
        waveformData,
        currentTime: 0,
        isPlaying: false,
        loadStage: "ready",
        loadProgress: 1,
        errorMessage: null,
        ...emptyAnalysis,
      })
    } catch (e) {
      disposeTonePlayer()
      anchorOffset = 0
      set({
        ...baseState,
        loadStage: "error",
        errorMessage: e instanceof Error ? e.message : "Could not decode audio.",
      })
    }
  },

  play: async () => {
    await Tone.start()
    const { duration, currentTime, loadStage } = get()
    if (!tonePlayer || loadStage !== "ready" || duration <= 0) return

    let startOffset = clampTime(anchorOffset, duration)
    if (currentTime >= duration - 0.05) {
      startOffset = 0
      anchorOffset = 0
      set({ currentTime: 0 })
    }

    const transport = Tone.getTransport()
    transport.stop()
    transport.seconds = 0
    tonePlayer.unsync()
    tonePlayer.sync().start(0, startOffset)
    transport.start()
    set({ isPlaying: true })
    scheduleTransportTick()
  },

  pause: () => {
    const transport = Tone.getTransport()
    if (transport.state !== "started") {
      set({ isPlaying: false })
      return
    }
    const dur = get().duration
    const pos = clampTime(anchorOffset + transport.seconds, dur)
    transport.pause()
    tonePlayer?.unsync()
    cancelRaf()
    transport.stop()
    transport.seconds = 0
    anchorOffset = pos
    set({ isPlaying: false, currentTime: pos, frequencyBands: [] })
  },

  seek: (time: number) => {
    const { duration, isPlaying } = get()
    if (!tonePlayer || duration <= 0) return
    const clamped = clampTime(time, duration)
    const transport = Tone.getTransport()
    transport.stop()
    transport.seconds = 0
    tonePlayer.unsync()
    cancelRaf()
    anchorOffset = clamped
    set({ currentTime: clamped })
    if (isPlaying) {
      tonePlayer.sync().start(0, anchorOffset)
      transport.start()
      set({ isPlaying: true })
      scheduleTransportTick()
    }
  },

  dispose: () => {
    disposeTonePlayer()
    anchorOffset = 0
    set({ ...baseState })
  },
}))

/** Full store + actions for the visualizer audio engine */
export function useAudioEngine() {
  return useAudioEngineStore()
}
