"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"

const cardClass =
  "rounded-lg border px-4 py-4 flex flex-col gap-3"
const btnClass =
  "inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"

export default function SettingsSubscriptionManage() {
  const { data: session, status } = useSession()
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/stripe/billing-portal")
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { eligible?: boolean }
        if (!cancelled) setEligible(data.eligible === true)
      } catch {
        if (!cancelled) setEligible(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status])

  const openPortal = useCallback(async () => {
    setError("")
    setLoadingPortal(true)
    try {
      const res = await fetch("/api/stripe/billing-portal", { method: "POST" })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        setError(data.error || "Could not open billing portal.")
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setError("No portal URL returned.")
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setLoadingPortal(false)
    }
  }, [])

  if (status === "loading") {
    return null
  }

  if (status !== "authenticated") {
    return null
  }

  return (
    <div className={cardClass} style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.02)" }}>
      <div>
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
          Subscription & billing
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
          Cancel your plan or trial anytime, update your card, or download invoices. You’ll be sent to a secure Stripe page.
        </p>
      </div>

      {eligible === null ? (
        <p className="text-xs" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
          Loading…
        </p>
      ) : eligible ? (
        <>
          <button
            type="button"
            className={btnClass}
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground)",
              background: "transparent",
              alignSelf: "flex-start",
            }}
            onClick={openPortal}
            disabled={loadingPortal}
          >
            {loadingPortal ? "Opening…" : "Manage or cancel subscription"}
          </button>
          {error ? (
            <p className="text-xs" style={{ color: "#b91c1c", fontFamily: "var(--font-ibm-mono), monospace" }}>
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
          After you subscribe, you can manage or cancel here.{" "}
          <Link href="/pro" className="underline" style={{ color: "var(--foreground)" }}>
            Pricing & Pro
          </Link>
        </p>
      )}
    </div>
  )
}
