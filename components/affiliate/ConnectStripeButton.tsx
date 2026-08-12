"use client"

import { useState } from "react"

// Kicks off Stripe Express onboarding and follows the hosted link.
export default function ConnectStripeButton({ token, label }: { token?: string; label: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function connect() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/affiliate/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { token } : {}),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || "Stripe setup is unavailable right now.")
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stripe setup is unavailable right now.")
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={connect}
        disabled={busy}
        className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer"
        style={{ borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }}
      >
        {busy ? "Opening Stripe…" : label}
      </button>
      {error ? (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
