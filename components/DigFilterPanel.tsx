"use client"

import { useEffect, useRef } from "react"
import type { GenreOption } from "@/components/GenreSelect"

export interface DigFilterPanelProps {
  open: boolean
  onOpen: () => void
  onClose: () => void
  // Toggles
  autoplay: boolean
  onAutoplayChange: (v: boolean) => void
  drumBreak: boolean
  onDrumBreakChange: (v: boolean) => void
  randomStartTime: boolean
  onRandomStartTimeChange: (v: boolean) => void
  // Dropdowns
  genreFilter: string
  onGenreChange: (v: string) => void
  genreOptions: GenreOption[]
  eraFilter: string
  onEraChange: (v: string) => void
  eraOptions: GenreOption[]
  samplePacks: boolean
  onReset: () => void
}

function FilterToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-3 px-1 rounded transition hover:opacity-80"
      style={{ background: "transparent", color: "var(--foreground)" }}
    >
      <span
        className="text-sm font-medium uppercase tracking-wider"
        style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "10px", letterSpacing: "0.12em" }}
      >
        {label}
      </span>
      <div
        className="relative shrink-0 rounded-full transition-colors"
        style={{
          width: 40,
          height: 22,
          background: checked ? "var(--primary)" : "var(--muted)",
          opacity: checked ? 1 : 0.55,
        }}
      >
        <div
          className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "translateX(0)" }}
        />
      </div>
    </button>
  )
}

function NativeSelect({
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: GenreOption[]
  ariaLabel: string
  disabled?: boolean
}) {
  return (
    <div className="relative w-full" style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="w-full appearance-none rounded-md py-2.5 pl-4 pr-9 text-sm border transition"
        style={{
          fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
          fontSize: "10px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 500,
          background: "rgba(240, 235, 225, 0.06)",
          border: "1px solid rgba(240, 235, 225, 0.12)",
          color: "var(--foreground)",
          cursor: "pointer",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value || "any"} value={opt.value} style={{ background: "#1a1209" }}>
            {opt.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--muted)" }}
      >
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </span>
    </div>
  )
}

/** Count of active (non-default) filters for badge display */
function countActiveFilters({
  genreFilter,
  eraFilter,
  drumBreak,
  randomStartTime,
}: Pick<DigFilterPanelProps, "genreFilter" | "eraFilter" | "drumBreak" | "randomStartTime">) {
  let n = 0
  if (genreFilter) n++
  if (eraFilter) n++
  if (drumBreak) n++
  if (!randomStartTime) n++
  return n
}

export default function DigFilterPanel({
  open,
  onOpen,
  onClose,
  autoplay,
  onAutoplayChange,
  drumBreak,
  onDrumBreakChange,
  randomStartTime,
  onRandomStartTimeChange,
  genreFilter,
  onGenreChange,
  genreOptions,
  eraFilter,
  onEraChange,
  eraOptions,
  samplePacks,
  onReset,
}: DigFilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const activeCount = countActiveFilters({ genreFilter, eraFilter, drumBreak, randomStartTime })

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [open, onClose])

  // Trap scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open filters"
        aria-expanded={open}
        className="relative flex items-center gap-2 rounded-lg transition hover:opacity-80"
        style={{
          background: open || activeCount > 0 ? "var(--primary)" : "var(--muted-light)",
          color: open || activeCount > 0 ? "var(--primary-foreground)" : "var(--foreground)",
          border: "1px solid",
          borderColor: open || activeCount > 0 ? "var(--primary)" : "var(--border)",
          padding: "10px 14px",
          fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {/* Sliders icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="9" cy="6" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="10" cy="18" r="2.5" fill="currentColor" stroke="none" />
        </svg>
        <span>Filters</span>
        {/* Active count badge */}
        {activeCount > 0 && !open && (
          <span
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold leading-none"
            style={{ background: "var(--foreground)", color: "var(--background)" }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[650] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          role="dialog"
          aria-modal="true"
          aria-label="Dig filters"
        >
          <div
            ref={panelRef}
            className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              maxHeight: "90dvh",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <h2
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", letterSpacing: "0.14em" }}
              >
                Filters
              </h2>
              <div className="flex items-center gap-2">
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="text-xs px-3 py-1.5 rounded-md transition hover:opacity-80"
                    style={{
                      fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
                      fontSize: "9px",
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      background: "var(--muted-light)",
                      color: "var(--muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:opacity-70"
                  style={{ background: "var(--muted-light)", color: "var(--foreground)" }}
                  aria-label="Close filters"
                >
                  <svg className="w-4 h-4" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 py-2">
              {/* Toggles section */}
              <div className="mb-1">
                <p
                  className="text-xs uppercase tracking-wider mb-1 pt-3"
                  style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "9px", letterSpacing: "0.14em", color: "var(--muted)" }}
                >
                  Playback
                </p>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  <FilterToggleRow label="Auto-Play" checked={autoplay} onChange={onAutoplayChange} />
                  <FilterToggleRow label="Drum Break" checked={drumBreak} onChange={onDrumBreakChange} />
                  <FilterToggleRow label="Random Start Time" checked={randomStartTime} onChange={onRandomStartTimeChange} />
                </div>
              </div>

              {/* Genre section */}
              <div className="mb-1 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <p
                  className="text-xs uppercase tracking-wider mb-2 pt-3"
                  style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "9px", letterSpacing: "0.14em", color: "var(--muted)" }}
                >
                  Genre
                </p>
                <NativeSelect
                  value={genreFilter}
                  onChange={onGenreChange}
                  options={genreOptions}
                  ariaLabel="Filter by genre"
                />
              </div>

              {/* Era section */}
              <div className="mb-1 pt-4 pb-2">
                <p
                  className="text-xs uppercase tracking-wider mb-2"
                  style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "9px", letterSpacing: "0.14em", color: "var(--muted)" }}
                >
                  Era
                </p>
                <NativeSelect
                  value={eraFilter}
                  onChange={onEraChange}
                  options={eraOptions}
                  ariaLabel="Filter by era"
                  disabled={samplePacks}
                />
                {samplePacks && (
                  <p className="text-xs mt-1.5" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "9px" }}>
                    Era filter disabled in sample packs mode
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-4 border-t shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-lg text-sm font-medium transition hover:opacity-90"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
