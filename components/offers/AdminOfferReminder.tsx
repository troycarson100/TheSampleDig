"use client"

import { useEffect, useState } from "react"

type Variant = "bundle" | "fltr"

interface Preview {
  slug: string
  amountOff: string
  unavailable: string | null
  emails: Record<Variant, { subject: string; bodyHtml: string }>
  recipientCount: number
  byVariant: Record<Variant, number>
  excluded: { "no-code": number; redeemed: number; "owns-fltr": number; "opted-out": number } | null
  reminder: {
    id: string
    createdAt: string
    completedAt: string | null
    sentCount: number
    skippedCount: number
    failedEmails: string[]
    sentByEmail: string | null
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

const URL = "/api/admin/offers/reminder"

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

const WHO: Record<Variant, string> = {
  bundle: "Owns nothing - the bundle, fltr and the code",
  fltr: "Owns shft or drft - fltr and the code, no bundle",
}

export default function AdminOfferReminder() {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState<"test" | "send" | null>(null)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function load() {
    const { ok, data, message } = await readJson(await fetch(URL))
    if (!ok || !data) return setError(message || "Could not load the reminder.")
    setPreview(data.preview as Preview)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { ok, data, message } = await readJson(await fetch(URL))
      if (cancelled) return
      if (!ok || !data) return setError(message || "Could not load the reminder.")
      setPreview(data.preview as Preview)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const post = async (action: string, reminderId?: string) =>
    readJson(
      await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reminderId }),
      }),
    )

  async function sendTest() {
    setError("")
    setNotice("")
    setBusy("test")
    const { ok, data, message } = await post("test")
    setBusy(null)
    if (!ok || !data) return setError(message || "Test send failed.")
    setNotice(`Both emails sent to ${String(data.sentTo)}. Their code is an example and works nowhere.`)
  }

  async function send(p: Preview) {
    setError("")
    setNotice("")
    if (!p.reminder) {
      const confirmed = window.confirm(
        `Email the reminder to ${people(p.recipientCount)}?\n\n` +
          `The list is fixed now: anyone who has used their code or bought fltr is already left off it. This cannot be undone.`,
      )
      if (!confirmed) return
    }
    setBusy("send")

    // Resuming reuses the reminder; claiming again would be refused.
    let reminderId = p.reminder?.id ?? ""
    if (!reminderId) {
      const claim = await post("claim")
      if (!claim.ok || !claim.data) {
        setBusy(null)
        void load()
        return setError(claim.message || "Could not start the reminder.")
      }
      reminderId = String(claim.data.reminderId)
    }

    let done = false
    let finished = false
    // A backstop against a server that never says done: 500 batches of 20.
    let guard = 0
    while (!done && guard < 500) {
      guard++
      const { ok, data, message } = await post("batch", reminderId)
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
        Working out who the reminder goes to - asking Stripe which codes have been used...
      </p>
    )
  }

  const r = preview.reminder
  const left = r ? preview.recipientCount - r.sentCount - r.skippedCount : preview.recipientCount
  const x = preview.excluded

  return (
    <div className="space-y-6" data-admin-offer-reminder>
      <div>
        <h1 className="text-xl font-semibold mb-1">Reminder - the bundle sale, fltr and the code</h1>
        <p className="text-sm" style={labelStyle}>
          A second, designed email to the people the member offer went to, with their own {preview.amountOff} code
          again. It leaves out anyone who has used their code or bought fltr, and anyone who has unsubscribed. No new
          codes are made. Someone who owns shft or drft cannot buy the bundle, so they get an email about fltr alone.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {notice && <p className="text-sm" style={{ color: "var(--primary)" }}>{notice}</p>}
      {preview.unavailable && <p className="text-sm text-red-500" data-reminder-unavailable>{preview.unavailable}</p>}

      <section className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-medium">{preview.emails.bundle.subject}</h2>
          <span className="text-sm" style={labelStyle} data-reminder-count>
            {people(preview.recipientCount)}
          </span>
        </div>

        <div className="text-sm mb-4 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          {r && (
            <p style={labelStyle}>
              {r.completedAt ? `Sent ${fmtDate(r.completedAt)}` : `Started ${fmtDate(r.createdAt)} - not finished`}
              {r.sentByEmail ? ` by ${r.sentByEmail}` : ""}
            </p>
          )}
          <p style={labelStyle}>
            {preview.byVariant.bundle} get the bundle email, {preview.byVariant.fltr} the fltr one.
          </p>
          {x && (
            <p style={labelStyle} data-reminder-excluded>
              Left out: {x.redeemed} used their code, {x["owns-fltr"]} bought fltr without it, {x["opted-out"]}{" "}
              unsubscribed.
            </p>
          )}
          {r && (
            <p style={labelStyle}>
              {r.sentCount} sent
              {r.skippedCount > 0 && `, ${r.skippedCount} left out at the last moment (bought, used the code or unsubscribed since)`}
              {r.failedEmails.length > 0 &&
                `, ${r.failedEmails.length} failed (${r.failedEmails.slice(0, 3).join(", ")}${r.failedEmails.length > 3 ? ", ..." : ""})`}
            </p>
          )}
        </div>

        {(["bundle", "fltr"] as const).map((v) => (
          <details className="mb-3" key={v}>
            <summary className="text-sm cursor-pointer" style={labelStyle}>
              Preview: {WHO[v]} - &ldquo;{preview.emails[v].subject}&rdquo;
            </summary>
            <div
              className="mt-3 rounded-lg border bg-white overflow-hidden"
              style={{ borderColor: "var(--border)" }}
              dangerouslySetInnerHTML={{ __html: preview.emails[v].bodyHtml }}
            />
          </details>
        ))}

        {progress && <p className="text-sm my-3" style={{ color: "var(--primary)" }}>{progress}</p>}

        <div className="flex gap-2 mt-4">
          <button className={btnCls} style={btnStyle} disabled={busy !== null} onClick={sendTest}>
            {busy === "test" ? "Sending..." : "Send both tests to me"}
          </button>
          <button
            className={btnCls}
            style={primaryBtnStyle}
            disabled={busy !== null || left <= 0 || Boolean(r?.completedAt) || Boolean(preview.unavailable)}
            onClick={() => send(preview)}
            data-reminder-send
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
