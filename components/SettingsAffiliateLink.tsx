"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

const linkClass =
  "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 no-underline transition hover:opacity-90"

// Settings row that appears only for invited affiliates (shares the nav's
// per-tab sessionStorage cache so it costs at most one request per tab).
export default function SettingsAffiliateLink() {
  const [isAffiliate, setIsAffiliate] = useState(
    () => typeof window !== "undefined" && window.sessionStorage.getItem("sr_is_affiliate") === "1"
  )

  useEffect(() => {
    if (sessionStorage.getItem("sr_is_affiliate") !== null) return
    let cancelled = false
    fetch("/api/affiliate/me")
      .then((r) => r.json())
      .then((d) => {
        sessionStorage.setItem("sr_is_affiliate", d.isAffiliate ? "1" : "0")
        if (!cancelled && d.isAffiliate) setIsAffiliate(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!isAffiliate) return null
  return (
    <Link href="/affiliate" className={linkClass} style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
      <span style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Affiliate dashboard</span>
      <span aria-hidden className="text-lg opacity-50">
        →
      </span>
    </Link>
  )
}
