"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"

const navLinkBase = "nav-tab-link relative flex items-center h-full px-5 py-0 border-none bg-transparent cursor-pointer transition-colors"
const navLinkActive = "nav-link-active"
const navLinkStyle = { fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace" }

/** z-index above header (500), ticker (499), and auth modal (700) so mobile menu always on top */
const MOBILE_MENU_OVERLAY_Z = 10000
const MOBILE_MENU_DRAWER_Z = 10001

export default function SiteNav() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const wasMenuOpenRef = useRef(false)
  const isActive = (path: string) => pathname === path || (path !== "/dig" && pathname?.startsWith(path))

  useEffect(() => setMounted(true), [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  // Focus: close button when opening; hamburger when closing (not on initial mount)
  useEffect(() => {
    if (menuOpen) {
      closeBtnRef.current?.focus()
    } else if (wasMenuOpenRef.current) {
      hamburgerRef.current?.focus({ preventScroll: true })
    }
    wasMenuOpenRef.current = menuOpen
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  // Use current origin so sign-out always redirects to this site (e.g. sampleroll.com), not NEXTAUTH_URL (e.g. stock DO URL)
  const signOutCallbackUrl = typeof window !== "undefined" ? `${window.location.origin}/` : "/"

  return (
    <>
      <nav className="flex items-center justify-between w-full h-full gap-4">
        {/* Left: hamburger on mobile; logo (dice + brand + BETA) always */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded -ml-2 flex-shrink-0 touch-manipulation"
            style={{ color: "var(--cream)" }}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
        {/* Right: Support (always) + Sign out / Sign In (desktop only; mobile has them in drawer) */}
        <div className="flex items-center justify-end shrink-0 gap-2">
          <a
            href="https://www.paypal.com/donate/?hosted_button_id=34ZVX9VFAZ3JC"
            target="_blank"
            rel="noopener noreferrer"
            className="support-btn"
            aria-label="Support us (opens in new tab)"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            Support Us
          </a>
          {session ? (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: signOutCallbackUrl })}
              className="sign-out-btn cursor-pointer hidden md:inline-flex"
            >
              Sign out
            </button>
          ) : (
            <Link href="/login" className="sign-in-btn hidden md:inline-flex">
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile menu: render in portal so it's above genre ticker and header; vinyl theme */}
      {mounted &&
        createPortal(
          <>
            <div
              className="fixed inset-0 md:hidden transition-opacity duration-200"
              style={{
                zIndex: MOBILE_MENU_OVERLAY_Z,
                background: menuOpen ? "rgba(0,0,0,0.5)" : "transparent",
                pointerEvents: menuOpen ? "auto" : "none",
                opacity: menuOpen ? 1 : 0,
              }}
              aria-hidden
              onClick={closeMenu}
            />
            <div
              className="fixed left-0 top-0 bottom-0 w-64 max-w-[85vw] py-6 pl-5 pr-4 md:hidden transition-[transform] duration-200 ease-out flex flex-col"
              style={{
                zIndex: MOBILE_MENU_DRAWER_Z,
                transform: menuOpen ? "translateX(0)" : "translateX(-100%)",
                pointerEvents: menuOpen ? "auto" : "none",
                background: "var(--nav-bg, rgba(14, 12, 10, 0.98))",
                backdropFilter: "blur(var(--nav-blur, 20px))",
                WebkitBackdropFilter: "blur(var(--nav-blur, 20px))",
                borderRight: "1px solid rgba(201, 147, 58, 0.08)",
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              aria-hidden={!menuOpen}
            >
              {/* Header row: close button only */}
              <div className="flex items-center justify-end shrink-0 pt-2 min-h-[52px] mb-6">
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={closeMenu}
                  className="flex items-center justify-center w-10 h-10 rounded touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(240,235,225,0.4)]"
                  style={{ color: "var(--cream)" }}
                  aria-label="Close menu"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
          <div className="flex flex-col items-start gap-1">
            <Link
              href="/dig"
              className={`${navLinkBase} nav-drawer-link inline-block py-3 !h-auto !px-0 ${pathname === "/dig" ? navLinkActive : ""}`}
              style={navLinkStyle}
              onClick={closeMenu}
              aria-current={pathname === "/dig" ? "page" : undefined}
            >
              Dig
            </Link>
            {session && (
              <Link
                href="/profile"
                className={`${navLinkBase} nav-drawer-link inline-block py-3 !h-auto !px-0 ${pathname === "/profile" ? navLinkActive : ""}`}
                style={navLinkStyle}
                onClick={closeMenu}
                aria-current={pathname === "/profile" ? "page" : undefined}
              >
                My Samples
              </Link>
            )}
          </div>
          <div className="mt-8 pt-6 border-t border-[rgba(201,147,58,0.08)]">
            {session ? (
              <button
                type="button"
                onClick={() => {
                  closeMenu()
                  signOut({ callbackUrl: signOutCallbackUrl })
                }}
                className="sign-out-btn w-full flex justify-center"
              >
                Sign out
              </button>
            ) : (
              <Link href="/login" className="sign-in-btn block text-center" onClick={closeMenu}>
                Sign In
              </Link>
            )}
          </div>
        </div>
        </>,
        document.body
      )}
    </>
  )
}
