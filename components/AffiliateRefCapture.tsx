"use client"

import { useEffect } from "react"

// Detects ?ref=<code> on initial page load and reports it so the click is
// counted and the 60-day shft_ref attribution cookie is set. Renders nothing.
// Reads window.location directly to avoid the useSearchParams Suspense
// requirement in the root layout.
export default function AffiliateRefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref")
    if (!ref) return
    fetch("/api/affiliate/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ref }),
    }).catch(() => {})
  }, [])
  return null
}
