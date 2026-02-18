"use client"

import { useState, useRef, useCallback, useEffect } from "react"

const BPM_MIN = 20
const BPM_MAX = 300

export interface TempoRangeSliderProps {
  value: [number, number]
  onChange: (value: [number, number]) => void
  min?: number
  max?: number
  className?: string
  ariaLabelMin?: string
  ariaLabelMax?: string
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export default function TempoRangeSlider(props: TempoRangeSliderProps) {
  const {
    value: [minVal, maxVal],
    onChange,
    min = BPM_MIN,
    max = BPM_MAX,
    className = "",
    ariaLabelMin = "Min BPM",
    ariaLabelMax = "Max BPM",
  } = props

  const trackRef = useRef<HTMLDivElement>(null)
  const [minInput, setMinInput] = useState(String(minVal))
  const [maxInput, setMaxInput] = useState(String(maxVal))
  const [dragging, setDragging] = useState<"min" | "max" | null>(null)
  const [minFocused, setMinFocused] = useState(false)
  const [maxFocused, setMaxFocused] = useState(false)

  const range = max - min

  const percentToValue = useCallback(
    (p: number) => Math.round(min + (p / 100) * range),
    [min, range]
  )
  const valueToPercent = useCallback(
    (v: number) => ((clamp(v, min, max) - min) / range) * 100,
    [min, max, range]
  )

  // Sync inputs when controlled value changes (and not focused/editing)
  useEffect(() => {
    if (!minFocused) setMinInput(String(minVal))
  }, [minVal, minFocused])
  useEffect(() => {
    if (!maxFocused) setMaxInput(String(maxVal))
  }, [maxVal, maxFocused])

  const commitMin = useCallback(
    (raw: string) => {
      const n = parseInt(raw, 10)
      const v = isNaN(n) ? min : clamp(n, min, maxVal - 1)
      onChange([v, maxVal])
      setMinInput(String(v))
      setMinFocused(false)
    },
    [min, maxVal, onChange]
  )
  const commitMax = useCallback(
    (raw: string) => {
      const n = parseInt(raw, 10)
      const v = isNaN(n) ? max : clamp(n, minVal + 1, max)
      onChange([minVal, v])
      setMaxInput(String(v))
      setMaxFocused(false)
    },
    [max, minVal, onChange]
  )

  const handlePointerDown = useCallback(
    (which: "min" | "max") => (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      setDragging(which)
    },
    []
  )

  useEffect(() => {
    if (!dragging || !trackRef.current) return
    const track = trackRef.current
    const rect = () => track.getBoundingClientRect()

    const onMove = (e: PointerEvent) => {
      const r = rect()
      const p = ((e.clientX - r.left) / r.width) * 100
      const v = percentToValue(p)
      if (dragging === "min") {
        const newMin = clamp(v, min, maxVal - 1)
        onChange([newMin, maxVal])
      } else {
        const newMax = clamp(v, minVal + 1, max)
        onChange([minVal, newMax])
      }
    }
    const onUp = () => {
      setDragging(null)
      document.releasePointerCapture?.(
        (document as any).activePointerId ?? 0
      )
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [dragging, min, max, minVal, maxVal, onChange, percentToValue])

  const pMin = valueToPercent(minVal)
  const pMax = valueToPercent(maxVal)

  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      role="group"
      aria-label="Tempo range"
    >
      <input
        type="text"
        inputMode="numeric"
        value={minInput}
        onChange={(e) => setMinInput(e.target.value)}
        onFocus={() => setMinFocused(true)}
        onBlur={() => commitMin(minInput)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-11 text-center tabular-nums rounded border py-1 px-1 text-sm"
        style={{
          fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
          borderColor: "rgba(74, 55, 40, 0.25)",
          background: "white",
          color: "var(--brown)",
        }}
        aria-label={ariaLabelMin}
      />
      <div
        ref={trackRef}
        className="relative flex-1 min-w-[80px] h-6 flex items-center mx-2"
        style={{ touchAction: "none" }}
      >
        <div
          className="absolute inset-x-0 h-1.5 rounded-full"
          style={{
            background: "rgba(74, 55, 40, 0.12)",
          }}
        />
        <div
          className="absolute h-1.5 rounded-full"
          style={{
            left: `${pMin}%`,
            right: `${100 - pMax}%`,
            background: "var(--primary)",
          }}
        />
        <button
          type="button"
          onPointerDown={handlePointerDown("min")}
          className="absolute w-4 h-4 rounded-full border-2 shadow-sm cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{
            left: `calc(${pMin}% - 8px)`,
            top: "50%",
            transform: "translateY(-50%)",
            background: "white",
            borderColor: "var(--primary)",
          }}
          aria-label="Drag to set minimum tempo"
        />
        <button
          type="button"
          onPointerDown={handlePointerDown("max")}
          className="absolute w-4 h-4 rounded-full border-2 shadow-sm cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{
            left: `calc(${pMax}% - 8px)`,
            top: "50%",
            transform: "translateY(-50%)",
            background: "white",
            borderColor: "var(--primary)",
          }}
          aria-label="Drag to set maximum tempo"
        />
      </div>
      <input
        type="text"
        inputMode="numeric"
        value={maxInput}
        onChange={(e) => setMaxInput(e.target.value)}
        onFocus={() => setMaxFocused(true)}
        onBlur={() => commitMax(maxInput)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-11 text-center tabular-nums rounded border py-1 px-1 text-sm"
        style={{
          fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
          borderColor: "rgba(74, 55, 40, 0.25)",
          background: "white",
          color: "var(--brown)",
        }}
        aria-label={ariaLabelMax}
      />
      <span
        className="stem-control-label text-xs whitespace-nowrap"
        style={{ color: "var(--brown)" }}
      >
        bpm
      </span>
    </div>
  )
}
