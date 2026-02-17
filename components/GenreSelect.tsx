"use client"

import { useState, useRef, useEffect } from "react"

export interface GenreOption {
  value: string
  label: string
}

interface GenreSelectProps {
  value: string
  onChange: (value: string) => void
  options: GenreOption[]
  ariaLabel?: string
  className?: string
}

export default function GenreSelect(props: GenreSelectProps) {
  const { value, onChange, options, ariaLabel = "Filter samples by genre", className = "" } = props
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <div ref={containerRef} className={"relative " + className}>
      <button
        type="button"
        className="genre-select w-full min-w-[140px] rounded border flex items-center justify-between gap-2 text-left"
        style={{
          fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
          fontSize: "9px",
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          background: "white",
          border: "1px solid rgba(74, 55, 40, 0.12)",
          color: "var(--brown)",
          padding: "10px 32px 10px 14px",
        }}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span>{selected?.label ?? "Any genre"}</span>
        <span className="pointer-events-none shrink-0" style={{ color: "var(--brown)" }}>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M1 1l4 4 4-4" />
          </svg>
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-[600] mt-1 min-w-[140px] max-h-[min(320px,70vh)] overflow-y-auto rounded-md py-1 shadow-lg"
          style={{
            background: "rgba(14, 12, 10, 0.98)",
            border: "1px solid rgba(240, 235, 225, 0.08)",
            color: "#fff",
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <li
                key={opt.value || "any"}
                role="option"
                aria-selected={isSelected}
                className="flex items-center gap-2 px-3 cursor-pointer h-10 box-border"
                style={{
                  fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
                  fontSize: "9px",
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  lineHeight: 1,
                  background: isSelected ? "rgba(240, 235, 225, 0.12)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(240, 235, 225, 0.08)"
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(opt.value)
                  setOpen(false)
                }}
              >
                <span className="w-4 h-4 shrink-0 flex items-center justify-center" style={{ color: isSelected ? "var(--brown)" : "transparent" }}>
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 flex items-center justify-start leading-[1] h-full" style={{ lineHeight: 1 }}>{opt.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
