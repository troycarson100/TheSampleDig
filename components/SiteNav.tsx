"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"

const navLinkBase = "text-[15px] text-[var(--foreground)]/90 hover:text-[var(--foreground)] transition-colors"
const navLinkStyle = { fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }
// Bold on hover; invisible bold copy reserves width so text doesn't shift
function NavLinkText({ children }: { children: string }) {
  return (
    <span className="relative inline-block">
      <span className="font-bold invisible" aria-hidden="true">{children}</span>
      <span className="absolute left-0 top-0 font-medium hover:font-bold transition-[font-weight]">{children}</span>
    </span>
  )
}

export default function SiteNav() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <nav className="grid grid-cols-3 items-center w-full gap-4 py-4">
        {/* Left: hamburger on mobile, links on desktop */}
        <div className="flex items-center min-w-0">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg -ml-2"
            style={{ color: "var(--foreground)" }}
            aria-label="Open menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="hidden md:flex gap-8">
            <Link href="/dig" className={navLinkBase} style={navLinkStyle}>
              <NavLinkText>Dig</NavLinkText>
            </Link>
            <Link href="/stem-splitter" className={navLinkBase} style={navLinkStyle}>
              <NavLinkText>Stem Splitter</NavLinkText>
            </Link>
            {session && (
              <Link href="/profile" className={navLinkBase} style={navLinkStyle}>
                <NavLinkText>My Samples</NavLinkText>
              </Link>
            )}
          </div>
        </div>
        <Link href="/dig" className="flex items-center justify-center" aria-label="Sample Roll – Home">
          <Image
            src="/sample-roll-logo.svg"
            alt="Sample Roll"
            width={445}
            height={146}
            className="h-[52px] sm:h-[60px] w-auto object-contain"
            priority
          />
        </Link>
        <div className="flex justify-end">
          {session ? (
            <Link
              href="/api/auth/signout"
              className="px-5 py-2 rounded-[var(--radius-button)] bg-[var(--primary)] text-[var(--primary-foreground)] text-[15px] font-medium hover:opacity-90 transition"
              style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              Sign out
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-5 py-2 rounded-[var(--radius-button)] bg-[var(--primary)] text-[var(--primary-foreground)] text-[15px] font-medium hover:opacity-90 transition"
              style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              Login
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
              <Link href="/dig" className={`${navLinkBase} block py-3`} style={navLinkStyle} onClick={() => setMenuOpen(false)}>
                <NavLinkText>Dig</NavLinkText>
              </Link>
              <Link href="/stem-splitter" className={`${navLinkBase} block py-3`} style={navLinkStyle} onClick={() => setMenuOpen(false)}>
                <NavLinkText>Stem Splitter</NavLinkText>
              </Link>
              {session && (
                <Link href="/profile" className={`${navLinkBase} block py-3`} style={navLinkStyle} onClick={() => setMenuOpen(false)}>
                  <NavLinkText>My Samples</NavLinkText>
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
