"use client"

import { KEY_COLORS, type Chop } from "@/hooks/useChopMode"

/** Top row: W E T Y U O — each centered between two bottom keys. */
const ROW_1 = ["W", "E", "T", "Y", "U", "O"]
/** Bottom row: A S D F G H J K L. */
const ROW_2 = ["A", "S", "D", "F", "G", "H", "J", "K", "L"]

/** Key size and gap (rem) so top-row positions match bottom-row midpoints. */
const KEY_W = 2.5
const GAP = 0.5
/** Total width of the keybed (bottom row); use for space bar width. */
export const CHOP_KEYBOARD_WIDTH_REM = ROW_2.length * KEY_W + (ROW_2.length - 1) * GAP
/** Two pad rows + gap-3 between them (matches ChopPads layout). */
export const CHOP_KEYBED_HEIGHT_REM = KEY_W + 0.75 + KEY_W
/**
 * Pads + mt-3 + space bar block + hint — used to size the scaled keyboard column in SamplePlayer.
 * Slightly generous so the container does not clip when scaled.
 */
export const CHOP_KEYBOARD_COLUMN_HEIGHT_REM = CHOP_KEYBED_HEIGHT_REM + 0.75 + 3.5 + 2
/** Left position (rem) for each top key so it’s centered between the given bottom keys. */
const TOP_LEFT_REM = [
  1.5,   /* W between A and S */
  4.5,   /* E between S and D */
  10.5,  /* T between F and G */
  13.5,  /* Y between G and H */
  16.5,  /* U between H and J */
  22.5,  /* O between K and L */
]

const DRAG_KEY_DATA = "chop-pad-key"

interface ChopPadsProps {
  chops: Chop[]
  onPadKeyPress: (key: string) => void
  onRemoveChop: (key: string) => void
  onSwapChops: (keyA: string, keyB: string) => void
  pressedKey: string | null
}

export default function ChopPads({ chops, onPadKeyPress, onRemoveChop, onSwapChops, pressedKey }: ChopPadsProps) {
  const chopByKey = new Map(chops.map((c) => [c.key, c]))

  const handleDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData(DRAG_KEY_DATA, key)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault()
    const dragKey = e.dataTransfer.getData(DRAG_KEY_DATA)
    if (!dragKey || dragKey === targetKey) return
    if (chopByKey.has(dragKey) && chopByKey.has(targetKey)) {
      onSwapChops(dragKey, targetKey)
    }
  }

  const pad = (key: string) => {
    const chop = chopByKey.get(key)
    const isActive = !!chop
    const isPressed = pressedKey === key
    const color = chop?.color ?? KEY_COLORS[key] ?? "#888"
    return (
      <button
        key={key}
        type="button"
        draggable={isActive}
        onDragStart={(e) => isActive && handleDragStart(e, key)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, key)}
        onClick={(e) => {
          if (e.shiftKey && chop) {
            onRemoveChop(key)
          } else if (chop) {
            onPadKeyPress(key)
          }
        }}
        className={`kb-key flex h-full w-full min-h-9 min-w-9 items-center justify-center rounded-xl font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 border-2 ${isActive ? "has-chop cursor-grab active:cursor-grabbing" : ""}`}
        style={
          isActive
            ? {
                background: color,
                color: "#fff",
                borderColor: isPressed ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.15)",
                boxShadow: isPressed ? "0 0 0 3px rgba(255,255,255,0.6), 0 1px 2px rgba(0,0,0,0.1)" : "0 1px 2px rgba(0,0,0,0.1)",
                transform: isPressed ? "scale(1.08)" : undefined,
              }
            : {
                background: "#e8e6e3",
                color: "#9a9590",
                borderColor: "rgba(0,0,0,0.08)",
              }
        }
        aria-label={isActive ? `Chop ${key} at ${chop?.time.toFixed(1)}s (shift+click to clear, drag to swap)` : `Key ${key} (no chop)`}
      >
        {key}
      </button>
    )
  }

  const keySize = "2.5rem"
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Top row: each key positioned so it’s centered between the two bottom keys below it */}
      <div
        className="relative flex"
        style={{ width: `${CHOP_KEYBOARD_WIDTH_REM}rem`, height: keySize }}
      >
        {ROW_1.map((key, i) => (
          <div
            key={key}
            className="absolute top-0"
            style={{ left: `${TOP_LEFT_REM[i]}rem`, width: `${KEY_W}rem`, height: keySize }}
          >
            {pad(key)}
          </div>
        ))}
      </div>
      {/* Bottom row: A S D F G H J K L — same key size and gap as top-row math */}
      <div
        className="flex justify-center"
        style={{ gap: `${GAP}rem`, width: `${CHOP_KEYBOARD_WIDTH_REM}rem` }}
      >
        {ROW_2.map((key) => (
          <div key={key} style={{ width: `${KEY_W}rem`, height: keySize }}>
            {pad(key)}
          </div>
        ))}
      </div>
    </div>
  )
}
