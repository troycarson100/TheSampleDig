"use client"

import { useAudioEngineStore } from "@/hooks/visualizer/useAudioEngine"
import { VIZ_COLORS } from "@/lib/visualizer/constants/design-tokens"
import { Pause, Play } from "lucide-react"

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const s = Math.floor(seconds % 60)
  const m = Math.floor(seconds / 60) % 60
  const h = Math.floor(seconds / 3600)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function TransportControls() {
  const isPlaying = useAudioEngineStore((s) => s.isPlaying)
  const currentTime = useAudioEngineStore((s) => s.currentTime)
  const duration = useAudioEngineStore((s) => s.duration)
  const play = useAudioEngineStore((s) => s.play)
  const pause = useAudioEngineStore((s) => s.pause)

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6">
      <button
        type="button"
        onClick={() => (isPlaying ? pause() : void play())}
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 transition-transform hover:scale-[1.03] active:scale-[0.98]"
        style={{
          borderColor: VIZ_COLORS.gold,
          backgroundColor: `${VIZ_COLORS.gold}22`,
          color: VIZ_COLORS.goldLight,
        }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="h-7 w-7" strokeWidth={2} />
        ) : (
          <Play className="ml-0.5 h-7 w-7" strokeWidth={2} />
        )}
      </button>
      <p
        className="font-mono text-sm tabular-nums tracking-wide"
        style={{ color: VIZ_COLORS.cream }}
      >
        {formatClock(currentTime)}
        <span style={{ color: VIZ_COLORS.warmGray }}> / </span>
        {formatClock(duration)}
      </p>
    </div>
  )
}
