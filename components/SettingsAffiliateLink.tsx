"use client"

import Link from "next/link"
import { useIsAffiliate } from "@/lib/use-is-affiliate"

const linkClass =
  "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 no-underline transition hover:opacity-90"

// Settings row that appears only when the signed-in account is an invited affiliate.
export default function SettingsAffiliateLink() {
  const isAffiliate = useIsAffiliate()
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
