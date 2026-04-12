import type { PreviewParamDef } from "@/lib/visualizer/previewTemplate"

export const AUDIO_SOURCE_LABELS: Record<AudioSource, string> = {
  energy: "Energy",
  sub: "Sub",
  low: "Low",
  mid: "Mid",
  high: "High",
  presence: "Presence",
  kick: "Kick",
  snare: "Snare",
  hat: "Hi-hat",
  beatPhase: "Beat phase",
  barPhase: "Bar phase",
  sectionProgress: "Track progress",
}

export const QUICK_BIND_SOURCES: AudioSource[] = [
  "energy",
  "kick",
  "snare",
  "mid",
  "high",
  "sectionProgress",
]

export type AudioSource =
  | "energy"
  | "sub"
  | "low"
  | "mid"
  | "high"
  | "presence"
  | "kick"
  | "snare"
  | "hat"
  | "beatPhase"
  | "barPhase"
  | "sectionProgress"

export interface Binding {
  id: string
  source: AudioSource
  target: string
  amount: number
  smoothing: number
  invert: boolean
}

export interface ModulationContext {
  /** 0–1 band levels (length ≥ 6 recommended) */
  bands: number[]
  energy: number
  currentTime: number
  duration: number
  bpm: number | null
  beats: number[]
  sections: { start: number; end: number }[]
}

export type ModulationState = {
  /** binding id → smoothed driver 0–1 */
  bindingSmooth: Map<string, number>
  kickEnv: number
  snareEnv: number
  hatEnv: number
  prevSub: number
}

export function createModulationState(): ModulationState {
  return {
    bindingSmooth: new Map(),
    kickEnv: 0,
    snareEnv: 0,
    hatEnv: 0,
    prevSub: 0,
  }
}

export function resetModulationStateForBindings(state: ModulationState, bindings: Binding[]) {
  const ids = new Set(bindings.map((b) => b.id))
  for (const key of state.bindingSmooth.keys()) {
    if (!ids.has(key)) state.bindingSmooth.delete(key)
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function dbishTo01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return clamp01((v + 100) / 100)
}

/** Map raw FFT / band array to stable 0–1 buckets */
export function bandsFromFftMagnitudes(mags: Float32Array | number[]): number[] {
  const n = mags.length
  if (n < 8) {
    const pad = Array(8).fill(0)
    for (let i = 0; i < n; i++) pad[i] = typeof mags[i] === "number" ? dbishTo01(mags[i] as number) : dbishTo01((mags as Float32Array)[i])
    return pad
  }
  const out: number[] = []
  const chunk = Math.floor(n / 8)
  for (let b = 0; b < 8; b++) {
    let sum = 0
    const start = b * chunk
    const end = b === 7 ? n : (b + 1) * chunk
    for (let i = start; i < end; i++) sum += dbishTo01(mags[i])
    out.push(sum / (end - start))
  }
  return out
}

function bandAt(bands: number[], i: number): number {
  return bands[i] ?? 0
}

function updateTransientEnvelopes(state: ModulationState, bands: number[], dt: number) {
  const sub = bandAt(bands, 0)
  const mid = bandAt(bands, 3)
  const high = bandAt(bands, 5)
  const prevSub = state.prevSub
  state.prevSub = sub
  const spikeKick = Math.max(0, sub - prevSub) * 8
  const spikeSnare = Math.max(0, mid - (state.snareEnv * 0.5)) * 3
  const spikeHat = high * high * 2

  const decay = (v: number, sp: number, rate: number) =>
    Math.min(1, v * Math.exp(-rate * dt) + sp)

  state.kickEnv = decay(state.kickEnv, clamp01(spikeKick), 12)
  state.snareEnv = decay(state.snareEnv, clamp01(spikeSnare), 14)
  state.hatEnv = decay(state.hatEnv, clamp01(spikeHat), 18)
}

function sampleAudioSource(
  source: AudioSource,
  ctx: ModulationContext,
  state: ModulationState
): number {
  const { bands, energy, currentTime, duration, bpm, beats, sections } = ctx
  const sub = bandAt(bands, 0)
  const low = bandAt(bands, 1)
  const mid = bandAt(bands, 3)
  const high = bandAt(bands, 5)
  const presence = bandAt(bands, 6)

  const effectiveBpm = bpm && bpm > 0 ? bpm : 120
  const beatDur = 60 / effectiveBpm
  const beatPhase = 0.5 + 0.5 * Math.sin((2 * Math.PI * currentTime) / beatDur)
  const barPhase = 0.5 + 0.5 * Math.sin((2 * Math.PI * currentTime) / (beatDur * 4))

  let secProg = 0
  if (sections.length > 0 && duration > 0) {
    const t = currentTime
    const seg = sections.find((s) => t >= s.start && t < s.end)
    if (seg && seg.end > seg.start) {
      secProg = (t - seg.start) / (seg.end - seg.start)
    }
  } else if (duration > 0) {
    secProg = currentTime / duration
  }

  switch (source) {
    case "energy":
      return energy
    case "sub":
      return sub
    case "low":
      return low
    case "mid":
      return mid
    case "high":
      return high
    case "presence":
      return presence
    case "kick":
      return state.kickEnv
    case "snare":
      return state.snareEnv
    case "hat":
      return state.hatEnv
    case "beatPhase":
      return beatPhase
    case "barPhase":
      return barPhase
    case "sectionProgress":
      return clamp01(secProg)
    default:
      return 0
  }
}

function smoothStep(current: number, target: number, smoothing: number, dt: number): number {
  const s = clamp01(smoothing)
  const alpha = 1 - Math.exp(-(1 - s) * 18 * Math.max(0.001, dt) - s * 3 * Math.max(0.001, dt))
  return current + (target - current) * Math.min(1, alpha)
}

function getRange(defs: PreviewParamDef[], key: string): { min: number; max: number } {
  const d = defs.find((x) => x.key === key)
  return d ? { min: d.min, max: d.max } : { min: 0, max: 1 }
}

export interface BuildModulationContextInput {
  bands: number[]
  energy: number
  currentTime: number
  duration: number
  bpm: number | null
  beats: number[]
  sections: { start: number; end: number }[]
}

export function buildModulationContext(
  input: BuildModulationContextInput,
  state: ModulationState,
  dtSeconds: number
): ModulationContext {
  updateTransientEnvelopes(state, input.bands, dtSeconds)
  return {
    bands: input.bands,
    energy: input.energy,
    currentTime: input.currentTime,
    duration: input.duration,
    bpm: input.bpm,
    beats: input.beats,
    sections: input.sections,
  }
}

export function applyAudioModulation(
  baseParams: Record<string, number>,
  bindings: Binding[],
  ctx: ModulationContext,
  state: ModulationState,
  paramDefs: PreviewParamDef[],
  dtSeconds: number
): Record<string, number> {
  const out = { ...baseParams }
  if (bindings.length === 0) return out

  const extra: Record<string, number> = {}
  for (const b of bindings) {
    const raw = sampleAudioSource(b.source, ctx, state)
    const prev = state.bindingSmooth.get(b.id) ?? raw
    const smoothed = smoothStep(prev, raw, b.smoothing, dtSeconds)
    state.bindingSmooth.set(b.id, smoothed)
    const driver = b.invert ? 1 - smoothed : smoothed
    const { min, max } = getRange(paramDefs, b.target)
    const span = max - min
    const contribution = driver * b.amount * span
    extra[b.target] = (extra[b.target] ?? 0) + contribution
  }
  for (const key of Object.keys(extra)) {
    const { min, max } = getRange(paramDefs, key)
    const base = baseParams[key]
    if (typeof base === "number" && Number.isFinite(base)) {
      out[key] = Math.min(max, Math.max(min, base + (extra[key] ?? 0)))
    }
  }
  return out
}

export function createBinding(partial: Omit<Binding, "id"> & { id?: string }): Binding {
  return {
    id: partial.id ?? `b-${Math.random().toString(36).slice(2, 10)}`,
    source: partial.source,
    target: partial.target,
    amount: clamp01(partial.amount),
    smoothing: clamp01(partial.smoothing),
    invert: partial.invert ?? false,
  }
}

export function sourceAccent(source: AudioSource): string {
  const map: Partial<Record<AudioSource, string>> = {
    energy: "#E8D5A0",
    kick: "#E63946",
    snare: "#F4A261",
    mid: "#9B5DE5",
    high: "#2A9D8F",
    sectionProgress: "#C9A94E",
  }
  return map[source] ?? "#C9A94E"
}
