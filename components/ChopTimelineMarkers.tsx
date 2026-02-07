"use client"

import { useRef, useCallback } from "react"
import type { Chop } from "@/hooks/useChopMode"

interface ChopTimelineMarkersProps {
  chops: Chop[]
  duration: number
  onUpdateChopTime: (key: string, time: number) => void
}

export default function ChopTimelineMarkers({
  chops,
  duration,
  onUpdateChopTime,
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
      draggingKeyRef.current = key
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    []
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

  if (chops.length === 0 || duration <= 0) return null

  return (
    <div
      ref={barRef}
      className="absolute bottom-0 left-0 right-0 h-6 bg-black/40 pointer-events-auto z-10"
      style={{ borderRadius: "0 0 8px 8px" }}
    >
      {chops.map((chop) => {
        const percent = Math.max(0, Math.min(100, (chop.time / duration) * 100))
        return (
          <div
            key={chop.key}
            className="absolute top-0 cursor-grab active:cursor-grabbing touch-none select-none"
            style={{
              left: `${percent}%`,
              transform: "translate(-50%, -50%)",
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
            aria-label={`Chop ${chop.key} at ${chop.time.toFixed(1)}s`}
            tabIndex={0}
          >
            {/* Triangle (pointed top) */}
            <div
              className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent mx-auto"
              style={{ borderBottomColor: chop.color }}
            />
            {/* Small square */}
            <div
              className="w-3 h-3 rounded-sm mt-0.5"
              style={{
                background: chop.color,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
