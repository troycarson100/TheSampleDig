"use client"

import Link from "next/link"
import { useConsent } from "./ConsentProvider"

/**
 * Bottom bar. In a notice region the pixel is already loaded and this is
 * informational; in a strict region nothing non-essential loads until Accept.
 */
export default function CookieBanner() {
  const { showBanner, region, accept, reject } = useConsent()
  if (!showBanner) return null

  const strict = region === "strict"

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie notice"
      className="fixed bottom-0 left-0 right-0 z-50 border-t px-4 py-3"
      style={{
        background: "var(--background)",
        borderColor: "var(--border, rgba(255,255,255,0.15))",
        color: "var(--foreground)",
      }}
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm flex-1">
          We use cookies to keep you signed in and to understand how people find us.{" "}
          <Link href="/cookies" className="underline" style={{ color: "var(--primary)" }}>
            Cookie Policy
          </Link>{" "}
          &middot;{" "}
          <Link href="/privacy" className="underline" style={{ color: "var(--primary)" }}>
            Privacy
          </Link>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {strict && (
            <button
              type="button"
              onClick={reject}
              className="text-sm px-3 py-1.5 rounded border"
              style={{ borderColor: "var(--primary)", color: "var(--foreground)" }}
            >
              Reject
            </button>
          )}
          <button
            type="button"
            onClick={accept}
            className="text-sm px-3 py-1.5 rounded font-medium"
            style={{ background: "var(--primary)", color: "var(--background)" }}
          >
            {strict ? "Accept" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  )
}
