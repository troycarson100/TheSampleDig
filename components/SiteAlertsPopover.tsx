"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { SITE_ALERTS, type SiteAlert } from "@/lib/site-alerts"
import { dismissAlertId, readDismissedAlertIds, OPEN_ALERTS_EVENT } from "@/lib/dismissed-alerts"

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

const iconBtnClass =
  "relative flex items-center justify-center w-10 h-10 rounded-lg shrink-0 touch-manipulation transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(240,235,225,0.35)]"

function sortAlerts(a: SiteAlert, b: SiteAlert) {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
}

/**
 * Bell opens a dropdown of dismissible alerts (data: lib/site-alerts.ts).
 * Dismissals persist in localStorage. Mobile drawer opens the same panel via OPEN_ALERTS_EVENT.
 */
export default function SiteAlertsPopover() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>([])
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const refreshDismissed = useCallback(() => {
    setDismissed(readDismissedAlertIds())
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    refreshDismissed()
  }, [refreshDismissed])

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_ALERTS_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_ALERTS_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t)) return
      if (buttonRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const visible = SITE_ALERTS.filter((a) => !dismissed.includes(a.id)).sort(sortAlerts)
  const hasUnread = visible.length > 0

  const handleDismiss = (id: string) => {
    dismissAlertId(id)
    refreshDismissed()
  }

  const panel = open && mounted && (
    <div
      ref={rootRef}
      className="fixed w-[min(calc(100vw-1.5rem),20rem)] max-h-[min(70vh,420px)] overflow-y-auto rounded-lg border shadow-lg flex flex-col"
      style={{
        zIndex: 10002,
        top: "calc(56px + 8px)",
        right: "max(16px, env(safe-area-inset-right, 0px))",
        background: "var(--nav-bg, rgba(14, 12, 10, 0.98))",
        borderColor: "rgba(201, 147, 58, 0.15)",
        backdropFilter: "blur(20px)",
      }}
      role="dialog"
      aria-label="Alerts"
    >
      <div className="px-3 py-2 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <p
          className="text-[10px] uppercase tracking-widest"
          style={{ color: "rgba(245,240,232,0.55)", fontFamily: "var(--font-ibm-mono), monospace" }}
        >
          Alerts
        </p>
      </div>
      {visible.length === 0 ? (
        <p className="px-3 py-6 text-sm text-center" style={{ color: "rgba(245,240,232,0.45)" }}>
          You&apos;re all caught up.
        </p>
      ) : (
        <ul className="list-none m-0 p-0">
          {visible.map((alert) => (
            <li
              key={alert.id}
              className="flex items-start gap-1 border-b last:border-0"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <div className="flex-1 min-w-0 px-3 py-3">
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: "#f5f0e8", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                >
                  {alert.title}
                </p>
                {alert.body ? (
                  <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "rgba(245,240,232,0.65)" }}>
                    {alert.body}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 flex items-center justify-center px-2 py-1 mt-1 mr-1 text-lg font-light leading-none transition-colors text-[#F0EBE1] hover:text-[#B85C38]"
                style={{ fontFamily: "system-ui, sans-serif" }}
                aria-label={`Dismiss: ${alert.title}`}
                onClick={() => handleDismiss(alert.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <>
      <div className="relative shrink-0">
        <button
          ref={buttonRef}
          type="button"
          className={iconBtnClass}
          style={{ color: "var(--cream)" }}
          aria-label="Alerts"
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Alerts"
          onClick={() => setOpen((o) => !o)}
        >
          <IconBell />
          {hasUnread ? (
            <span
              className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
              style={{ background: "var(--rust, #b85c38)" }}
              aria-hidden
            />
          ) : null}
        </button>
      </div>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  )
}
