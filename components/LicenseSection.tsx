"use client"

import { useState } from "react"
import { SEAT_LIMIT } from "@/lib/license-activation"

export interface ActivationView {
  id: string
  machineName: string | null
  platform: string | null
  createdAt: string
}

export default function LicenseSection({
  licenseKey,
  activations,
}: {
  licenseKey: string | null
  activations: ActivationView[]
}) {
  const [rows, setRows] = useState(activations)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!licenseKey) return null

  async function copy() {
    await navigator.clipboard.writeText(licenseKey!)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  async function deactivate(id: string) {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch("/api/license/deactivate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activationId: id }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? "Could not deactivate.")
      setRows((r) => r.filter((a) => a.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not deactivate.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-5 pt-5 border-t" style={{ borderColor: "var(--border)" }}>
      <p
        className="text-[13px] font-medium mb-2"
        style={{ color: "var(--foreground)", opacity: 0.7 }}
      >
        Licence key
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <code
          className="text-[15px] tracking-wider rounded-lg px-3 py-2 border"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          {licenseKey}
        </code>
        <button
          onClick={copy}
          className="text-[13px] rounded-lg px-3 py-2 border font-medium"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="text-[13px] mt-4 mb-2" style={{ color: "var(--foreground)", opacity: 0.7 }}>
        Activated machines — {rows.length} of {SEAT_LIMIT}
      </p>

      {rows.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--foreground)", opacity: 0.6 }}>
          Not activated anywhere yet. Paste the key into shft when you first open it.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-[14px]" style={{ color: "var(--foreground)" }}>
                {a.machineName ?? "Unnamed machine"}
                <span style={{ opacity: 0.55 }}>
                  {a.platform ? ` · ${a.platform}` : ""} · {a.createdAt}
                </span>
              </span>
              <button
                onClick={() => deactivate(a.id)}
                disabled={busy === a.id}
                className="text-[13px] underline shrink-0"
                style={{ color: "var(--primary)", opacity: busy === a.id ? 0.5 : 1 }}
              >
                {busy === a.id ? "…" : "Deactivate"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-[13px] mt-2" style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      <p className="text-[12px] mt-3" style={{ color: "var(--foreground)", opacity: 0.55 }}>
        Deactivate a machine you no longer use to free up a slot — a rebuilt computer looks like a
        new one, so it takes a fresh slot.
      </p>
    </div>
  )
}
