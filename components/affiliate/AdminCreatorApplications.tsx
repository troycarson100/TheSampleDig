"use client"

import { useCallback, useEffect, useState } from "react"
import { APPLICATION_PLUGIN_LABEL, CREATOR_COMMISSION_PERCENT, type ApplicationPlugin } from "@/lib/affiliate-application-logic"
import { creatorCountryName } from "@/lib/creator-countries"

// Applications from the public /creators page, at the top of
// /admin/affiliates. Approve makes the creator and emails them their
// dashboard; decline files it. See lib/affiliate-application.ts.

type Application = {
  id: string
  email: string
  name: string
  country: string
  plugin: string
  socials: string[]
  message: string
  status: string
  createdAt: string
  decidedAt: string | null
}

const btnCls = "rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer whitespace-nowrap"
const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })

export default function AdminCreatorApplications({ onApproved }: { onApproved: () => void }) {
  const [pending, setPending] = useState<Application[]>([])
  const [decided, setDecided] = useState<Application[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/affiliates/applications")
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || "Couldn't load applications.")
    setPending(data.pending)
    setDecided(data.decided)
  }, [])

  useEffect(() => {
    let live = true
    ;(async () => {
      const res = await fetch("/api/admin/affiliates/applications")
      const data = await res.json().catch(() => ({}))
      if (!live) return
      if (!res.ok) return setError(data.error || "Couldn't load applications.")
      setPending(data.pending)
      setDecided(data.decided)
    })()
    return () => {
      live = false
    }
  }, [])

  async function decide(a: Application, action: "approve" | "decline") {
    if (action === "approve" && !window.confirm(`Approve ${a.name} at ${CREATOR_COMMISSION_PERCENT}%? They'll be emailed their dashboard link straight away.`)) return
    setBusy(a.id)
    setError("")
    setNotice("")
    const res = await fetch("/api/admin/affiliates/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, action }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) {
      setError(data.error || "That didn't work.")
      return void load()
    }
    if (action === "approve") {
      setNotice(
        data.emailed
          ? `${a.name} is in as "${data.affiliate.code}" and has been emailed their dashboard.`
          : `${a.name} is in as "${data.affiliate.code}", but the email didn't send - copy their dashboard link from their row below.`,
      )
      onApproved()
    } else {
      setNotice(`Declined ${a.name}.`)
    }
    void load()
  }

  return (
    <section className="rounded-xl border p-4 sm:p-5 mb-8" style={{ borderColor: pending.length ? "var(--primary)" : "var(--border)" }} data-creator-applications>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Applications {pending.length ? `(${pending.length} waiting)` : ""}</h2>
        <a href="/creators" target="_blank" rel="noreferrer" className="text-sm underline" style={{ opacity: 0.7 }}>
          Public page
        </a>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-2 text-sm" style={{ color: "var(--primary)" }}>{notice}</p>}
      {pending.length === 0 ? (
        <p className="mt-2 text-sm" style={{ opacity: 0.6 }}>
          None waiting. New ones from sampleroll.com/creators land here, and you&apos;re emailed for each.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {pending.map((a) => (
            <li key={a.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }} data-application={a.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {a.name} <span className="font-normal text-sm" style={{ opacity: 0.7 }}>&lt;{a.email}&gt;</span>
                </p>
                <p className="text-xs" style={{ opacity: 0.6 }}>{fmt(a.createdAt)}</p>
              </div>
              <p className="text-sm mt-0.5" style={{ opacity: 0.75 }}>
                {creatorCountryName(a.country)} &middot; video on {APPLICATION_PLUGIN_LABEL[a.plugin as ApplicationPlugin] ?? a.plugin}
              </p>
              {a.socials.length > 0 && (
                <ul className="mt-2 text-sm space-y-0.5" data-application-socials>
                  {a.socials.map((url) => (
                    <li key={url} className="truncate">
                      <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="underline" style={{ color: "var(--primary)" }}>
                        {url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm mt-2 whitespace-pre-line">{a.message}</p>
              <div className="mt-3 flex gap-2">
                <button className={btnCls} style={{ borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }} disabled={busy !== null} onClick={() => decide(a, "approve")}>
                  {busy === a.id ? "…" : `Approve at ${CREATOR_COMMISSION_PERCENT}%`}
                </button>
                <button className={btnCls} style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "transparent" }} disabled={busy !== null} onClick={() => decide(a, "decline")}>
                  Decline
                </button>
                <a className={`${btnCls} no-underline`} style={{ borderColor: "var(--border)", color: "var(--foreground)" }} href={`mailto:${a.email}`}>
                  Email them
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {decided.length > 0 && (
        <details className="mt-3">
          <summary className="text-sm cursor-pointer" style={{ opacity: 0.7 }}>Recently decided ({decided.length})</summary>
          <ul className="mt-2 space-y-1 text-sm" style={{ opacity: 0.75 }}>
            {decided.map((a) => (
              <li key={a.id}>
                {a.decidedAt ? fmt(a.decidedAt) : ""} - {a.status} - {a.name} &lt;{a.email}&gt;, {creatorCountryName(a.country)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
