import type { PluginId } from "@/lib/plugins"
import styles from "./plugin-glyph.module.css"

// Each plugin's mark is drawn from what its DSP actually does, so the rail reads
// as three running plugins rather than three coloured dots.
const PATHS: Record<PluginId, string[]> = {
  // A stepped gate — what shft's 16-step sequencer draws.
  shft: ["M0 13 V7 H3 V13 H6 V4 H9 V13 H12 V9 H16"],
  // Scanlines with a dropout tearing the middle one.
  drft: ["M0 4 H16", "M0 8 H6", "M9 9 H16", "M0 13 H16"],
  // A resonant peak and its rolloff — what fltr's hero display draws.
  fltr: ["M0 11 H5 C7 11 7.4 3 9 3 C10.6 3 11 11 16 13"],
}

export default function PluginGlyph({
  id,
  size = 16,
  animate = false,
  className = "",
}: {
  id: PluginId
  size?: number
  animate?: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      className={`${styles.glyph} ${styles[id]} ${animate ? styles.animate : ""} ${className}`}
    >
      {PATHS[id].map((d) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      ))}
    </svg>
  )
}
