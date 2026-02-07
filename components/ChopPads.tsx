"use client"

import { KEY_COLORS, type Chop } from "@/hooks/useChopMode"

/** QWERTY-style layout: top row then bottom row (staggered). */
const ROW_1 = ["W", "E", "T", "Y", "U", "O", "P"]
const ROW_2 = ["A", "S", "D", "F", "G", "H", "J", "K", "L"]

interface ChopPadsProps {
  chops: Chop[]
  onPadKeyPress: (key: string) => void
}

export default function ChopPads({ chops, onPadKeyPress }: ChopPadsProps) {
  const chopByKey = new Map(chops.map((c) => [c.key, c]))

  const pad = (key: string) => {
    const chop = chopByKey.get(key)
    const isActive = !!chop
    const color = chop?.color ?? KEY_COLORS[key] ?? "#888"
    return (
      <button
        key={key}
        type="button"
        onClick={() => onPadKeyPress(key)}
        className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 border-2 min-w-[2.25rem] sm:min-w-[2.5rem]"
        style={
          isActive
            ? {
                background: color,
                color: "#fff",
                borderColor: "rgba(0,0,0,0.15)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }
            : {
                background: "#e8e6e3",
                color: "#9a9590",
                borderColor: "rgba(0,0,0,0.08)",
              }
        }
        aria-label={isActive ? `Chop ${key} at ${chop?.time.toFixed(1)}s` : `Key ${key} (no chop)`}
      >
        {key}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Top row */}
      <div className="flex justify-center gap-1">
        {ROW_1.map((key) => pad(key))}
      </div>
      {/* Bottom row: staggered (offset to the right like QWERTY) */}
      <div className="flex justify-center gap-1" style={{ marginLeft: "1.25rem" }}>
        {ROW_2.map((key) => pad(key))}
      </div>
    </div>
  )
}
