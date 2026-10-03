"use client"

import { useEffect, useState } from "react"
import { COMPLETE_SET_PRICE } from "@/lib/complete-set-logic"

const SET = `$${COMPLETE_SET_PRICE[2]}`

type Variant = "code" | "set" | "code+set"

interface Preview {
  slug: string
  unavailable: string | null
  samples: { variant: string; subject: string; html: string }[]
  recipientCount: number
  byVariant: Record<Variant, number>
  excluded: { "opted-out": number; "nothing-to-offer": number } | null
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

const URL = "/api/admin/offers/video"

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

export default function AdminVideoEmail() {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState<"test" | "send" | null>(null)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function load() {
    const { ok, data, message } = await readJson(await fetch(URL))
    if (!ok || !data) return setError(message || "Could not load the video email.")
    setPreview(data.preview as Preview)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { ok, data, message } = await readJson(await fetch(URL))
      if (cancelled) return
      if (!ok || !data) return setError(message || "Could not load the video email.")
      setPreview(data.preview as Preview)
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
    setNotice(`All three versions sent to ${String(data.sentTo)}. The code is an example and works nowhere, and the ${SET} button goes to the fltr page.`)
  }

  async function send(p: Preview) {
    setError("")
    setNotice("")
    if (!p.send) {
      const confirmed = window.confirm(
        `Email the fltr video to ${people(p.recipientCount)}?\n\n` +
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
        Working out who the video email goes to - asking Stripe which codes have been used...
      </p>
    )
  }

  const r = preview.send
  const left = r ? preview.recipientCount - r.sentCount - r.skippedCount : preview.recipientCount
  const x = preview.excluded
  const v = preview.byVariant

  return (
    <div className="space-y-6" data-admin-video-email>
      <div>
        <h1 className="text-xl font-semibold mb-1">Third email - the fltr video</h1>
        <p className="text-sm" style={labelStyle}>
          The deep-dive video, with each person&apos;s own offers: their $10 code if it&apos;s unused, and the other two
          plugins for {SET} (until October 31) if they own exactly one. Anyone with neither isn&apos;t sent it, and
          neither is anyone who has unsubscribed.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {notice && <p className="text-sm" style={{ color: "var(--primary)" }}>{notice}</p>}
      {preview.unavailable && <p className="text-sm text-red-500">{preview.unavailable}</p>}

      <section className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-medium">fltr, in depth</h2>
          <span className="text-sm" style={labelStyle} data-video-count>
            {people(preview.recipientCount)}
          </span>
        </div>

        <div className="text-sm mb-4 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          {r && (
            <p style={labelStyle}>
              {r.completedAt ? `Sent ${fmtDate(r.completedAt)}` : `Started ${fmtDate(r.createdAt)} - not finished`}
            </p>
          )}
          <p style={labelStyle} data-video-variants>
            {v.code} get their code, {v.set} get the {SET} offer, {v["code+set"]} get both.
          </p>
          {x && (
            <p style={labelStyle}>
              Left out: {x["nothing-to-offer"]} with nothing left to offer, {x["opted-out"]} unsubscribed.
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
            {busy === "test" ? "Sending..." : "Send all three tests to me"}
          </button>
          <button
            className={btnCls}
            style={primaryBtnStyle}
            disabled={busy !== null || left <= 0 || Boolean(r?.completedAt) || Boolean(preview.unavailable)}
            onClick={() => send(preview)}
            data-video-send
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
