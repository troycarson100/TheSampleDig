"use client"

import { useCallback, useEffect, useState } from "react"
import type { CompCodeStatus } from "@/lib/comp-code-redemption"
import { COMP_PRODUCTS, PRODUCT_LABEL, type CompProduct } from "@/lib/plugin-products"

interface AdminCompCode {
  id: string
  code: string
  product: CompProduct
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

// A crashed route (or any 500 that returns an HTML error page) has an empty or
// non-JSON body, and res.json() then throws "Unexpected end of JSON input" -
// which tells an admin nothing about what actually went wrong. Read the body as
// text first and surface the status when it will not parse.
async function readJson(res: Response): Promise<{ ok: boolean; data: any; message: string }> {
  const text = await res.text()
  if (!text) {
    return { ok: res.ok, data: null, message: `Server returned ${res.status} with an empty response.` }
  }
  try {
    const data = JSON.parse(text)
    return { ok: res.ok, data, message: typeof data?.error === "string" ? data.error : "" }
  } catch {
    return { ok: false, data: null, message: `Server returned ${res.status} (not JSON). Check the server log.` }
  }
}

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

// Only codes whose expiration can still matter (compCodeStatus checks
// redeemed/revoked before expired, so a settled code's date is inert).
function isDateEditable(status: CompCodeStatus): boolean {
  return status === "open" || status === "expired"
}

export default function AdminComps() {
  const [codes, setCodes] = useState<AdminCompCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [count, setCount] = useState(1)
  // No default that silently works: minting comps for the wrong plugin gives
  // away the wrong product, and the server rejects a missing value too.
  const [product, setProduct] = useState<CompProduct | "">("")
  const [tab, setTab] = useState<CompProduct | "all">("all")
  const [note, setNote] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [justGenerated, setJustGenerated] = useState<AdminCompCode[]>([])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkExpiresAt, setBulkExpiresAt] = useState("")

  const load = useCallback(async () => {
    setError("")
    try {
      const res = await fetch("/api/admin/comps")
      const { ok, data, message } = await readJson(res)
      if (!ok || !data) throw new Error(message || "Load failed")
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
        body: JSON.stringify({ count, product, note, expiresAt: expiresAt || undefined }),
      })
      const { ok, data, message } = await readJson(res)
      if (!ok || !data) throw new Error(message || "Generate failed")
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
      const { ok, message } = await readJson(res)
      if (!ok) throw new Error(message || "Revoke failed")
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

  const visible = tab === "all" ? codes : codes.filter((c) => c.product === tab)

  // Scoped to what is on screen: a "select all" that also grabbed rows hidden
  // by the current tab would apply bulk edits the admin never saw.
  const eligibleIds = visible.filter((c) => isDateEditable(c.status)).map((c) => c.id)
  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id))

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function switchTab(next: CompProduct | "all") {
    setTab(next)
    setSelected(new Set())
  }

  function toggleSelectAllEligible() {
    setSelected(allEligibleSelected ? new Set() : new Set(eligibleIds))
  }

  async function bulkSetExpiration(nextExpiresAt: string | null) {
    if (selected.size === 0) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/admin/comps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), expiresAt: nextExpiresAt }),
      })
      const { ok, message } = await readJson(res)
      if (!ok) throw new Error(message || "Bulk edit failed")
      setSelected(new Set())
      setBulkExpiresAt("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk edit failed")
    } finally {
      setBusy(false)
    }
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
        Generate one-time retrieval codes to give away working copies of a plugin. A code is redeemed
        at /redeem by whoever submits it first.
      </p>
      {error ? (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-lg font-semibold">Generate</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm" style={{ opacity: 0.85 }}>
            Product
            <select
              className={inputCls}
              style={fieldStyle}
              value={product}
              onChange={(e) => setProduct(e.target.value as CompProduct | "")}
            >
              <option value="">Pick one</option>
              {COMP_PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {PRODUCT_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
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
          <button className={btnCls} style={primaryBtnStyle} disabled={busy || !product} onClick={generate}>
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
          <>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {(["all", ...COMP_PRODUCTS] as const).map((t) => {
                const count = t === "all" ? codes.length : codes.filter((c) => c.product === t).length
                const active = tab === t
                return (
                  <button
                    key={t}
                    className={btnCls}
                    style={active ? primaryBtnStyle : btnStyle}
                    onClick={() => switchTab(t)}
                  >
                    {t === "all" ? "All" : PRODUCT_LABEL[t]} ({count})
                  </button>
                )
              })}
            </div>
            {selected.size > 0 ? (
              <div
                className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm"
                style={{ borderColor: "var(--primary)", background: "rgba(255, 255, 255, 0.35)" }}
              >
                <span style={{ opacity: 0.85 }}>{selected.size} selected</span>
                <input
                  className={inputCls}
                  style={fieldStyle}
                  type="date"
                  value={bulkExpiresAt}
                  onChange={(e) => setBulkExpiresAt(e.target.value)}
                />
                <button
                  className={btnCls}
                  style={primaryBtnStyle}
                  disabled={busy || !bulkExpiresAt}
                  onClick={() => bulkSetExpiration(bulkExpiresAt)}
                >
                  Apply expiration
                </button>
                <button className={btnCls} style={btnStyle} disabled={busy} onClick={() => bulkSetExpiration(null)}>
                  Clear expiration
                </button>
                <button className={`${btnCls} ml-auto`} style={btnStyle} disabled={busy} onClick={() => setSelected(new Set())}>
                  Deselect all
                </button>
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide" style={labelStyle}>
                    <th className="px-4 py-2.5 font-normal">
                      <input
                        type="checkbox"
                        checked={allEligibleSelected}
                        onChange={toggleSelectAllEligible}
                        aria-label="Select all eligible codes"
                      />
                    </th>
                    <th className="px-4 py-2.5 font-normal">Code</th>
                    <th className="px-4 py-2.5 font-normal">Product</th>
                    <th className="px-4 py-2.5 font-normal">Note</th>
                    <th className="px-4 py-2.5 font-normal">Status</th>
                    <th className="px-4 py-2.5 font-normal">Redeemed by</th>
                    <th className="px-4 py-2.5 font-normal">Created</th>
                    <th className="px-4 py-2.5 font-normal">Expires</th>
                    <th className="px-4 py-2.5 font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-2.5">
                        {isDateEditable(c.status) ? (
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggleSelected(c.id)}
                            aria-label={`Select ${c.code}`}
                          />
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5" style={mono}>
                        {c.code}
                      </td>
                      <td className="px-4 py-2.5">{PRODUCT_LABEL[c.product]}</td>
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
          </>
        )}
      </section>
    </div>
  )
}
