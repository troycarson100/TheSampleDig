"use client"

import { useRef, useCallback } from "react"
import type { Chop } from "@/hooks/useChopMode"

interface ChopTimelineMarkersProps {
  chops: Chop[]
  duration: number
  /** Current video playback time in seconds (for playhead) */
  currentTime?: number
  /** Called when user clicks on the bar to seek (e.g. adapter.seekTo(time)) */
  onSeek?: (time: number) => void
  onUpdateChopTime: (key: string, time: number) => void
  onRemoveChop: (key: string) => void
  pressedKey: string | null
}

export default function ChopTimelineMarkers({
  chops,
  duration,
  currentTime = 0,
  onSeek,
  onUpdateChopTime,
  onRemoveChop,
  pressedKey,
}: ChopTimelineMarkersProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const draggingKeyRef = useRef<string | null>(null)

  const getTimeFromClientX = useCallback(
    (clientX: number): number => {
      const bar = barRef.current
      if (!bar || duration <= 0) return 0
      const rect = bar.getBoundingClientRect()
      const x = clientX - rect.left
      const p = Math.max(0, Math.min(1, x / rect.width))
      return p * duration
    },
    [duration]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, key: string) => {
      e.preventDefault()
      if (e.shiftKey) {
        onRemoveChop(key)
        return
      }
      draggingKeyRef.current = key
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [onRemoveChop]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent, key: string) => {
      if (draggingKeyRef.current !== key) return
      const time = getTimeFromClientX(e.clientX)
      onUpdateChopTime(key, time)
    },
    [getTimeFromClientX, onUpdateChopTime]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent, key: string) => {
      if (draggingKeyRef.current === key) {
        const time = getTimeFromClientX(e.clientX)
        onUpdateChopTime(key, time)
        draggingKeyRef.current = null
      }
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    },
    [getTimeFromClientX, onUpdateChopTime]
  )

  if (duration <= 0) return null

  const playheadPercent = Math.max(0, Math.min(100, (currentTime / duration) * 100))

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const handleBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggingKeyRef.current) return
      if (e.target !== e.currentTarget) return
      const time = getTimeFromClientX(e.clientX)
      onSeek?.(time)
    },
    [getTimeFromClientX, onSeek]
  )

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Video timeline: click to seek"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      tabIndex={0}
      onClick={handleBarClick}
      className="absolute bottom-0 left-0 right-0 flex flex-col pointer-events-auto z-20 cursor-pointer"
      style={{ borderRadius: "0 0 8px 8px", minHeight: "1.75rem" }}
    >
      {/* Red progress bar: track (lighter) + elapsed (darker red) + chop markers */}
      <div
        className="relative w-full h-1.5 rounded-t-sm overflow-visible"
        style={{ background: "rgba(255,255,255,0.2)" }}
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-150 rounded-l-sm"
          style={{ width: `${playheadPercent}%`, background: "#b91c1c" }}
        />
        {chops.map((chop) => {
        const percent = Math.max(0, Math.min(100, (chop.time / duration) * 100))
        const isPressed = pressedKey === chop.key
        return (
          <div
            key={chop.key}
            className="absolute top-1/2 cursor-grab active:cursor-grabbing touch-none select-none transition-transform"
            style={{
              left: `${percent}%`,
              transform: `translate(-50%, -50%) ${isPressed ? "scale(1.35)" : ""}`,
              filter: isPressed ? "brightness(1.25)" : undefined,
            }}
            onPointerDown={(e) => handlePointerDown(e, chop.key)}
            onPointerMove={(e) => handlePointerMove(e, chop.key)}
            onPointerUp={(e) => handlePointerUp(e, chop.key)}
            onPointerLeave={(e) => {
              if (draggingKeyRef.current === chop.key) {
                const time = getTimeFromClientX(e.clientX)
                onUpdateChopTime(chop.key, time)
                draggingKeyRef.current = null
              }
            }}
            role="slider"
            aria-label={`Chop ${chop.key} at ${chop.time.toFixed(1)}s (shift+click to clear)`}
            tabIndex={0}
          >
            {/* Triangle (pointed top) */}
            <div
              className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent mx-auto transition-all"
              style={{ borderBottomColor: chop.color }}
            />
            {/* Small square - no border/box */}
            <div
              className="w-3 h-3 rounded-sm mt-0.5 transition-all"
              style={{
                background: chop.color,
              }}
            />
          </div>
        )
      })}
      </div>
      {/* Time display: current / total */}
      <div className="flex items-center justify-between px-2 py-0.5 text-white text-xs font-medium bg-black/60 rounded-b-[6px]">
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>
    </div>
  )
}
