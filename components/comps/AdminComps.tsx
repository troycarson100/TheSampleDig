"use client"

import { useCallback, useEffect, useState } from "react"
import type { CompCodeStatus } from "@/lib/comp-code-redemption"

interface AdminCompCode {
  id: string
  code: string
  note: string | null
  createdByEmail: string | null
  createdAt: string
  expiresAt: string | null
  redeemedAt: string | null
  redeemedByEmail: string | null
  status: CompCodeStatus
}

const mono = { fontFamily: "var(--font-ibm-mono), monospace" }
const labelStyle = { ...mono, color: "var(--muted)" }
const fieldStyle = {
  borderColor: "var(--border)",
  color: "var(--foreground)",
  background: "rgba(255, 255, 255, 0.45)",
}
const btnStyle = { borderColor: "var(--border)", color: "var(--foreground)", background: "transparent" }
const primaryBtnStyle = { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }

const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none"
const btnCls = "rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer"

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function fmtOptionalDate(d: string | null): string {
  return d ? fmtDate(d) : ""
}

function statusLabel(status: CompCodeStatus): string {
  if (status === "open") return "open"
  if (status === "redeemed") return "redeemed"
  if (status === "revoked") return "revoked"
  return "expired"
}

export default function AdminComps() {
  const [codes, setCodes] = useState<AdminCompCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [count, setCount] = useState(1)
  const [note, setNote] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [justGenerated, setJustGenerated] = useState<AdminCompCode[]>([])

  const load = useCallback(async () => {
    setError("")
    try {
      const res = await fetch("/api/admin/comps")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Load failed")
      setCodes(data.codes)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function generate() {
    setBusy(true)
    setError("")
    setJustGenerated([])
    try {
      const res = await fetch("/api/admin/comps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, note, expiresAt: expiresAt || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generate failed")
      setJustGenerated(data.codes)
      setNote("")
      setExpiresAt("")
      setCount(1)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed")
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this code? It will no longer be redeemable.")) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/comps/${id}/revoke`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Revoke failed")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed")
    } finally {
      setBusy(false)
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  if (loading)
    return (
      <p className="py-8 text-sm" style={{ color: "var(--foreground)", opacity: 0.7 }}>
        Loading comp codes...
      </p>
    )

  return (
    <div style={{ color: "var(--foreground)" }}>
      <p className="text-xs uppercase tracking-widest mb-1" style={labelStyle}>
        shft comp codes
      </p>
      <h1 className="text-2xl font-bold mb-2">Comp codes</h1>
      <p className="text-sm mb-8" style={{ opacity: 0.7 }}>
        Generate one-time retrieval codes to give away working copies of shft. A code is redeemed
        at /redeem by whoever submits it first.
      </p>
      {error ? (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-lg font-semibold">Generate</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm" style={{ opacity: 0.85 }}>
            Count
            <input
              className={`${inputCls} w-16`}
              style={fieldStyle}
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
            />
          </label>
          <input
            className={`${inputCls} flex-1 min-w-40`}
            style={fieldStyle}
            placeholder="Note (e.g. press - XYZ blog)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-sm" style={{ opacity: 0.85 }}>
            Expires
            <input
              className={inputCls}
              style={fieldStyle}
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          <button className={btnCls} style={primaryBtnStyle} disabled={busy} onClick={generate}>
            Generate
          </button>
        </div>
        {justGenerated.length > 0 ? (
          <div className="mt-3 text-sm">
            <p className="mb-1">Just generated:</p>
            <ul className="space-y-1">
              {justGenerated.map((c) => (
                <li key={c.id}>
                  <span className="select-all" style={{ ...mono, color: "var(--primary)" }}>
                    {c.code}
                  </span>{" "}
                  <button className={`${btnCls} ml-1`} style={btnStyle} onClick={() => copy(c.code)}>
                    Copy
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        {codes.length === 0 ? (
          <p className="text-sm" style={{ opacity: 0.6 }}>
            No comp codes yet - generate your first one above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide" style={labelStyle}>
                  <th className="px-4 py-2.5 font-normal">Code</th>
                  <th className="px-4 py-2.5 font-normal">Note</th>
                  <th className="px-4 py-2.5 font-normal">Status</th>
                  <th className="px-4 py-2.5 font-normal">Redeemed by</th>
                  <th className="px-4 py-2.5 font-normal">Created</th>
                  <th className="px-4 py-2.5 font-normal">Expires</th>
                  <th className="px-4 py-2.5 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2.5" style={mono}>
                      {c.code}
                    </td>
                    <td className="px-4 py-2.5">{c.note ?? ""}</td>
                    <td className="px-4 py-2.5">{statusLabel(c.status)}</td>
                    <td className="px-4 py-2.5">{c.redeemedByEmail ?? ""}</td>
                    <td className="px-4 py-2.5">{fmtDate(c.createdAt)}</td>
                    <td className="px-4 py-2.5">{fmtOptionalDate(c.expiresAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {c.status === "open" ? (
                        <button className={btnCls} style={btnStyle} disabled={busy} onClick={() => revoke(c.id)}>
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
