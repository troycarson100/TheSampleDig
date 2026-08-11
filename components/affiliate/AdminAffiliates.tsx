"use client"

import { useCallback, useEffect, useState } from "react"
import type { AffiliateStats } from "@/lib/affiliate"

interface AdminAffiliate {
  id: string
  code: string
  name: string
  email: string
  commissionPercent: number
  dashboardToken: string
  userId: string | null
  active: boolean
  notes: string | null
  stripeConnected: boolean
  stripePayoutsEnabled: boolean
  stats: AffiliateStats
}

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
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

export default function AdminAffiliates({ baseUrl }: { baseUrl: string }) {
  const [affiliates, setAffiliates] = useState<AdminAffiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // New-affiliate form
  const [nName, setNName] = useState("")
  const [nEmail, setNEmail] = useState("")
  const [nCode, setNCode] = useState("")
  const [nPercent, setNPercent] = useState(30)
  const [nNotes, setNNotes] = useState("")
  const [createdLink, setCreatedLink] = useState("")

  const load = useCallback(async () => {
    setError("")
    try {
      const res = await fetch("/api/admin/affiliates")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Load failed")
      setAffiliates(data.affiliates)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createAffiliate() {
    setBusy(true)
    setError("")
    setCreatedLink("")
    try {
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nName, email: nEmail, code: nCode, commissionPercent: nPercent, notes: nNotes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Create failed")
      setCreatedLink(`${baseUrl}/affiliate/${data.affiliate.dashboardToken}`)
      setNName("")
      setNEmail("")
      setNCode("")
      setNPercent(30)
      setNNotes("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed")
    } finally {
      setBusy(false)
    }
  }

  async function patchAffiliate(id: string, patch: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/affiliates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed")
    } finally {
      setBusy(false)
    }
  }

  async function recordPayout(a: AdminAffiliate) {
    const note = window.prompt(
      `Record a payout of ${usd(a.stats.owedCents)} to ${a.name}?\n\nThis marks every currently-owed sale as paid. Optional note (e.g. "PayPal txn 8XY..."):`
    )
    if (note === null) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/affiliates/${a.id}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Payout failed")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payout failed")
    } finally {
      setBusy(false)
    }
  }

  async function stripePayout(a: AdminAffiliate) {
    if (
      !window.confirm(
        `Send ${usd(a.stats.owedCents)} to ${a.name} via Stripe?\n\nThis transfers their accrued balance to their connected Stripe account and marks those sales paid.`
      )
    )
      return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/affiliates/${a.id}/stripe-payout`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Stripe payout failed")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stripe payout failed")
    } finally {
      setBusy(false)
    }
  }

  async function regenerateToken(a: AdminAffiliate) {
    if (!window.confirm(`Regenerate ${a.name}'s dashboard link? The old link stops working immediately.`)) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/affiliates/${a.id}/regenerate-token`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Regenerate failed")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regenerate failed")
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
        Loading affiliates…
      </p>
    )

  return (
    <div style={{ color: "var(--foreground)" }}>
      <p className="text-xs uppercase tracking-widest mb-1" style={labelStyle}>
        shft affiliate program
      </p>
      <h1 className="text-2xl font-bold mb-2">Affiliates</h1>
      <p className="text-sm mb-8" style={{ opacity: 0.7 }}>
        Invite creators, track their sales, and record payouts.
      </p>
      {error ? (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-lg font-semibold">Invite a creator</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={inputCls} style={fieldStyle} placeholder="Name" value={nName} onChange={(e) => setNName(e.target.value)} />
          <input className={inputCls} style={fieldStyle} placeholder="Email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} />
          <input className={inputCls} style={fieldStyle} placeholder="Code (e.g. synthdad)" value={nCode} onChange={(e) => setNCode(e.target.value)} />
          <label className="flex items-center gap-1.5 text-sm" style={{ opacity: 0.85 }}>
            <input
              className={`${inputCls} w-16`}
              style={fieldStyle}
              type="number"
              min={1}
              max={90}
              value={nPercent}
              onChange={(e) => setNPercent(parseInt(e.target.value, 10) || 30)}
            />
            % commission
          </label>
          <input className={`${inputCls} flex-1 min-w-40`} style={fieldStyle} placeholder="Notes (optional)" value={nNotes} onChange={(e) => setNNotes(e.target.value)} />
          <button className={btnCls} style={primaryBtnStyle} disabled={busy} onClick={createAffiliate}>
            Create
          </button>
        </div>
        {createdLink ? (
          <p className="mt-3 text-sm">
            Created. Email them their private dashboard link:{" "}
            <span className="select-all break-all" style={{ ...mono, color: "var(--primary)" }}>
              {createdLink}
            </span>{" "}
            <button className={`${btnCls} ml-2`} style={btnStyle} onClick={() => copy(createdLink)}>
              Copy
            </button>
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        {affiliates.length === 0 ? (
          <p className="text-sm" style={{ opacity: 0.6 }}>
            No affiliates yet — invite your first creator above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide" style={labelStyle}>
                  <th className="px-4 py-2.5 font-normal">Creator</th>
                  <th className="px-4 py-2.5 font-normal">Code</th>
                  <th className="px-4 py-2.5 font-normal">%</th>
                  <th className="px-4 py-2.5 font-normal">Clicks 30d/all</th>
                  <th className="px-4 py-2.5 font-normal">Sales</th>
                  <th className="px-4 py-2.5 font-normal">Gross</th>
                  <th className="px-4 py-2.5 font-normal">Owed</th>
                  <th className="px-4 py-2.5 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map((a) => (
                  <AffiliateRow
                    key={a.id}
                    a={a}
                    baseUrl={baseUrl}
                    busy={busy}
                    expanded={expandedId === a.id}
                    onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    onPatch={patchAffiliate}
                    onPayout={() => recordPayout(a)}
                    onStripePayout={() => stripePayout(a)}
                    onRegenerate={() => regenerateToken(a)}
                    onCopy={copy}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function AffiliateRow({
  a,
  baseUrl,
  busy,
  expanded,
  onToggle,
  onPatch,
  onPayout,
  onStripePayout,
  onRegenerate,
  onCopy,
}: {
  a: AdminAffiliate
  baseUrl: string
  busy: boolean
  expanded: boolean
  onToggle: () => void
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>
  onPayout: () => void
  onStripePayout: () => void
  onRegenerate: () => void
  onCopy: (text: string) => void
}) {
  const [eName, setEName] = useState(a.name)
  const [eEmail, setEEmail] = useState(a.email)
  const [eCode, setECode] = useState(a.code)
  const [ePercent, setEPercent] = useState(a.commissionPercent)
  const [eNotes, setENotes] = useState(a.notes ?? "")
  const dashboardLink = `${baseUrl}/affiliate/${a.dashboardToken}`
  const refLink = `${baseUrl}/shft?ref=${a.code}`

  return (
    <>
      <tr className={`border-t ${a.active ? "" : "opacity-50"}`} style={{ borderColor: "var(--border)" }}>
        <td className="px-4 py-2.5">
          {a.name}
          <span className="block text-xs" style={{ opacity: 0.55 }}>
            {a.email}
          </span>
        </td>
        <td className="px-4 py-2.5" style={mono}>
          {a.code}
        </td>
        <td className="px-4 py-2.5">{a.commissionPercent}%</td>
        <td className="px-4 py-2.5">
          {a.stats.clicks30d} / {a.stats.clicksTotal}
        </td>
        <td className="px-4 py-2.5">{a.stats.salesCount}</td>
        <td className="px-4 py-2.5">{usd(a.stats.grossCents)}</td>
        <td className="px-4 py-2.5 font-semibold" style={{ color: a.stats.owedCents > 0 ? "var(--primary)" : undefined }}>
          {usd(a.stats.owedCents)}
        </td>
        <td className="px-4 py-2.5 text-right">
          <button className={btnCls} style={btnStyle} onClick={onToggle}>
            {expanded ? "Close" : "Manage"}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t" style={{ borderColor: "var(--border)", background: "rgba(255, 255, 255, 0.35)" }}>
          <td colSpan={8} className="px-4 py-4">
            {a.stats.refundedAfterPayoutCents > 0 ? (
              <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Refunded after payout: −{usd(a.stats.refundedAfterPayoutCents)} — offset this on the next payout manually.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input className={inputCls} style={fieldStyle} value={eName} onChange={(e) => setEName(e.target.value)} />
              <input className={inputCls} style={fieldStyle} value={eEmail} onChange={(e) => setEEmail(e.target.value)} />
              <input className={inputCls} style={fieldStyle} value={eCode} onChange={(e) => setECode(e.target.value)} />
              <label className="flex items-center gap-1.5" style={{ opacity: 0.85 }}>
                <input
                  className={`${inputCls} w-16`}
                  style={fieldStyle}
                  type="number"
                  min={1}
                  max={90}
                  value={ePercent}
                  onChange={(e) => setEPercent(parseInt(e.target.value, 10) || a.commissionPercent)}
                />
                %
              </label>
              <input className={`${inputCls} flex-1 min-w-40`} style={fieldStyle} placeholder="Notes" value={eNotes} onChange={(e) => setENotes(e.target.value)} />
              <button
                className={btnCls}
                style={btnStyle}
                disabled={busy}
                onClick={() => onPatch(a.id, { name: eName, email: eEmail, code: eCode, commissionPercent: ePercent, notes: eNotes })}
              >
                Save
              </button>
              <button className={btnCls} style={btnStyle} disabled={busy} onClick={() => onPatch(a.id, { active: !a.active })}>
                {a.active ? "Deactivate" : "Activate"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ opacity: 0.9 }}>
              <span>
                Ref link:{" "}
                <span className="select-all" style={{ ...mono, color: "var(--primary)" }}>
                  {refLink}
                </span>
              </span>
              <button className={btnCls} style={btnStyle} onClick={() => onCopy(refLink)}>
                Copy
              </button>
              <span className="ml-3">
                Dashboard:{" "}
                <span className="select-all break-all" style={{ ...mono, color: "var(--primary)" }}>
                  {dashboardLink}
                </span>
              </span>
              <button className={btnCls} style={btnStyle} onClick={() => onCopy(dashboardLink)}>
                Copy
              </button>
              <button className={btnCls} style={btnStyle} disabled={busy} onClick={onRegenerate}>
                Regenerate link
              </button>
              {a.stripePayoutsEnabled && a.stats.owedCents > 0 ? (
                <button className={btnCls} style={primaryBtnStyle} disabled={busy} onClick={onStripePayout}>
                  Pay via Stripe ({usd(a.stats.owedCents)})
                </button>
              ) : null}
              <button className={btnCls} style={btnStyle} disabled={busy || a.stats.owedCents === 0} onClick={onPayout}>
                Record manual payout ({usd(a.stats.owedCents)})
              </button>
              {a.stripePayoutsEnabled ? (
                <span style={{ color: "var(--primary)" }}>Stripe payouts on</span>
              ) : a.stripeConnected ? (
                <span style={{ opacity: 0.6 }}>Stripe setup incomplete</span>
              ) : (
                <span style={{ opacity: 0.6 }}>Stripe not connected</span>
              )}
              {a.userId ? (
                <span style={{ color: "var(--primary)" }}>account linked</span>
              ) : (
                <span style={{ opacity: 0.6 }}>no account linked</span>
              )}
            </div>

            <h3 className="mt-4 text-sm font-semibold">Sales</h3>
            {a.stats.referrals.length === 0 ? (
              <p className="mt-1 text-xs" style={{ opacity: 0.6 }}>
                None yet.
              </p>
            ) : (
              <table className="mt-1 w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide" style={labelStyle}>
                    <th className="py-1 pr-4 font-normal">Date</th>
                    <th className="py-1 pr-4 font-normal">Sale</th>
                    <th className="py-1 pr-4 font-normal">Commission</th>
                    <th className="py-1 pr-4 font-normal">Via</th>
                    <th className="py-1 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {a.stats.referrals.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="py-1.5 pr-4">{fmtDate(r.createdAt)}</td>
                      <td className="py-1.5 pr-4">{usd(r.grossAmountCents)}</td>
                      <td className="py-1.5 pr-4">{usd(r.commissionCents)}</td>
                      <td className="py-1.5 pr-4">{r.source === "code" ? "typed code" : "link"}</td>
                      <td className="py-1.5" style={r.refundedAt ? { opacity: 0.55 } : undefined}>
                        {r.refundedAt ? "refunded" : r.paidOut ? "paid" : "owed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h3 className="mt-4 text-sm font-semibold">Payouts</h3>
            {a.stats.payouts.length === 0 ? (
              <p className="mt-1 text-xs" style={{ opacity: 0.6 }}>
                None yet.
              </p>
            ) : (
              <ul className="mt-1 space-y-1 text-xs">
                {a.stats.payouts.map((p) => (
                  <li key={p.id}>
                    {fmtDate(p.paidAt)} — {usd(p.amountCents)}
                    {p.note ? <span style={{ opacity: 0.6 }}> · {p.note}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      ) : null}
    </>
  )
}
