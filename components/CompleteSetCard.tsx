"use client"

import { useEffect, useMemo, useState } from "react"
import { PLUGINS, type PluginId } from "@/lib/plugins"

// "Complete your set" on /thanks: the plugins this buyer still doesn't own,
// at the complete-set price, for a day. See lib/complete-set-logic.ts.

export type CompleteSetCardOffer = {
  missing: PluginId[]
  price: number
  compareAt: number
  endsAt: string
  token: string
}

/** "23:59:41" until `endsAt`, ticking - or "" before mount, so the server
 *  renders no time and hydration matches. Under a day by construction, so no
 *  days column (the sale strip's clock has one, and it read "00"). */
function useTimeLeft(endsAt: Date, onEnd: () => void): string {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (t >= endsAt.getTime()) onEnd()
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt, onEnd])
  if (now === null) return ""
  const s = Math.max(0, Math.floor((endsAt.getTime() - now) / 1000))
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

export default function CompleteSetCard({ offer }: { offer: CompleteSetCardOffer }) {
  const endsAt = useMemo(() => new Date(offer.endsAt), [offer.endsAt])
  const [ended, setEnded] = useState(() => endsAt.getTime() <= Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const names = offer.missing.map((id) => PLUGINS[id].name).join(" + ")
  const end = useMemo(() => () => setEnded(true), [])
  const left = useTimeLeft(endsAt, end)

  async function buy() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/cart/complete-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: offer.token }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data.url === "string") {
        window.location.assign(data.url)
        return
      }
      setError(typeof data.error === "string" ? data.error : "That didn't work. Try again.")
    } catch {
      setError("That didn't work. Try again.")
    }
    setBusy(false)
  }

  if (ended) return null

  return (
    <section
      className="rounded-xl border-2 p-5 sm:p-6"
      style={{ borderColor: "var(--primary)", background: "rgba(255, 255, 255, 0.4)" }}
      data-complete-set
    >
      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--primary)", fontFamily: "var(--font-ibm-mono), monospace" }}>
        Complete your set · today only
      </p>
      <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
        Add {names} for ${offer.price}{" "}
        <s className="font-normal text-base" style={{ opacity: 0.5 }}>${offer.compareAt}</s>
      </h2>
      <ul className="space-y-2 mb-4">
        {offer.missing.map((id) => {
          const p = PLUGINS[id]
          return (
            <li key={id} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.art.card} alt="" className="h-11 w-11 rounded-md object-cover shrink-0" />
              <span className="text-[14px]" style={{ color: "var(--foreground)" }}>
                <strong>{p.name}</strong> <span style={{ opacity: 0.7 }}>{p.tagline}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={buy}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)", border: "none" }}
        >
          {busy ? "Opening checkout…" : `Get ${offer.missing.length === 1 ? "it" : "both"} for $${offer.price}`}
        </button>
        {left ? (
          <span className="text-[13px]" style={{ color: "var(--foreground)", opacity: 0.75, fontFamily: "var(--font-ibm-mono), monospace" }}>
            {left} left
          </span>
        ) : null}
      </div>
      {error && <p className="text-[14px] mt-3 text-red-700">{error}</p>}
    </section>
  )
}
