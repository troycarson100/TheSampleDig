"use client"

import { useState, useRef, useEffect } from "react"
import { DIG_HOW_TO_SECTIONS, DIG_KEY_COMMANDS } from "@/data/dig-how-to"

export default function DigHowToPopover() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition hover:opacity-80"
        style={{
          background: "var(--muted-light)",
          color: "var(--muted)",
          border: "1px solid var(--border)",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: "14px",
          fontWeight: 600,
        }}
        aria-label="How to use"
        aria-expanded={open}
      >
        i
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="How to use the dig page"
          className="absolute right-0 top-full z-[600] mt-2 w-[min(340px,calc(100vw-32px))] rounded-lg shadow-xl py-4 px-4 overflow-y-auto max-h-[min(75vh,520px)]"
          style={{
            background: "rgba(14, 12, 10, 0.98)",
            border: "1px solid rgba(240, 235, 225, 0.12)",
            color: "var(--cream)",
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b" style={{ borderColor: "rgba(240,235,225,0.15)" }}>
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace" }}>
              How to use
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:opacity-70 transition"
              aria-label="Close"
            >
              <svg className="w-4 h-4" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-4 text-sm" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
            <section>
              <h4 className="font-semibold text-white/95 mb-1.5">Key commands</h4>
              <ul className="space-y-1.5">
                {DIG_KEY_COMMANDS.map((cmd, i) => (
                  <li key={i} className="flex items-start gap-2">
                    {cmd.keys ? (
                      <>
                        <kbd className="shrink-0 px-1.5 py-0.5 rounded text-xs font-mono bg-white/10 text-white/90" style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace" }}>
                          {cmd.keys}
                        </kbd>
                        <span className="text-white/75">{cmd.description}</span>
                      </>
                    ) : (
                      <span className="text-white/75">{cmd.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            {DIG_HOW_TO_SECTIONS.map((section) => (
              <section key={section.title}>
                <h4 className="font-semibold text-white/95 mb-1.5">{section.title}</h4>
                <ul className="list-disc list-inside space-y-1 text-white/75">
                  {section.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
