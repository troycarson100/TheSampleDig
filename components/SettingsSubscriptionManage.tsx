"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"

/** Public Stripe Customer Portal entry (email magic link). Override via env if Stripe gives you a new link. */
const DEFAULT_STRIPE_PORTAL_LOGIN_URL = "https://billing.stripe.com/p/login/8x29AV6Ht94eebgdV22ZO00"

const linkClass =
  "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 w-full text-left no-underline transition hover:opacity-90"
const btnClass =
  `${linkClass} cursor-pointer font-[inherit]`

function portalLoginUrl() {
  return (
    process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_LOGIN_URL?.trim() || DEFAULT_STRIPE_PORTAL_LOGIN_URL
  )
}

export default function SettingsSubscriptionManage() {
  const { data: session, status } = useSession()
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (status !== "authenticated") {
      setEligible(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/stripe/billing-portal")
        if (cancelled) return
        if (!res.ok) {
          setEligible(false)
          return
        }
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

  const stripeUrl = portalLoginUrl()

  if (status === "loading") {
    return (
      <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
          Loading billing…
        </p>
      </div>
    )
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm mb-2" style={{ color: "var(--muted)" }}>
            Sign in to open billing with one click. You can still use Stripe’s portal below with your account email.
          </p>
          <Link href="/login?callbackUrl=/settings" className="text-sm font-medium underline" style={{ color: "var(--foreground)" }}>
            Sign in
          </Link>
        </div>
        <a
          href={stripeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <span style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Manage billing on Stripe</span>
          <span aria-hidden className="text-lg opacity-50">
            →
          </span>
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-0.5">
        <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
          Billing
        </p>
        <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
          Cancel or change your plan (including during a trial), update your card, or download invoices.
        </p>
      </div>

      {eligible === null ? (
        <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
            Checking billing…
          </p>
        </div>
      ) : eligible ? (
        <button
          type="button"
          className={btnClass}
          style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "transparent" }}
          onClick={openPortal}
          disabled={loadingPortal}
        >
          <span style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
            {loadingPortal ? "Opening…" : "Manage or cancel subscription"}
          </span>
          <span aria-hidden className="text-lg opacity-50">
            →
          </span>
        </button>
      ) : (
        <a
          href={stripeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <span style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Manage billing on Stripe</span>
          <span aria-hidden className="text-lg opacity-50">
            →
          </span>
        </a>
      )}

      {eligible === true ? (
        <p className="text-xs pl-0.5" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
          Or open Stripe’s portal with your email:{" "}
          <a href={stripeUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--foreground)" }}>
            billing.stripe.com
          </a>
        </p>
      ) : null}

      {error ? (
        <p className="text-xs" style={{ color: "#b91c1c", fontFamily: "var(--font-ibm-mono), monospace" }}>
          {error}{" "}
          <a href={stripeUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--foreground)" }}>
            Open Stripe instead
          </a>
        </p>
      ) : null}
    </div>
  )
}
