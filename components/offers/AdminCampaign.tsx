"use client"

import { useEffect, useState } from "react"


interface Preview {
  slug: string
  unavailable: string | null
  samples: { variant: string; subject: string; html: string }[]
  recipientCount: number
  byVariant: Record<string, number>
  excluded: Record<string, number> | null
  send: {
    id: string
    createdAt: string
    completedAt: string | null
    sentCount: number
    skippedCount: number
    failedEmails: string[]
  } | null
}

interface BatchResponse {
  sent: number
  failed: number
  skipped: number
  totalRecipients: number
  totalSent: number
  totalSkipped: number
  done: boolean
}

type Json = Record<string, unknown>

const mono = { fontFamily: "var(--font-ibm-mono), monospace" }
const labelStyle = { ...mono, color: "var(--muted)" }
const btnStyle = { borderColor: "var(--border)", color: "var(--foreground)", background: "transparent" }
const primaryBtnStyle = { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }
const btnCls =
  "rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer"


// Same defensive read as AdminMemberOffer: an HTML error page must not turn
// into an exception that tells the admin nothing.
async function readJson(res: Response): Promise<{ ok: boolean; data: Json | null; message: string }> {
  const text = await res.text()
  if (!text) return { ok: res.ok, data: null, message: `Server returned ${res.status} with an empty response.` }
  try {
    const data = JSON.parse(text) as Json
    return { ok: res.ok, data, message: typeof data.error === "string" ? data.error : "" }
  } catch {
    return { ok: false, data: null, message: `Server returned ${res.status} (not JSON). Check the server log.` }
  }
}

const fmtDate = (d: string) => new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
const people = (n: number) => `${n} account${n === 1 ? "" : "s"}`

// A member campaign's panel on /admin/offers (lib/member-campaign.ts): its
// versions to preview, who gets which, a test send, and Send / Resume.
export default function AdminCampaign({
  url: URL,
  title,
  description,
  testNote,
}: {
  url: string
  title: string
  description: React.ReactNode
  /** What the test emails' example values are, said after a test send. */
  testNote: string
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState<"test" | "send" | null>(null)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function load() {
    const { ok, data, message } = await readJson(await fetch(URL))
    if (!ok || !data) return setError(message || "Could not load the email.")
    setPreview(data.preview as Preview)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { ok, data, message } = await readJson(await fetch(URL))
      if (cancelled) return
      if (!ok || !data) return setError(message || "Could not load the email.")
      setPreview(data.preview as Preview)
    })()
    return () => {
      cancelled = true
    }
  }, [URL])

  const post = async (action: string, id?: string) =>
    readJson(
      await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      }),
    )

  async function sendTest() {
    setError("")
    setNotice("")
    setBusy("test")
    const { ok, data, message } = await post("test")
    setBusy(null)
    if (!ok || !data) return setError(message || "Test send failed.")
    setNotice(`Every version sent to ${String(data.sentTo)}. ${testNote}`)
  }

  async function send(p: Preview) {
    setError("")
    setNotice("")
    if (!p.send) {
      const confirmed = window.confirm(
        `Email "${title}" to ${people(p.recipientCount)}?\n\n` +
          `The list is fixed now. Each person is checked again as they're sent to, so someone who uses their code or buys in the meantime gets the right version, or nothing. This cannot be undone.`,
      )
      if (!confirmed) return
    }
    setBusy("send")

    // Resuming reuses the reminder; claiming again would be refused.
    let id = p.send?.id ?? ""
    if (!id) {
      const claim = await post("claim")
      if (!claim.ok || !claim.data) {
        setBusy(null)
        void load()
        return setError(claim.message || "Could not start the send.")
      }
      id = String(claim.data.id)
    }

    let done = false
    let finished = false
    // A backstop against a server that never says done: 500 batches of 20.
    let guard = 0
    while (!done && guard < 500) {
      guard++
      const { ok, data, message } = await post("batch", id)
      if (!ok || !data) {
        setBusy(null)
        setError(`${message} Press Resume to carry on where it stopped.`)
        void load()
        return
      }
      const batch = data as unknown as BatchResponse
      setProgress(
        `${batch.totalSent} of ${batch.totalRecipients} sent` +
          (batch.totalSkipped ? `, ${batch.totalSkipped} left out at the last moment` : "") +
          (batch.failed ? `, ${batch.failed} failed this batch` : ""),
      )
      done = batch.done
      finished = batch.totalSent + batch.totalSkipped >= batch.totalRecipients
    }
    setBusy(null)
    if (finished) setNotice("Sent.")
    else setError("It stopped before the end: a batch sent to nobody. Press Resume to try the rest again.")
    void load()
  }

  if (error && !preview) return <p className="text-sm text-red-500">{error}</p>
  if (!preview) {
    return (
      <p className="text-sm" style={labelStyle}>
        Working out who it goes to - asking Stripe which codes have been used...
      </p>
    )
  }

  const r = preview.send
  const left = r ? preview.recipientCount - r.sentCount - r.skippedCount : preview.recipientCount
  const x = preview.excluded
  return (
    <div className="space-y-6" data-admin-campaign={preview.slug}>
      <div>
        <h1 className="text-xl font-semibold mb-1">{title}</h1>
        <p className="text-sm" style={labelStyle}>
          {description}
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {notice && <p className="text-sm" style={{ color: "var(--primary)" }}>{notice}</p>}
      {preview.unavailable && <p className="text-sm text-red-500">{preview.unavailable}</p>}

      <section className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-medium">{preview.samples[0]?.subject}</h2>
          <span className="text-sm" style={labelStyle} data-campaign-count>
            {people(preview.recipientCount)}
          </span>
        </div>

        <div className="text-sm mb-4 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          {r && (
            <p style={labelStyle}>
              {r.completedAt ? `Sent ${fmtDate(r.completedAt)}` : `Started ${fmtDate(r.createdAt)} - not finished`}
            </p>
          )}
          <p style={labelStyle} data-campaign-variants>
            {Object.entries(preview.byVariant)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => `${n} ${k}`)
              .join(", ") || "Nobody yet"}
          </p>
          {x && Object.keys(x).length > 0 && (
            <p style={labelStyle}>
              Left out: {Object.entries(x).map(([k, n]) => `${n} ${k.replace(/-/g, " ")}`).join(", ")}.
            </p>
          )}
          {r && (
            <p style={labelStyle}>
              {r.sentCount} sent
              {r.skippedCount > 0 && `, ${r.skippedCount} left out at the last moment`}
              {r.failedEmails.length > 0 &&
                `, ${r.failedEmails.length} failed (${r.failedEmails.slice(0, 3).join(", ")}${r.failedEmails.length > 3 ? ", ..." : ""})`}
            </p>
          )}
        </div>

        {preview.samples.map((s) => (
          <details className="mb-3" key={s.variant}>
            <summary className="text-sm cursor-pointer" style={labelStyle}>
              Preview: {s.variant} - &ldquo;{s.subject}&rdquo;
            </summary>
            <div
              className="mt-3 rounded-lg border bg-white overflow-hidden"
              style={{ borderColor: "var(--border)" }}
              dangerouslySetInnerHTML={{ __html: s.html }}
            />
          </details>
        ))}

        {progress && <p className="text-sm my-3" style={{ color: "var(--primary)" }}>{progress}</p>}

        <div className="flex gap-2 mt-4">
          <button className={btnCls} style={btnStyle} disabled={busy !== null} onClick={sendTest}>
            {busy === "test" ? "Sending..." : `Send ${preview.samples.length} tests to me`}
          </button>
          <button
            className={btnCls}
            style={primaryBtnStyle}
            disabled={busy !== null || left <= 0 || Boolean(r?.completedAt) || Boolean(preview.unavailable)}
            onClick={() => send(preview)}
            data-campaign-send
          >
            {busy === "send"
              ? "Sending..."
              : r?.completedAt
                ? "Sent"
                : r
                  ? `Resume - ${left} left`
                  : `Send to ${people(preview.recipientCount)}`}
          </button>
        </div>
      </section>
    </div>
  )
}
