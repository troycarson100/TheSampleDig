"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { useGoProModal } from "@/components/GoProModalContext"

const linkClass =
  "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 w-full text-left cursor-pointer transition hover:opacity-90"

export default function SettingsPricingNavButton() {
  const { openProModal } = useGoProModal()
  const { data: session } = useSession()
  const isPro = session?.user?.isPro === true

  if (isPro) {
    return (
      <Link
        href="/pro"
        className={linkClass}
        style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "transparent", textDecoration: "none" }}
      >
        <span style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Pricing & Pro</span>
        <span aria-hidden className="text-lg opacity-50">
          →
        </span>
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={linkClass}
      style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "transparent" }}
      onClick={() => openProModal()}
    >
      <span style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Pricing & Pro</span>
      <span aria-hidden className="text-lg opacity-50">
        →
      </span>
    </button>
  )
}
