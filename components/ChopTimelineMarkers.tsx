"use client"

import { useRef, useCallback, useMemo, useState, useEffect } from "react"
import type { Chop } from "@/hooks/useChopMode"
import type { GridDivision } from "@/lib/grid-quantize"
import { snapToGrid, getGridLinePositionsMs } from "@/lib/grid-quantize"

const SEEK_THROTTLE_MS = 80
const CHOP_UPDATE_THROTTLE_MS = 16
const ZOOM_FACTOR = 1.15
/** Move past this (px) on track = pan; else treat as click-to-seek when zoomed */
const TRACK_DRAG_THRESHOLD_PX = 6

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
  quantizeEnabled?: boolean
  quantizeBpm?: number | null
  quantizeDivision?: GridDivision
  quantizeSwingPct?: number
  /** Volume 0–100 for the video player (shown since YouTube controls are hidden in chop mode) */
  volume?: number
  onVolumeChange?: (volume: number) => void
}

export default function ChopTimelineMarkers({
  chops,
  duration,
  currentTime = 0,
  onSeek,
  onUpdateChopTime,
  onRemoveChop,
  pressedKey,
  quantizeEnabled = false,
  quantizeBpm,
  quantizeDivision = "1/16",
  quantizeSwingPct = 50,
  volume = 100,
  onVolumeChange,
}: ChopTimelineMarkersProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const draggingKeyRef = useRef<string | null>(null)
  const draggingPlayheadRef = useRef<boolean>(false)
  const panningRef = useRef(false)
  const panStartClientXRef = useRef(0)
  const panStartViewStartRef = useRef(0)
  const panStartViewEndRef = useRef(0)
  /** When zoomed: track pointer down but not yet moved past threshold; on up without pan → seek */
  const trackClickPendingRef = useRef(false)
  const trackDownClientXRef = useRef(0)
  const lastSeekAtRef = useRef<number>(0)
  const lastChopUpdateAtRef = useRef<number>(0)
  const [playheadDragTime, setPlayheadDragTime] = useState<number | null>(null)
  /** During chop drag, show marker at this time so it follows cursor without waiting for parent state */
  const [chopDragPreview, setChopDragPreview] = useState<{ key: string; time: number } | null>(null)
  /** Visible time window for zoom: [viewStartTime, viewEndTime] in seconds */
  const [viewStartTime, setViewStartTime] = useState(0)
  const [viewEndTime, setViewEndTime] = useState(duration)
  const [isPanning, setIsPanning] = useState(false)

  useEffect(() => {
    setViewStartTime(0)
    setViewEndTime(duration)
  }, [duration])

  const viewWindow = viewEndTime - viewStartTime

  const getTimeFromClientX = useCallback(
    (clientX: number): number => {
      const bar = barRef.current
      if (!bar || duration <= 0 || viewWindow <= 0) return 0
      const rect = bar.getBoundingClientRect()
      const x = clientX - rect.left
      const p = Math.max(0, Math.min(1, x / rect.width))
      const time = viewStartTime + p * viewWindow
      return Math.max(0, Math.min(duration, time))
    },
    [duration, viewStartTime, viewWindow]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, key: string) => {
      e.preventDefault()
      if (e.shiftKey) {
        onRemoveChop(key)
        return
      }
      draggingKeyRef.current = key
      const chop = chops.find((c) => c.key === key)
      if (chop) setChopDragPreview({ key, time: chop.time })
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [onRemoveChop, chops]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent, key: string) => {
      if (draggingKeyRef.current !== key) return
      const time = getTimeFromClientX(e.clientX)
      setChopDragPreview((prev) => (prev?.key === key ? { key, time } : prev))
      const now = performance.now()
      if (now - lastChopUpdateAtRef.current >= CHOP_UPDATE_THROTTLE_MS) {
        lastChopUpdateAtRef.current = now
        onUpdateChopTime(key, time)
      }
    },
    [getTimeFromClientX, onUpdateChopTime]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent, key: string) => {
      if (draggingKeyRef.current === key) {
        let time = getTimeFromClientX(e.clientX)
        if (quantizeEnabled && quantizeBpm && quantizeBpm > 0) {
          const snappedMs = snapToGrid(time * 1000, quantizeBpm, quantizeDivision, quantizeSwingPct)
          time = Math.max(0, snappedMs / 1000)
        }
        onUpdateChopTime(key, time)
        setChopDragPreview(null)
        draggingKeyRef.current = null
      }
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    },
    [getTimeFromClientX, onUpdateChopTime, quantizeEnabled, quantizeBpm, quantizeDivision, quantizeSwingPct]
  )

  if (duration <= 0) return null

  const playheadTime = playheadDragTime ?? currentTime
  const playheadPercent =
    viewWindow > 0
      ? Math.max(0, Math.min(100, ((playheadTime - viewStartTime) / viewWindow) * 100))
      : 0

  const gridLines = useMemo(() => {
    if (!quantizeBpm || quantizeBpm <= 0 || viewWindow <= 0) return []
    const lengthMs = duration * 1000
    const positions = getGridLinePositionsMs(lengthMs, quantizeBpm, quantizeDivision)
    return positions.map(({ positionMs, isBar }) => {
      const timeSec = positionMs / 1000
      const percent = ((timeSec - viewStartTime) / viewWindow) * 100
      return { percent, isBar }
    })
  }, [quantizeBpm, duration, quantizeDivision, viewStartTime, viewWindow])

  const minViewWindow = Math.max(2, duration * 0.02)

  const viewStateRef = useRef({ viewStartTime, viewWindow, duration, minViewWindow })
  viewStateRef.current = { viewStartTime, viewWindow, duration, minViewWindow }

  const handleWheel = useCallback((e: WheelEvent) => {
    const bar = barRef.current
    if (!bar) return
    const { viewStartTime: vs, viewWindow: vw, duration: dur, minViewWindow: minVw } = viewStateRef.current
    if (dur <= 0 || vw <= 0) return

    const isZoomGesture = e.ctrlKey || e.metaKey
    if (isZoomGesture) {
      e.preventDefault()
      const rect = bar.getBoundingClientRect()
      const x = e.clientX - rect.left
      const cursorTime = vs + (x / rect.width) * vw
      const factor = e.deltaY < 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR
      const viewWindowNew = Math.max(minVw, Math.min(dur, vw * factor))
      const viewStartNew = Math.max(
        0,
        Math.min(dur - viewWindowNew, cursorTime - (x / rect.width) * viewWindowNew)
      )
      const viewEndNew = viewStartNew + viewWindowNew
      setViewStartTime(viewStartNew)
      setViewEndTime(viewEndNew)
      return
    }

    const isZoomedIn = vw < dur - 0.01
    if (isZoomedIn && Math.abs(e.deltaX) > 0) {
      e.preventDefault()
      const rect = bar.getBoundingClientRect()
      const timeDelta = (e.deltaX / rect.width) * vw
      const newStart = Math.max(0, Math.min(dur - vw, vs + timeDelta))
      setViewStartTime(newStart)
      setViewEndTime(newStart + vw)
    }
  }, [])

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    bar.addEventListener("wheel", handleWheel, { passive: false })
    return () => bar.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggingKeyRef.current) return
      if ((e.target as HTMLElement).closest("[data-chop-marker]")) return
      const isZoomedIn = viewWindow < duration - 0.01
      if (isZoomedIn) {
        trackClickPendingRef.current = true
        trackDownClientXRef.current = e.clientX
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      } else {
        const time = getTimeFromClientX(e.clientX)
        onSeek?.(time)
      }
    },
    [getTimeFromClientX, onSeek, viewWindow, duration]
  )

  const handleTrackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (panningRef.current) {
        const bar = barRef.current
        if (!bar || viewWindow <= 0) return
        const rect = bar.getBoundingClientRect()
        const deltaX = e.clientX - panStartClientXRef.current
        const timeDelta = (deltaX / rect.width) * (panStartViewEndRef.current - panStartViewStartRef.current)
        const newStart = Math.max(0, Math.min(duration - viewWindow, panStartViewStartRef.current - timeDelta))
        const newEnd = newStart + viewWindow
        setViewStartTime(newStart)
        setViewEndTime(newEnd)
        return
      }
      if (trackClickPendingRef.current && Math.abs(e.clientX - trackDownClientXRef.current) > TRACK_DRAG_THRESHOLD_PX) {
        panningRef.current = true
        setIsPanning(true)
        panStartClientXRef.current = e.clientX
        panStartViewStartRef.current = viewStartTime
        panStartViewEndRef.current = viewEndTime
        trackClickPendingRef.current = false
      }
    },
    [duration, viewWindow, viewStartTime, viewEndTime]
  )

  const handleTrackPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (panningRef.current) {
        panningRef.current = false
        setIsPanning(false)
      } else if (trackClickPendingRef.current) {
        const time = getTimeFromClientX(trackDownClientXRef.current)
        onSeek?.(time)
        trackClickPendingRef.current = false
      }
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    },
    [getTimeFromClientX, onSeek]
  )

  const handlePlayheadPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      draggingPlayheadRef.current = true
      const time = getTimeFromClientX(e.clientX)
      setPlayheadDragTime(time)
      lastSeekAtRef.current = 0
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [getTimeFromClientX]
  )

  const handlePlayheadPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingPlayheadRef.current) return
      const time = getTimeFromClientX(e.clientX)
      setPlayheadDragTime(time)
      const now = performance.now()
      if (now - lastSeekAtRef.current >= SEEK_THROTTLE_MS) {
        lastSeekAtRef.current = now
        onSeek?.(time)
      }
    },
    [getTimeFromClientX, onSeek]
  )

  const handlePlayheadPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (draggingPlayheadRef.current) {
        const time = getTimeFromClientX(e.clientX)
        onSeek?.(time)
        setPlayheadDragTime(null)
        draggingPlayheadRef.current = false
      }
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    },
    [getTimeFromClientX, onSeek]
  )

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Video timeline: drag playhead or click to seek"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      tabIndex={0}
      className="absolute bottom-0 left-0 right-0 flex flex-col pointer-events-auto z-20 cursor-pointer bg-black"
      style={{ borderRadius: "0 0 8px 8px", minHeight: "calc(2.75rem + 5px)" }}
    >
      {/* Red progress bar: track (2x height) + elapsed + playhead; markers sit below in own row */}
      <div
        className={`relative w-full h-3 rounded-t-sm overflow-visible ${viewWindow < duration - 0.01 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : ""}`}
        style={{ background: "rgba(255,255,255,0.2)" }}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
        onPointerLeave={handleTrackPointerUp}
      >
        {/* Quantize grid lines (subdivision light; bar lines darker and taller) */}
        {gridLines.map(({ percent, isBar }, i) => (
          <div
            key={`grid-${i}`}
            className="absolute top-1/2 pointer-events-none z-0"
            style={{
              left: `${percent}%`,
              width: isBar ? 2 : 1,
              height: isBar ? "1.25rem" : "0.75rem",
              transform: "translate(-50%, -50%)",
              background: isBar ? "rgba(60,60,60,0.85)" : "rgba(128,128,128,0.35)",
            }}
            aria-hidden
          />
        ))}
        <div
          className={`absolute inset-y-0 left-0 rounded-l-sm pointer-events-none ${playheadDragTime == null ? "transition-[width] duration-150" : ""}`}
          style={{ width: `${playheadPercent}%`, background: "#b91c1c" }}
        />
        {/* Thin vertical white playhead line on the red bar (above slice arrows) */}
        <div
          className="absolute inset-y-0 w-px -translate-x-1/2 bg-white pointer-events-none z-[1]"
          style={{ left: `${playheadPercent}%` }}
          aria-hidden
        />
        {/* Thin vertical white lines at each slice position on the red bar */}
        {chops.map((chop) => {
          const timeForPosition = chopDragPreview?.key === chop.key ? chopDragPreview.time : chop.time
          const percent =
            viewWindow > 0
              ? ((timeForPosition - viewStartTime) / viewWindow) * 100
              : 0
          return (
            <div
              key={`slice-line-${chop.key}`}
              className="absolute inset-y-0 w-px -translate-x-1/2 bg-white pointer-events-none z-[1]"
              style={{ left: `${percent}%` }}
              aria-hidden
            />
          )
        })}
        {/* Draggable playhead thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-3 rounded-[2px] bg-white border border-red-800 shadow cursor-ew-resize touch-none select-none z-10"
          style={{ left: `${playheadPercent}%`, borderWidth: 1 }}
          onPointerDown={handlePlayheadPointerDown}
          onPointerMove={handlePlayheadPointerMove}
          onPointerUp={handlePlayheadPointerUp}
          onPointerLeave={(e) => {
            if (draggingPlayheadRef.current) {
              const time = getTimeFromClientX(e.clientX)
              onSeek?.(time)
              setPlayheadDragTime(null)
              draggingPlayheadRef.current = false
            }
            ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
          }}
          role="slider"
          aria-label="Playhead: drag to seek"
        />
        {/* Chop markers row: below red bar, touching its bottom; triangle points up into bar */}
        <div className="absolute left-0 right-0 top-full h-5 pointer-events-none" aria-hidden>
          {chops.map((chop) => {
            const timeForPosition = chopDragPreview?.key === chop.key ? chopDragPreview.time : chop.time
            const percent =
              viewWindow > 0
                ? ((timeForPosition - viewStartTime) / viewWindow) * 100
                : 0
            const isPressed = pressedKey === chop.key
            return (
              <div
                key={chop.key}
                data-chop-marker
                className="absolute cursor-grab active:cursor-grabbing touch-none select-none transition-transform pointer-events-auto"
                style={{
                  left: `${percent}%`,
                  transform: `translate(-50%, 0) ${isPressed ? "scale(1.35)" : ""}`,
                  filter: isPressed ? "brightness(1.25)" : undefined,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  handlePointerDown(e, chop.key)
                }}
                onPointerMove={(e) => handlePointerMove(e, chop.key)}
                onPointerUp={(e) => handlePointerUp(e, chop.key)}
                onPointerLeave={(e) => {
                  if (draggingKeyRef.current === chop.key) {
                    let time = getTimeFromClientX(e.clientX)
                    if (quantizeEnabled && quantizeBpm && quantizeBpm > 0) {
                      const snappedMs = snapToGrid(time * 1000, quantizeBpm, quantizeDivision, quantizeSwingPct)
                      time = Math.max(0, snappedMs / 1000)
                    }
                    onUpdateChopTime(chop.key, time)
                    setChopDragPreview(null)
                    draggingKeyRef.current = null
                  }
                }}
                role="slider"
                aria-label={`Chop ${chop.key} at ${chop.time.toFixed(1)}s (shift+click to clear)`}
                tabIndex={0}
              >
                {/* Triangle pointing up (tip touches bottom of red bar) */}
                <div
                  className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent mx-auto transition-all"
                  style={{ borderBottomColor: chop.color }}
                />
                {/* Small square */}
                <div
                  className="w-3 h-3 rounded-sm mt-0.5 transition-all"
                  style={{ background: chop.color }}
                />
              </div>
            )
          })}
        </div>
      </div>
      {/* Time display + volume slider */}
      <div className="flex flex-1 items-center justify-between px-2 text-white text-xs font-medium bg-black/60 rounded-b-[6px]">
        <span>{formatTime(playheadTime)} / {formatTime(duration)}</span>
        {onVolumeChange && (
          <div
            className="flex items-center gap-1.5 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-3 h-3 shrink-0 opacity-80"
              aria-hidden
            >
              {volume === 0 ? (
                <path d="M9.25 3.75a.75.75 0 0 0-1.28-.53L4.22 7H2.5A1.5 1.5 0 0 0 1 8.5v3A1.5 1.5 0 0 0 2.5 13h1.72l3.75 3.78a.75.75 0 0 0 1.28-.53V3.75ZM13.03 7.47a.75.75 0 0 1 1.06 0l1.44 1.44 1.44-1.44a.75.75 0 1 1 1.06 1.06L16.59 10l1.44 1.44a.75.75 0 1 1-1.06 1.06L15.53 11.1l-1.44 1.44a.75.75 0 1 1-1.06-1.06L14.47 10l-1.44-1.44a.75.75 0 0 1 0-1.06Z" />
              ) : volume < 50 ? (
                <path d="M9.25 3.75a.75.75 0 0 0-1.28-.53L4.22 7H2.5A1.5 1.5 0 0 0 1 8.5v3A1.5 1.5 0 0 0 2.5 13h1.72l3.75 3.78a.75.75 0 0 0 1.28-.53V3.75ZM12.5 10a2.5 2.5 0 0 0-1.5-2.3v4.6A2.5 2.5 0 0 0 12.5 10Z" />
              ) : (
                <path d="M9.25 3.75a.75.75 0 0 0-1.28-.53L4.22 7H2.5A1.5 1.5 0 0 0 1 8.5v3A1.5 1.5 0 0 0 2.5 13h1.72l3.75 3.78a.75.75 0 0 0 1.28-.53V3.75ZM12.5 10a2.5 2.5 0 0 0-1.5-2.3v4.6A2.5 2.5 0 0 0 12.5 10ZM15 10a5 5 0 0 0-3-4.58v9.16A5 5 0 0 0 15 10Z" />
              )}
            </svg>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Volume"
              className="chop-volume-slider"
              style={{ width: 72 }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
