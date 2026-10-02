"use client"

import { useCallback, useEffect, useState } from "react"
import type { GiftStatus } from "@/lib/gift-link-logic"
import { COMP_PRODUCTS, PRODUCT_LABEL, type CompProduct } from "@/lib/plugin-products"

// The Gift links tab of /admin/comps: make a link to DM someone, and see who
// has claimed theirs. See lib/gift-link.ts.

interface AdminGift {
  id: string
  url: string
  product: CompProduct
  note: string | null
  message: string | null
  status: GiftStatus
  createdAt: string
  expiresAt: string | null
  claimedAt: string | null
  savedTo: string | null
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
const btnCls = "whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer"

const STATUS_LABEL: Record<GiftStatus, string> = {
  open: "not claimed yet",
  claimed: "claimed",
  reopened: "reopened - waiting",
  revoked: "cancelled",
  expired: "expired",
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

async function call<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) throw new Error(data?.error || `Server returned ${res.status}.`)
  return data as T
}

function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className={btnCls}
      style={btnStyle}
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? "Copied" : label}
    </button>
  )
}

export default function AdminGiftLinks() {
  const [gifts, setGifts] = useState<AdminGift[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const [product, setProduct] = useState<CompProduct | "">("")
  const [note, setNote] = useState("")
  const [message, setMessage] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [made, setMade] = useState<AdminGift | null>(null)

  const load = useCallback(async () => {
    try {
      setGifts((await call<{ gifts: AdminGift[] }>("/api/admin/gifts")).gifts)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await action()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work")
    } finally {
      setBusy(false)
    }
  }

  const create = () =>
    run(async () => {
      const { gift } = await call<{ gift: AdminGift }>("/api/admin/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, note, message, expiresAt: expiresAt || undefined }),
      })
      setMade(gift)
      setNote("")
      setMessage("")
      setExpiresAt("")
    })

  const revoke = (g: AdminGift) => {
    if (!window.confirm("Cancel this gift link? Nobody will be able to claim it.")) return
    run(async () => void (await call(`/api/admin/comps/${g.id}/revoke`, { method: "POST" })))
  }

  const reopen = (g: AdminGift) => {
    if (
      !window.confirm(
        "Reopen this gift? The next person to open the link and tap Claim gets the same keys, and whoever has it now loses access to the gift page. Their keys keep working.",
      )
    )
      return
    run(async () => void (await call(`/api/admin/gifts/${g.id}/reopen`, { method: "POST" })))
  }

  return (
    <div style={{ color: "var(--foreground)" }}>
      <p className="text-sm mb-8" style={{ opacity: 0.7 }}>
        A link you can DM to anyone. The first person to open it and tap Claim gets the plugins - keys and
        downloads on the spot, no account or email needed. The link then only works for them.
      </p>
      {error ? (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-lg font-semibold">New gift link</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr]">
          <label className="text-sm self-center" style={{ opacity: 0.85 }}>
            Give
          </label>
          <select
            className={inputCls}
            style={fieldStyle}
            value={product}
            onChange={(e) => setProduct(e.target.value as CompProduct | "")}
          >
            <option value="">Pick one</option>
            {COMP_PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {p === "bundle" ? "All three (shft + drft + fltr)" : PRODUCT_LABEL[p]}
              </option>
            ))}
          </select>
          <label className="text-sm self-center" style={{ opacity: 0.85 }}>
            Who&apos;s it for
          </label>
          <input
            className={inputCls}
            style={fieldStyle}
            placeholder="Only you see this - e.g. Metro, via IG"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <label className="text-sm self-start pt-2" style={{ opacity: 0.85 }}>
            Message
          </label>
          <textarea
            className={inputCls}
            style={fieldStyle}
            rows={3}
            maxLength={600}
            placeholder="Optional - they see this above the Claim button"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <label className="text-sm self-center" style={{ opacity: 0.85 }}>
            Expires
          </label>
          <div className="flex items-center gap-2">
            <input
              className={inputCls}
              style={fieldStyle}
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <span className="text-xs" style={{ opacity: 0.6 }}>
              Optional. Only matters until it&apos;s claimed.
            </span>
          </div>
        </div>
        <button className={`${btnCls} mt-4`} style={primaryBtnStyle} disabled={busy || !product} onClick={create}>
          Create gift link
        </button>

        {made ? (
          <div className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--primary)" }}>
            <p className="mb-2">
              Gift link for {made.note ?? PRODUCT_LABEL[made.product]} - copy it into your DM:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="select-all break-all" style={{ ...mono, color: "var(--primary)" }}>
                {made.url}
              </span>
              <CopyButton text={made.url} />
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        {loading ? (
          <p className="text-sm" style={{ opacity: 0.6 }}>
            Loading gift links...
          </p>
        ) : gifts.length === 0 ? (
          <p className="text-sm" style={{ opacity: 0.6 }}>
            No gift links yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide" style={labelStyle}>
                  <th className="px-4 py-2.5 font-normal">For</th>
                  <th className="px-4 py-2.5 font-normal">Gives</th>
                  <th className="px-4 py-2.5 font-normal">Status</th>
                  <th className="px-4 py-2.5 font-normal whitespace-nowrap">Saved to</th>
                  <th className="px-4 py-2.5 font-normal">Created</th>
                  <th className="px-4 py-2.5 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {gifts.map((g) => (
                  <tr key={g.id} className="border-t align-top" style={{ borderColor: "var(--border)" }} data-gift-row={g.id}>
                    <td className="px-4 py-2.5">
                      {g.note ?? <span style={{ opacity: 0.5 }}>-</span>}
                      {g.message ? (
                        <p className="text-xs mt-1 max-w-56 truncate" style={{ opacity: 0.6 }} title={g.message}>
                          &ldquo;{g.message}&rdquo;
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{PRODUCT_LABEL[g.product]}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap" data-gift-status={g.status}>
                      {STATUS_LABEL[g.status]}
                      {g.claimedAt && g.status === "claimed" ? (
                        <span className="block text-xs" style={{ opacity: 0.6 }}>
                          {fmtDate(g.claimedAt)}
                        </span>
                      ) : null}
                      {g.expiresAt && g.status === "open" ? (
                        <span className="block text-xs" style={{ opacity: 0.6 }}>
                          expires {fmtDate(g.expiresAt)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      {g.savedTo ?? (g.claimedAt ? <span className="whitespace-nowrap" style={{ opacity: 0.5 }}>no email yet</span> : "")}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(g.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {g.status === "open" || g.status === "reopened" ? <CopyButton text={g.url} /> : null}
                        {g.status === "open" ? (
                          <button className={btnCls} style={btnStyle} disabled={busy} onClick={() => revoke(g)}>
                            Cancel
                          </button>
                        ) : null}
                        {g.status === "claimed" ? (
                          <button className={btnCls} style={btnStyle} disabled={busy} onClick={() => reopen(g)}>
                            Reopen
                          </button>
                        ) : null}
                      </div>
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
