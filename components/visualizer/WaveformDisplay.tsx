"use client"

import { useCallback, useMemo, useRef, useId } from "react"
import { useShallow } from "zustand/react/shallow"
import { useAudioEngineStore } from "@/hooks/visualizer/useAudioEngine"
import { useVisualizerStudioStore } from "@/hooks/visualizer/useVisualizerStudioStore"
import { VIZ_COLORS } from "@/lib/visualizer/constants/design-tokens"
import { mixHex } from "@/components/visualizer/waveformColors"

function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const s = Math.floor(seconds % 60)
  const m = Math.floor(seconds / 60) % 60
  const h = Math.floor(seconds / 3600)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function WaveformDisplay() {
  const filterId = useId().replace(/:/g, "")
  const svgRef = useRef<SVGSVGElement>(null)
  const waveformData = useAudioEngineStore((s) => s.waveformData)
  const duration = useAudioEngineStore((s) => s.duration)
  const currentTime = useAudioEngineStore((s) => s.currentTime)
  const seek = useAudioEngineStore((s) => s.seek)
  const { glowIntensity, strokeWidth, creamMix } = useVisualizerStudioStore(
    useShallow((s) => ({
      glowIntensity: s.effectiveParams.glowIntensity ?? 0.35,
      strokeWidth: s.effectiveParams.strokeWidth ?? 1.25,
      creamMix: s.effectiveParams.creamMix ?? 0.15,
    }))
  )
  const strokeColor = useMemo(
    () => mixHex(VIZ_COLORS.gold, VIZ_COLORS.cream, creamMix),
    [creamMix]
  )
  const blurStd = useMemo(() => 0.5 + glowIntensity * 16, [glowIntensity])

  const pathD = useMemo(() => {
    if (!waveformData || waveformData.length < 2) return ""
    const w = 800
    const h = 120
    const mid = h / 2
    const amp = mid * 0.92
    let d = `M 0 ${mid}`
    const n = waveformData.length
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w
      const y = mid - waveformData[i] * amp
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`
    }
    return d
  }, [waveformData])

  const playheadX = duration > 0 ? (currentTime / duration) * 800 : 0

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = svgRef.current
      if (!el || duration <= 0) return
      const rect = el.getBoundingClientRect()
      const x = clientX - rect.left
      const ratio = Math.max(0, Math.min(1, x / rect.width))
      seek(ratio * duration)
    },
    [duration, seek]
  )

  if (!waveformData) return null

  return (
    <div className="w-full px-4">
      <svg
        ref={svgRef}
        viewBox="0 0 800 120"
        preserveAspectRatio="none"
        className="h-28 w-full cursor-pointer select-none rounded-md sm:h-32"
        style={{ backgroundColor: VIZ_COLORS.bgPanel }}
        onMouseDown={(e) => seekFromClientX(e.clientX)}
        onTouchEnd={(e) => {
          const t = e.changedTouches[0]
          if (t) seekFromClientX(t.clientX)
        }}
        role="img"
        aria-label="Waveform overview"
      >
        <defs>
          <filter id={`glow-${filterId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={blurStd} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="800" height="120" fill={VIZ_COLORS.bgPanel} rx="6" />
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          filter={glowIntensity > 0.04 ? `url(#glow-${filterId})` : undefined}
        />
        <line
          x1={playheadX}
          y1={4}
          x2={playheadX}
          y2={116}
          stroke={VIZ_COLORS.cream}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </svg>
      <div
        className="mt-1 flex justify-between font-mono text-xs"
        style={{ color: VIZ_COLORS.warmGray }}
      >
        <span>{formatTimestamp(0)}</span>
        <span>{formatTimestamp(duration)}</span>
      </div>
    </div>
  )
}
