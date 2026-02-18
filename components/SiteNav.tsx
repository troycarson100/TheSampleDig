"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"

const navLinkBase = "nav-tab-link relative flex items-center h-full px-5 py-0 border-none bg-transparent cursor-pointer transition-colors"
const navLinkActive = "nav-link-active"
const navLinkStyle = { fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace" }

export default function SiteNav() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const isActive = (path: string) => pathname === path || (path !== "/dig" && pathname?.startsWith(path))

  return (
    <>
      <nav className="flex items-center justify-between w-full h-full gap-4">
        {/* Left: hamburger on mobile; logo (dice + brand + BETA) always */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded -ml-2 flex-shrink-0"
            style={{ color: "var(--cream)" }}
            aria-label="Open menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Link href="/dig" className="flex items-center gap-2 no-underline shrink-0" aria-label="Sample Roll – Home">
            <Image
              src="/SampleRoll-text.svg"
              alt="Sample Roll"
              width={1384}
              height={279}
              className="h-6 w-auto object-contain"
              priority
            />
            <span className="nav-beta shrink-0">BETA</span>
          </Link>
        </div>
        {/* Center: tabs */}
        <div className="hidden md:flex items-center h-full flex-1 justify-center">
          <Link href="/dig" className={`${navLinkBase} ${isActive("/dig") ? navLinkActive : ""}`} style={navLinkStyle} aria-current={pathname === "/dig" ? "page" : undefined}>
            Dig
          </Link>
          {/* Stem Splitter commented out (site free; no stem-splitting). Set STEM_SPLITTER_ENABLED = true in app/stem-splitter/page.tsx to re-enable, then uncomment these. */}
          {/* <Link href="/stem-splitter" className={`${navLinkBase} ${isActive("/stem-splitter") ? navLinkActive : ""}`} style={navLinkStyle} aria-current={pathname === "/stem-splitter" ? "page" : undefined}>
            Stem Splitter
          </Link> */}
          {session && (
            <Link href="/profile" className={`${navLinkBase} ${isActive("/profile") ? navLinkActive : ""}`} style={navLinkStyle} aria-current={pathname === "/profile" ? "page" : undefined}>
              My Samples
            </Link>
          )}
        </div>
        {/* Right: sign out / sign in */}
        <div className="flex justify-end shrink-0">
          {session ? (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="sign-out-btn cursor-pointer"
            >
              Sign out
            </button>
          ) : (
            <Link href="/login" className="sign-in-btn">
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile menu overlay + drawer from left */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-hidden
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="fixed left-0 top-0 bottom-0 z-50 w-64 max-w-[85vw] py-6 px-4 md:hidden"
            style={{ background: "var(--background)", borderRight: "1px solid var(--border)" }}
            role="dialog"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-end mb-6">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center w-10 h-10 rounded-lg -mr-2"
                style={{ color: "var(--foreground)" }}
                aria-label="Close menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col">
              <Link href="/dig" className={`${navLinkBase} block py-3 !h-auto !px-0 ${pathname === "/dig" ? navLinkActive : ""}`} style={navLinkStyle} onClick={() => setMenuOpen(false)} aria-current={pathname === "/dig" ? "page" : undefined}>
                Dig
              </Link>
              {/* Stem Splitter commented out — see desktop nav */}
              {/* <Link href="/stem-splitter" ...>Stem Splitter</Link> */}
              {session && (
                <Link href="/profile" className={`${navLinkBase} block py-3 !h-auto !px-0 ${pathname === "/profile" ? navLinkActive : ""}`} style={navLinkStyle} onClick={() => setMenuOpen(false)} aria-current={pathname === "/profile" ? "page" : undefined}>
                  My Samples
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
