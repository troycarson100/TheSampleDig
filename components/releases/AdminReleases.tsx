"use client"

import { useCallback, useEffect, useState } from "react"
import { PRODUCT_LABEL, type PluginProduct } from "@/lib/plugin-products"

interface Preview {
  product: PluginProduct
  name: string
  version: string
  subject: string
  bodyHtml: string
  notes: string[]
  recipientCount: number
  announcement: {
    id: string
    createdAt: string
    completedAt: string | null
    sentCount: number
    failedCount: number
    failedEmails: string[]
    sentByEmail: string | null
  } | null
}

interface Row {
  product: PluginProduct
  preview: Preview | null
}

const mono = { fontFamily: "var(--font-ibm-mono), monospace" }
const labelStyle = { ...mono, color: "var(--muted)" }
const btnStyle = { borderColor: "var(--border)", color: "var(--foreground)", background: "transparent" }
const primaryBtnStyle = { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }
const btnCls =
  "rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer"

type Json = Record<string, unknown>

interface BatchResponse {
  sent: number
  failed: number
  totalRecipients: number
  totalSent: number
  done: boolean
}

// Same defensive read as AdminComps: a 500 that returns an HTML error page
// makes res.json() throw something that tells an admin nothing.
async function readJson(
  res: Response
): Promise<{ ok: boolean; data: Json | null; message: string }> {
  const text = await res.text()
  if (!text) {
    return { ok: res.ok, data: null, message: `Server returned ${res.status} with an empty response.` }
  }
  try {
    const data = JSON.parse(text) as Json
    return { ok: res.ok, data, message: typeof data.error === "string" ? data.error : "" }
  } catch {
    return { ok: false, data: null, message: `Server returned ${res.status} (not JSON). Check the server log.` }
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function AdminReleases() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/releases")
    const { ok, data, message } = await readJson(res)
    if (!ok || !data) return setError(message || "Could not load releases.")
    setRows(data.releases as Row[])
  }, [])

  // The fetch lives inside an async callback rather than the effect body so
  // the state updates land after the effect returns, not synchronously during
  // it. Same shape as SettingsMarketingPreference.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch("/api/admin/releases")
      const { ok, data, message } = await readJson(res)
      if (cancelled) return
      if (!ok || !data) {
        setError(message || "Could not load releases.")
        return
      }
      setRows(data.releases as Row[])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function post(product: PluginProduct, action: string, announcementId?: string) {
    const res = await fetch("/api/admin/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, action, announcementId }),
    })
    return readJson(res)
  }

  async function sendTest(product: PluginProduct) {
    setError("")
    setNotice("")
    setBusy(`${product}:test`)
    const { ok, data, message } = await post(product, "test")
    setBusy(null)
    if (!ok || !data) return setError(message || "Test send failed.")
    setNotice(`Test sent to ${String(data.sentTo)}. Check it before sending for real.`)
  }

  // Claim first, then loop batches. The loop lives in the client on purpose:
  // each request stays short enough that the platform will not cut it, and the
  // admin sees real progress instead of a spinner that might be a dead request.
  async function sendLive(product: PluginProduct, preview: Preview) {
    setError("")
    setNotice("")

    const confirmed = window.confirm(
      `Send "${preview.subject}" to ${preview.recipientCount} ${preview.name} owners?\n\n` +
        `This cannot be undone, and ${preview.name} v${preview.version} can only be announced once.`
    )
    if (!confirmed) return

    setBusy(`${product}:send`)

    // Resuming an incomplete blast reuses the existing claim; claiming again
    // would collide with the unique constraint and get a 409, which is exactly
    // the protection that stops a second full send.
    let announcementId = preview.announcement?.id ?? ""

    if (!announcementId) {
      const claim = await post(product, "claim")
      if (!claim.ok || !claim.data) {
        setBusy(null)
        void load()
        return setError(claim.message || "Could not claim this release.")
      }
      announcementId = String(claim.data.announcementId)
    }

    let done = false
    // Backstop against a server that never reports done - at BATCH_SIZE 25
    // this covers 12,500 recipients, well past any plausible list.
    let guard = 0
    while (!done && guard < 500) {
      guard++
      const { ok, data, message } = await post(product, "batch", announcementId)
      if (!ok || !data) {
        setBusy(null)
        setError(`${message} Press Send again to resume where it stopped.`)
        void load()
        return
      }
      const batch = data as unknown as BatchResponse
      setProgress((p) => ({
        ...p,
        [product]: `${batch.totalSent} of ${batch.totalRecipients} sent${batch.failed ? `, ${batch.failed} failed this batch` : ""}`,
      }))
      done = batch.done
    }

    setBusy(null)
    setNotice(`${preview.name} v${preview.version} announced.`)
    void load()
  }

  if (error && !rows) return <p className="text-sm text-red-500">{error}</p>
  if (!rows) return <p className="text-sm" style={labelStyle}>Loading...</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Release announcements</h1>
        <p className="text-sm" style={labelStyle}>
          Emails every owner of a product when a new version ships. The version and notes come from
          lib/products.ts - bump them there, deploy, then send from here.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {notice && <p className="text-sm" style={{ color: "var(--primary)" }}>{notice}</p>}

      {rows.map(({ product, preview }) => (
        <section key={product} className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-medium">{PRODUCT_LABEL[product]}</h2>
            {preview && (
              <span className="text-sm" style={labelStyle}>
                v{preview.version} - {preview.recipientCount} subscribed owner
                {preview.recipientCount === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {!preview ? (
            <p className="text-sm text-red-500">
              No changelog entry matching this product&apos;s current version. Add one to lib/products.ts
              and redeploy before announcing.
            </p>
          ) : (
            <>
              {preview.announcement && (
                <div className="text-sm mb-4 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                  <p style={labelStyle}>
                    {preview.announcement.completedAt
                      ? `Announced ${fmtDate(preview.announcement.completedAt)}`
                      : `Started ${fmtDate(preview.announcement.createdAt)} - not finished`}
                    {preview.announcement.sentByEmail ? ` by ${preview.announcement.sentByEmail}` : ""}
                  </p>
                  <p style={labelStyle}>
                    {preview.announcement.sentCount} sent
                    {preview.announcement.failedCount > 0 &&
                      `, ${preview.announcement.failedCount} failed (${preview.announcement.failedEmails.slice(0, 3).join(", ")}${preview.announcement.failedEmails.length > 3 ? ", ..." : ""})`}
                  </p>
                </div>
              )}

              <p className="text-sm mb-2" style={mono}>
                {preview.subject}
              </p>

              <details className="mb-4">
                <summary className="text-sm cursor-pointer" style={labelStyle}>
                  Preview email
                </summary>
                <div
                  className="mt-3 rounded-lg border bg-white"
                  style={{ borderColor: "var(--border)" }}
                  dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                />
              </details>

              {progress[product] && (
                <p className="text-sm mb-3" style={{ color: "var(--primary)" }}>
                  {progress[product]}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  className={btnCls}
                  style={btnStyle}
                  disabled={busy !== null}
                  onClick={() => sendTest(product)}
                >
                  {busy === `${product}:test` ? "Sending..." : "Send test to me"}
                </button>
                <button
                  className={btnCls}
                  style={primaryBtnStyle}
                  disabled={
                    busy !== null ||
                    preview.recipientCount === 0 ||
                    Boolean(preview.announcement?.completedAt)
                  }
                  onClick={() => sendLive(product, preview)}
                >
                  {busy === `${product}:send`
                    ? "Sending..."
                    : preview.announcement?.completedAt
                      ? "Already announced"
                      : preview.announcement
                        ? `Resume - ${preview.recipientCount - preview.announcement.sentCount} left`
                        : `Send to ${preview.recipientCount} owners`}
                </button>
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  )
}
