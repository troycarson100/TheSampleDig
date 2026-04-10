"use client"

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import { createPortal } from "react-dom"

export interface GenreOption {
  value: string
  label: string
}

/** Above filter modal overlay (z-650) and site chrome */
const LIST_Z = 10070

interface GenreSelectProps {
  value: string
  onChange: (value: string) => void
  options: GenreOption[]
  ariaLabel?: string
  className?: string
  /** When true, dropdown is inert (e.g. era filter disabled in sample packs mode). */
  disabled?: boolean
}

export default function GenreSelect(props: GenreSelectProps) {
  const { value, onChange, options, ariaLabel = "Filter samples by genre", className = "", disabled = false } = props
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null)
  const selected = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => setMounted(true), [])

  const updateMenuPosition = useCallback(() => {
    if (!open || !buttonRef.current) return
    const r = buttonRef.current.getBoundingClientRect()
    const gap = 6
    const spaceBelow = window.innerHeight - r.bottom - gap - 12
    const maxH = Math.min(320, Math.max(120, spaceBelow))
    setMenuPos({
      top: r.bottom + gap,
      left: r.left,
      width: r.width,
      maxH,
    })
  }, [open])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPosition()
    window.addEventListener("resize", updateMenuPosition)
    window.addEventListener("scroll", updateMenuPosition, true)
    return () => {
      window.removeEventListener("resize", updateMenuPosition)
      window.removeEventListener("scroll", updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      const t = e.target as Node
      if (buttonRef.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const listContent = (
    <>
      {options.map((opt) => {
        const isSelected = opt.value === value
        return (
          <li
            key={opt.value || "any"}
            role="option"
            aria-selected={isSelected}
            className="flex items-center gap-2 px-3 cursor-pointer h-10 box-border transition-colors duration-100"
            style={{
              fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
              fontSize: "9px",
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              lineHeight: 1,
              color: isSelected ? "var(--primary-foreground)" : "var(--foreground)",
              background: isSelected ? "var(--primary)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--muted-light)"
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
            <span
              className="w-4 h-4 shrink-0 flex items-center justify-center"
              style={{ color: isSelected ? "var(--primary-foreground)" : "transparent" }}
            >
              {isSelected && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span
              className="flex-1 flex items-center justify-start leading-[1] h-full truncate"
              style={{ lineHeight: 1, color: isSelected ? "var(--primary-foreground)" : "var(--foreground)" }}
            >
              {opt.label}
            </span>
          </li>
        )
      })}
    </>
  )

  const listEl =
    open && !disabled && mounted && menuPos ? (
      <ul
        ref={listRef}
        role="listbox"
        className="overflow-y-auto rounded-lg py-1"
        style={{
          position: "fixed",
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          maxHeight: menuPos.maxH,
          zIndex: LIST_Z,
          background: "var(--background)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
          boxShadow: "0 12px 40px rgba(44, 31, 20, 0.12), 0 0 0 1px rgba(74, 55, 40, 0.06)",
        }}
      >
        {listContent}
      </ul>
    ) : null

  return (
    <div ref={containerRef} className={"relative " + className} style={{ opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className="genre-select w-full min-w-[140px] rounded-lg border flex items-center justify-between gap-2 text-left transition-[border-color,box-shadow] duration-150 disabled:cursor-not-allowed"
        style={{
          fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
          fontSize: "9px",
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          background: "var(--muted-light)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
          padding: "10px 32px 10px 14px",
          boxShadow: open ? "0 0 0 1px rgba(14, 12, 10, 0.12)" : "none",
        }}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-disabled={disabled}
      >
        <span className="truncate">{selected?.label ?? "Any genre"}</span>
        <span className="pointer-events-none shrink-0" style={{ color: "var(--muted)" }}>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M1 1l4 4 4-4" />
          </svg>
        </span>
      </button>
      {mounted && listEl ? createPortal(listEl, document.body) : null}
    </div>
  )
}
