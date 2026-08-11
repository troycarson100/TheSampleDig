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
  stats: AffiliateStats
}

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

const inputCls =
  "rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500"
const btnCls =
  "rounded border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-700 disabled:opacity-50"

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

  if (loading) return <div className="p-8 text-neutral-300">Loading affiliates…</div>

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 text-neutral-100">
      <h1 className="text-2xl font-semibold">Affiliates — master panel</h1>
      {error ? <p className="mt-3 rounded border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p> : null}

      <section className="mt-6 rounded-lg border border-neutral-700 bg-neutral-900 p-4">
        <h2 className="text-lg font-semibold">Invite a creator</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={inputCls} placeholder="Name" value={nName} onChange={(e) => setNName(e.target.value)} />
          <input className={inputCls} placeholder="Email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} />
          <input className={inputCls} placeholder="Code (e.g. synthdad)" value={nCode} onChange={(e) => setNCode(e.target.value)} />
          <label className="flex items-center gap-1 text-sm text-neutral-400">
            <input
              className={`${inputCls} w-16`}
              type="number"
              min={1}
              max={90}
              value={nPercent}
              onChange={(e) => setNPercent(parseInt(e.target.value, 10) || 30)}
            />
            % commission
          </label>
          <input className={`${inputCls} flex-1 min-w-40`} placeholder="Notes (optional)" value={nNotes} onChange={(e) => setNNotes(e.target.value)} />
          <button className={btnCls} disabled={busy} onClick={createAffiliate}>
            Create
          </button>
        </div>
        {createdLink ? (
          <p className="mt-3 text-sm">
            Created. Email them their private dashboard link:{" "}
            <code className="select-all break-all text-amber-300">{createdLink}</code>{" "}
            <button className={`${btnCls} ml-2`} onClick={() => copy(createdLink)}>
              Copy
            </button>
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        {affiliates.length === 0 ? (
          <p className="text-sm text-neutral-400">No affiliates yet — invite your first creator above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-neutral-400">
                <tr>
                  <th className="py-2 pr-4 font-normal">Creator</th>
                  <th className="py-2 pr-4 font-normal">Code</th>
                  <th className="py-2 pr-4 font-normal">%</th>
                  <th className="py-2 pr-4 font-normal">Clicks 30d/all</th>
                  <th className="py-2 pr-4 font-normal">Sales</th>
                  <th className="py-2 pr-4 font-normal">Gross</th>
                  <th className="py-2 pr-4 font-normal">Owed</th>
                  <th className="py-2 font-normal"></th>
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
      <tr className={`border-t border-neutral-800 ${a.active ? "" : "opacity-50"}`}>
        <td className="py-2 pr-4">
          {a.name}
          <span className="block text-xs text-neutral-500">{a.email}</span>
        </td>
        <td className="py-2 pr-4">
          <code>{a.code}</code>
        </td>
        <td className="py-2 pr-4">{a.commissionPercent}%</td>
        <td className="py-2 pr-4">
          {a.stats.clicks30d} / {a.stats.clicksTotal}
        </td>
        <td className="py-2 pr-4">{a.stats.salesCount}</td>
        <td className="py-2 pr-4">{usd(a.stats.grossCents)}</td>
        <td className="py-2 pr-4 font-semibold">{usd(a.stats.owedCents)}</td>
        <td className="py-2 text-right">
          <button className={btnCls} onClick={onToggle}>
            {expanded ? "Close" : "Manage"}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t border-neutral-800 bg-neutral-950">
          <td colSpan={8} className="p-4">
            {a.stats.refundedAfterPayoutCents > 0 ? (
              <p className="mb-3 rounded border border-amber-700 bg-amber-950 px-3 py-2 text-xs text-amber-300">
                Refunded after payout: −{usd(a.stats.refundedAfterPayoutCents)} — offset this on the next payout manually.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input className={inputCls} value={eName} onChange={(e) => setEName(e.target.value)} />
              <input className={inputCls} value={eEmail} onChange={(e) => setEEmail(e.target.value)} />
              <input className={inputCls} value={eCode} onChange={(e) => setECode(e.target.value)} />
              <label className="flex items-center gap-1 text-neutral-400">
                <input
                  className={`${inputCls} w-16`}
                  type="number"
                  min={1}
                  max={90}
                  value={ePercent}
                  onChange={(e) => setEPercent(parseInt(e.target.value, 10) || a.commissionPercent)}
                />
                %
              </label>
              <input className={`${inputCls} flex-1 min-w-40`} placeholder="Notes" value={eNotes} onChange={(e) => setENotes(e.target.value)} />
              <button
                className={btnCls}
                disabled={busy}
                onClick={() => onPatch(a.id, { name: eName, email: eEmail, code: eCode, commissionPercent: ePercent, notes: eNotes })}
              >
                Save
              </button>
              <button className={btnCls} disabled={busy} onClick={() => onPatch(a.id, { active: !a.active })}>
                {a.active ? "Deactivate" : "Activate"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span>
                Ref link: <code className="select-all text-amber-300">{refLink}</code>
              </span>
              <button className={btnCls} onClick={() => onCopy(refLink)}>
                Copy
              </button>
              <span className="ml-3">
                Dashboard: <code className="select-all break-all text-amber-300">{dashboardLink}</code>
              </span>
              <button className={btnCls} onClick={() => onCopy(dashboardLink)}>
                Copy
              </button>
              <button className={btnCls} disabled={busy} onClick={onRegenerate}>
                Regenerate link
              </button>
              <button className={btnCls} disabled={busy || a.stats.owedCents === 0} onClick={onPayout}>
                Record payout ({usd(a.stats.owedCents)})
              </button>
              {a.userId ? <span className="text-emerald-400">account linked</span> : <span>no account linked</span>}
            </div>

            <h3 className="mt-4 text-sm font-semibold text-neutral-200">Sales</h3>
            {a.stats.referrals.length === 0 ? (
              <p className="mt-1 text-xs text-neutral-500">None yet.</p>
            ) : (
              <table className="mt-1 w-full text-left text-xs">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-1 pr-4 font-normal">Date</th>
                    <th className="py-1 pr-4 font-normal">Sale</th>
                    <th className="py-1 pr-4 font-normal">Commission</th>
                    <th className="py-1 pr-4 font-normal">Via</th>
                    <th className="py-1 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {a.stats.referrals.map((r) => (
                    <tr key={r.id} className="border-t border-neutral-900">
                      <td className="py-1 pr-4">{fmtDate(r.createdAt)}</td>
                      <td className="py-1 pr-4">{usd(r.grossAmountCents)}</td>
                      <td className="py-1 pr-4">{usd(r.commissionCents)}</td>
                      <td className="py-1 pr-4">{r.source === "code" ? "typed code" : "link"}</td>
                      <td className="py-1">{r.refundedAt ? "refunded" : r.paidOut ? "paid" : "owed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h3 className="mt-4 text-sm font-semibold text-neutral-200">Payouts</h3>
            {a.stats.payouts.length === 0 ? (
              <p className="mt-1 text-xs text-neutral-500">None yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-xs">
                {a.stats.payouts.map((p) => (
                  <li key={p.id}>
                    {fmtDate(p.paidAt)} — {usd(p.amountCents)}
                    {p.note ? <span className="text-neutral-500"> · {p.note}</span> : null}
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
