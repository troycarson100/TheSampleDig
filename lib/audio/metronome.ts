/**
 * Simple metronome beep for count-in. One short click at a time.
 */

import { getAudioContext } from "./audioContext"

const BEEP_MS = 50
const BEEP_FREQ = 880

export async function playMetronomeBeep(): Promise<void> {
  const ctx = await getAudioContext()
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = BEEP_FREQ
  osc.type = "sine"
  gain.gain.setValueAtTime(0.15, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + BEEP_MS / 1000)
  osc.start(now)
  osc.stop(now + BEEP_MS / 1000)
}

export function scheduleCountIn(
  beats: number,
  intervalMs: number,
  onBeat: (index: number) => void,
  onComplete: () => void
): () => void {
  let cancelled = false
  const timeouts: ReturnType<typeof setTimeout>[] = []
  for (let i = 0; i < beats; i++) {
    timeouts.push(
      setTimeout(() => {
        if (cancelled) return
        onBeat(i)
        if (i === beats - 1) onComplete()
      }, i * intervalMs)
    )
  }
  return () => {
    cancelled = true
    timeouts.forEach((t) => clearTimeout(t))
  }
}
