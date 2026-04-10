"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"

export default function SettingsMarketingPreference() {
  const { data: session, status } = useSession()
  const [optIn, setOptIn] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const syncFromSession = useCallback(() => {
    if (session?.user?.emailMarketingOptIn !== undefined) {
      setOptIn(session.user.emailMarketingOptIn !== false)
    }
  }, [session?.user?.emailMarketingOptIn])

  useEffect(() => {
    syncFromSession()
  }, [syncFromSession])

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/user/marketing-preferences")
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { emailMarketingOptIn?: boolean }
        if (typeof data.emailMarketingOptIn === "boolean") {
          setOptIn(data.emailMarketingOptIn)
        }
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
        body: JSON.stringify({ emailMarketingOptIn: next }),
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

  if (status === "loading") {
    return (
      <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </p>
      </div>
    )
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm mb-2" style={{ color: "var(--muted)" }}>
          Sign in to manage email preferences.
        </p>
        <Link href="/login?callbackUrl=/settings" className="text-sm font-medium underline" style={{ color: "var(--foreground)" }}>
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" style={{ color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
            Email updates
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
            Occasional product news and tips. Turn off to remove yourself from our mailing list (you can turn it back on anytime).
          </p>
          {error ? (
            <p className="text-xs mt-2" style={{ color: "#b91c1c" }}>
              {error}
            </p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 shrink-0 cursor-pointer">
          <span className="text-xs sr-only">Receive occasional email updates</span>
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
