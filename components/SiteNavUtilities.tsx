"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useGoProModal } from "@/components/GoProModalContext"

function IconShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function IconCookie({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
      <path d="M8.5 8h.01" />
      <path d="M16 11h.01" />
      <path d="M12 16h.01" />
      <path d="M9 13h.01" />
    </svg>
  )
}

function IconDocument({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  )
}

function IconPriceTag({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconGear({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export const SITE_SETTINGS_MENU_ITEMS = [
  { href: "/privacy", label: "Privacy Policy", Icon: IconShieldCheck },
  { href: "/cookies", label: "Cookie Policy", Icon: IconCookie },
  { href: "/terms", label: "Terms of Service", Icon: IconDocument },
  { href: "/pro", label: "Pricing", Icon: IconPriceTag },
  { href: "/settings", label: "Settings", Icon: IconGear },
] as const

const iconBtnClass =
  "flex items-center justify-center w-10 h-10 rounded-lg shrink-0 touch-manipulation transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(240,235,225,0.35)]"

/** Gear opens dropdown: legal, pricing, settings hub */
export function SiteSettingsMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { openProModal } = useGoProModal()
  const { data: session } = useSession()
  const isProSubscriber = session?.user?.isPro === true

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
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

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className={iconBtnClass}
        style={{ color: "var(--cream)" }}
        aria-label="Site menu"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Settings & legal"
        onClick={() => setOpen((o) => !o)}
      >
        <IconGear />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full mt-1.5 min-w-[min(100vw-2rem,17rem)] rounded-lg border py-1.5 shadow-lg"
          style={{
            zIndex: 502,
            background: "var(--nav-bg, rgba(14, 12, 10, 0.98))",
            borderColor: "rgba(201, 147, 58, 0.15)",
            backdropFilter: "blur(20px)",
          }}
          role="menu"
          aria-label="Site links"
        >
          {SITE_SETTINGS_MENU_ITEMS.map(({ href, label, Icon }) =>
            href === "/pro" ? (
              isProSubscriber ? (
                <Link
                  key={href}
                  href="/pro"
                  role="menuitem"
                  className="flex items-center gap-3 px-3.5 py-2.5 text-[13px] no-underline transition-colors hover:bg-white/6"
                  style={{ color: "var(--cream)", fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace" }}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="shrink-0 opacity-85" />
                  <span>{label}</span>
                </Link>
              ) : (
                <button
                  key={href}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-[13px] text-left transition-colors hover:bg-white/6 border-0 cursor-pointer"
                  style={{ color: "var(--cream)", fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", background: "transparent" }}
                  onClick={() => {
                    setOpen(false)
                    openProModal()
                  }}
                >
                  <Icon className="shrink-0 opacity-85" />
                  <span>{label}</span>
                </button>
              )
            ) : (
              <Link
                key={href}
                href={href}
                role="menuitem"
                className="flex items-center gap-3 px-3.5 py-2.5 text-[13px] no-underline transition-colors hover:bg-white/6"
                style={{ color: "var(--cream)", fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace" }}
                onClick={() => setOpen(false)}
              >
                <Icon className="shrink-0 opacity-85" />
                <span>{label}</span>
              </Link>
            )
          )}
        </div>
      ) : null}
    </div>
  )
}
