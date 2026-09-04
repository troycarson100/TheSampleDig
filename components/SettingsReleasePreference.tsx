"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

// Sibling of SettingsMarketingPreference, deliberately a separate control
// rather than a second checkbox inside it: release emails require BOTH flags
// (see the productUpdateOptIn comment in schema.prisma), and an unsubscribe
// link that lands on a merged toggle would turn off more than the recipient
// asked for. Kept as its own component rather than generalising the existing
// one, which reads its initial value from the session and this does not.
export default function SettingsReleasePreference() {
  const { status } = useSession()
  const [optIn, setOptIn] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/user/marketing-preferences")
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { productUpdateOptIn?: boolean }
        if (typeof data.productUpdateOptIn === "boolean") setOptIn(data.productUpdateOptIn)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status])

  const onToggle = async (next: boolean) => {
    setError("")
    setLoading(true)
    setOptIn(next)
    try {
      const res = await fetch("/api/user/marketing-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productUpdateOptIn: next }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Could not save")
      }
    } catch (e) {
      setOptIn(!next)
      setError(e instanceof Error ? e.message : "Could not save")
    } finally {
      setLoading(false)
    }
  }

  if (status !== "authenticated") return null

  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
          >
            New version alerts
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
            One email when a plugin you own ships an update, with what changed. Nothing else. Only sent
            while Email updates is on. Receipts, licence keys and password resets are sent either way.
          </p>
          {error ? (
            <p className="text-xs mt-2" style={{ color: "#b91c1c" }}>
              {error}
            </p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 shrink-0 cursor-pointer">
          <span className="text-xs sr-only">Email me when a plugin I own is updated</span>
          <input
            type="checkbox"
            checked={optIn}
            disabled={loading}
            onChange={(e) => onToggle(e.target.checked)}
            className="rounded border w-4 h-4 shrink-0"
            style={{ accentColor: "var(--primary)" }}
          />
        </label>
      </div>
    </div>
  )
}
