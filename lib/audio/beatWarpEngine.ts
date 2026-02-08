/**
 * Beat warp engine: load beat buffers, create loop with SoundTouch time-stretch,
 * play/stop, set target BPM (with ramp), set volume. Single AudioContext + worklet.
 */

import { getAudioContext } from "./audioContext"
import type { BeatDef } from "./beatLibrary"

const WORKLET_URL = "/worklets/soundtouch-worklet.js"
const RAMP_MS = 100

let workletLoaded = false

export async function ensureWorkletLoaded(ctx: AudioContext): Promise<void> {
  if (workletLoaded) return
  await ctx.audioWorklet.addModule(WORKLET_URL)
  workletLoaded = true
}

export async function loadBeat(beat: BeatDef): Promise<AudioBuffer> {
  const ctx = getAudioContext()
  const res = await fetch(beat.url)
  if (!res.ok) throw new Error(`Failed to load beat: ${res.status} ${beat.url}`)
  const arrayBuffer = await res.arrayBuffer()
  return ctx.decodeAudioData(arrayBuffer)
}

export interface WarpedLoopControls {
  play(): void
  stop(): void
  setTargetBpm(bpm: number): void
  setVolume(v: number): void
  setQuantizeStart(enabled: boolean): void
}

export function createWarpedLoop(
  buffer: AudioBuffer,
  originalBpm: number,
  targetBpm: number,
  bars: number,
  options: { quantizeStart: boolean } = { quantizeStart: true }
): WarpedLoopControls {
  const ctx = getAudioContext()

  const gainNode = ctx.createGain()
  gainNode.connect(ctx.destination)

  let soundTouchNode: AudioWorkletNode | null = null
  let bufferSource: AudioBufferSourceNode | null = null
  let scheduledStartTimeout: ReturnType<typeof setTimeout> | null = null
  let currentTargetBpm = targetBpm
  const originalBpmRef = originalBpm
  const barsRef = bars
  let quantizeStart = options.quantizeStart

  function getTempoRatio(bpm: number): number {
    return bpm / originalBpmRef
  }

  function applyTempoToNode(node: AudioWorkletNode, bpm: number, ramp = false): void {
    const param = node.parameters.get("tempo")
    if (!param) return
    const ratio = getTempoRatio(bpm)
    const now = ctx.currentTime
    if (ramp) {
      param.setValueAtTime(param.value, now)
      param.linearRampToValueAtTime(ratio, now + RAMP_MS / 1000)
    } else {
      param.setValueAtTime(ratio, now)
    }
  }

  function buildAndStart(when: number, offset: number): void {
    if (bufferSource) {
      try {
        bufferSource.stop()
        bufferSource.disconnect()
      } catch (_) {}
      bufferSource = null
    }

    bufferSource = ctx.createBufferSource()
    bufferSource.buffer = buffer
    bufferSource.loop = true
    bufferSource.loopStart = 0
    bufferSource.loopEnd = buffer.duration

    soundTouchNode = new AudioWorkletNode(ctx, "soundtouch-processor")
    const tempoParam = soundTouchNode.parameters.get("tempo")
    const pitchParam = soundTouchNode.parameters.get("pitch")
    if (tempoParam) tempoParam.value = getTempoRatio(currentTargetBpm)
    if (pitchParam) pitchParam.value = 1

    bufferSource.connect(soundTouchNode)
    soundTouchNode.connect(gainNode)

    bufferSource.start(when, offset)
  }

  function play(): void {
    if (!buffer) return
    if (scheduledStartTimeout) {
      clearTimeout(scheduledStartTimeout)
      scheduledStartTimeout = null
    }

    const now = ctx.currentTime
    const beatDurationSec = 60 / currentTargetBpm
    const barDurationSec = barsRef * 4 * beatDurationSec

    let startWhen = now
    let offset = 0

    if (quantizeStart && barDurationSec > 0) {
      const nextBarTime = Math.ceil(now / barDurationSec) * barDurationSec
      startWhen = nextBarTime
      const delay = startWhen - now
      if (delay > 0.05) {
        scheduledStartTimeout = setTimeout(() => {
          scheduledStartTimeout = null
          buildAndStart(startWhen, offset)
        }, delay * 1000)
        return
      }
    }

    buildAndStart(startWhen, offset)
  }

  function stop(): void {
    if (scheduledStartTimeout) {
      clearTimeout(scheduledStartTimeout)
      scheduledStartTimeout = null
    }
    if (bufferSource) {
      try {
        bufferSource.stop()
        bufferSource.disconnect()
      } catch (_) {}
      bufferSource = null
    }
    if (soundTouchNode) {
      try {
        soundTouchNode.disconnect()
      } catch (_) {}
      soundTouchNode = null
    }
  }

  function setTargetBpm(bpm: number): void {
    currentTargetBpm = bpm
    if (soundTouchNode) applyTempoToNode(soundTouchNode, bpm, true)
  }

  function setVolume(v: number): void {
    const now = ctx.currentTime
    gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, v)), now)
  }

  function setQuantizeStart(enabled: boolean): void {
    quantizeStart = enabled
  }

  return { play, stop, setTargetBpm, setVolume, setQuantizeStart }
}
