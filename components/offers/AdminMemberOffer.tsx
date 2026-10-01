"use client"

import { useEffect, useState } from "react"

interface Preview {
  slug: string
  amountOff: string
  days: number
  subject: string
  bodyHtml: string
  recipientCount: number
  offer: {
    id: string
    createdAt: string
    completedAt: string | null
    cutoffAt: string
    expiresAt: string
    sentCount: number
    failedEmails: string[]
    sentByEmail: string | null
  } | null
}

interface BatchResponse {
  sent: number
  failed: number
  totalRecipients: number
  totalSent: number
  done: boolean
}

type Json = Record<string, unknown>

const mono = { fontFamily: "var(--font-ibm-mono), monospace" }
const labelStyle = { ...mono, color: "var(--muted)" }
const btnStyle = { borderColor: "var(--border)", color: "var(--foreground)", background: "transparent" }
const primaryBtnStyle = { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }
const btnCls =
  "rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer"

// Same defensive read as AdminReleases: an HTML error page must not turn into
// an exception that tells the admin nothing.
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

export default function AdminMemberOffer() {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState<"test" | "test-code" | "send" | null>(null)
  const [testTo, setTestTo] = useState("")
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function load() {
    const { ok, data, message } = await readJson(await fetch("/api/admin/offers"))
    if (!ok || !data) return setError(message || "Could not load the offer.")
    setPreview(data.preview as Preview)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { ok, data, message } = await readJson(await fetch("/api/admin/offers"))
      if (cancelled) return
      if (!ok || !data) return setError(message || "Could not load the offer.")
      setPreview(data.preview as Preview)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const post = async (action: string, offerId?: string, to?: string) =>
    readJson(
      await fetch("/api/admin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, offerId, to }),
      }),
    )

  async function sendTestCode() {
    setError("")
    setNotice("")
    setBusy("test-code")
    const { ok, data, message } = await post("test-code", undefined, testTo)
    setBusy(null)
    if (!ok || !data) return setError(message || "The test code could not be sent.")
    setNotice(
      `A working code, ${String(data.code)}, is on its way to ${String(data.sentTo)}. It is real - single use, $10 off - ` +
        `and expires ${fmtDate(String(data.expiresAt))}. The offer itself has not started.`,
    )
  }

  async function sendTest() {
    setError("")
    setNotice("")
    setBusy("test")
    const { ok, data, message } = await post("test")
    setBusy(null)
    if (!ok || !data) return setError(message || "Test send failed.")
    setNotice(`Test sent to ${String(data.sentTo)}. Its code is an example and works nowhere.`)
  }

  async function send(p: Preview) {
    setError("")
    setNotice("")
    if (!p.offer) {
      const confirmed = window.confirm(
        `Make ${p.recipientCount} single-use ${p.amountOff} codes in Stripe and email one to each of ${p.recipientCount} accounts?\n\n` +
          `Accounts made after this moment will not get one. The codes expire in ${p.days} days. This cannot be undone.`,
      )
      if (!confirmed) return
    }
    setBusy("send")

    // Resuming reuses the offer; claiming again would be refused.
    let offerId = p.offer?.id ?? ""
    if (!offerId) {
      const claim = await post("claim")
      if (!claim.ok || !claim.data) {
        setBusy(null)
        void load()
        return setError(claim.message || "Could not start the offer.")
      }
      offerId = String(claim.data.offerId)
    }

    let done = false
    // A backstop against a server that never says done: 500 batches of 20.
    let guard = 0
    while (!done && guard < 500) {
      guard++
      const { ok, data, message } = await post("batch", offerId)
      if (!ok || !data) {
        setBusy(null)
        setError(`${message} Press Resume to carry on where it stopped.`)
        void load()
        return
      }
      const batch = data as unknown as BatchResponse
      setProgress(
        `${batch.totalSent} of ${batch.totalRecipients} sent${batch.failed ? `, ${batch.failed} failed this batch` : ""}`,
      )
      done = batch.done
    }
    setBusy(null)
    setNotice("Sent.")
    void load()
  }

  if (error && !preview) return <p className="text-sm text-red-500">{error}</p>
  if (!preview) return <p className="text-sm" style={labelStyle}>Loading...</p>

  const o = preview.offer
  const left = o ? preview.recipientCount - o.sentCount : preview.recipientCount

  return (
    <div className="space-y-6" data-admin-offer>
      <div>
        <h1 className="text-xl font-semibold mb-1">Member offer - {preview.amountOff} off any plugin</h1>
        <p className="text-sm" style={labelStyle}>
          One single-use code per account, made in Stripe as each email goes, good for {preview.days} days. Only
          accounts that exist when you first press Send get one, and only those still taking email from us and with
          something left to buy. It applies itself at checkout for a signed-in member, and for anyone who follows
          the link in their email.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {notice && <p className="text-sm" style={{ color: "var(--primary)" }}>{notice}</p>}

      <section className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-medium">{preview.subject}</h2>
          <span className="text-sm" style={labelStyle} data-offer-count>
            {preview.recipientCount} account{preview.recipientCount === 1 ? "" : "s"}
          </span>
        </div>

        {o && (
          <div className="text-sm mb-4 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <p style={labelStyle}>
              {o.completedAt ? `Sent ${fmtDate(o.completedAt)}` : `Started ${fmtDate(o.createdAt)} - not finished`}
              {o.sentByEmail ? ` by ${o.sentByEmail}` : ""}
            </p>
            <p style={labelStyle}>
              Accounts made up to {fmtDate(o.cutoffAt)}. Codes expire {fmtDate(o.expiresAt)}.
            </p>
            <p style={labelStyle}>
              {o.sentCount} sent
              {o.failedEmails.length > 0 &&
                `, ${o.failedEmails.length} failed (${o.failedEmails.slice(0, 3).join(", ")}${o.failedEmails.length > 3 ? ", ..." : ""})`}
            </p>
          </div>
        )}

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

        {progress && <p className="text-sm mb-3" style={{ color: "var(--primary)" }}>{progress}</p>}

        <div className="mb-4 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm mb-2" style={labelStyle}>
            Try it for real first: the same email, with a working single-use code, to one address. It does not start the
            offer. The code applies through the email&apos;s link, or typed into the promo box - not by signing in.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void sendTestCode()
            }}
          >
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
              aria-label="Send a working test code to"
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--border)", background: "transparent", color: "var(--foreground)" }}
              data-offer-test-to
            />
            <button type="submit" className={btnCls} style={btnStyle} disabled={busy !== null || !testTo.trim()} data-offer-test-code>
              {busy === "test-code" ? "Sending..." : "Send a working code"}
            </button>
          </form>
        </div>

        <div className="flex gap-2">
          <button className={btnCls} style={btnStyle} disabled={busy !== null} onClick={sendTest}>
            {busy === "test" ? "Sending..." : "Send test to me"}
          </button>
          <button
            className={btnCls}
            style={primaryBtnStyle}
            disabled={busy !== null || left <= 0 || Boolean(o?.completedAt)}
            onClick={() => send(preview)}
            data-offer-send
          >
            {busy === "send"
              ? "Sending..."
              : o?.completedAt
                ? "Sent"
                : o
                  ? `Resume - ${left} left`
                  : `Send to ${preview.recipientCount} accounts`}
          </button>
        </div>
      </section>
    </div>
  )
}
