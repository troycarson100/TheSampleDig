"use client"

import { useState } from "react"

const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none w-full"
const btnCls =
  "rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer mt-3"
const fieldStyle = {
  borderColor: "var(--border)",
  color: "var(--foreground)",
  background: "rgba(255, 255, 255, 0.45)",
}
const primaryBtnStyle = { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }

export default function LostKeyForm() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/plugins/resend-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.")
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
        If we have a purchase for that address, the receipt is on its way. Check spam if it
        doesn&apos;t show up in a few minutes.
      </p>
    )
  }

  return (
    <div>
      <input
        className={inputCls}
        style={fieldStyle}
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy && email.trim()) submit()
        }}
      />
      {error ? (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <button className={btnCls} style={primaryBtnStyle} disabled={busy || !email.trim()} onClick={submit}>
        {busy ? "Sending..." : "Resend my receipt"}
      </button>
    </div>
  )
}
