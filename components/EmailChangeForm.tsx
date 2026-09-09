"use client"

import { useState } from "react"

const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none w-full"
const fieldStyle = {
  borderColor: "var(--border)",
  color: "var(--foreground)",
  background: "rgba(255, 255, 255, 0.45)",
}
const btnCls =
  "rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer mt-3"
const btnStyle = { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }

/**
 * Ask to move the account to a different address. Used from /settings (where
 * the NextAuth session authorises it) and from /thanks (where `sessionId`, the
 * Stripe checkout id, does).
 *
 * Nothing changes when this succeeds - a confirmation link goes to the new
 * address - so the success copy says to go and check that inbox rather than
 * implying the account has already moved.
 */
export default function EmailChangeForm({
  currentEmail,
  sessionId,
  compact = false,
}: {
  currentEmail: string
  sessionId?: string
  compact?: boolean
}) {
  const [newEmail, setNewEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function submit() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/user/email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, ...(sessionId ? { sessionId } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not send the confirmation.")
      setSentTo(newEmail.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the confirmation.")
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <p
        className={`rounded-lg border px-3 py-2 text-sm ${compact ? "" : "mt-2"}`}
        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
      >
        Check <strong>{sentTo}</strong> for a link to confirm the change. Until you open it,
        this account stays on {currentEmail}.
      </p>
    )
  }

  return (
    <div className={compact ? "" : "mt-3"}>
      <input
        className={inputCls}
        style={fieldStyle}
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        aria-label="New email address"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy && newEmail.trim()) submit()
        }}
      />
      {error ? (
        <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <button className={btnCls} style={btnStyle} disabled={busy || !newEmail.trim()} onClick={submit}>
        {busy ? "Sending..." : "Send confirmation"}
      </button>
    </div>
  )
}
