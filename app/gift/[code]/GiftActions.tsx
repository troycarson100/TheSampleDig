"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold disabled:opacity-50 cursor-pointer"
const primaryBtnStyle = { background: "var(--primary)", color: "var(--primary-foreground, #fff)", border: "none" } as const
const ghostBtn = "inline-flex items-center rounded-lg px-3 py-2 text-[13px] font-medium border cursor-pointer disabled:opacity-50"
const ghostBtnStyle = { borderColor: "var(--border)", color: "var(--foreground)", background: "transparent" } as const
const fieldCls = "rounded-lg border px-3 py-2 text-sm outline-none flex-1 min-w-0"
const fieldStyle = { borderColor: "var(--border)", color: "var(--foreground)", background: "rgba(255, 255, 255, 0.45)" }

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return { ok: res.ok, data: await res.json().catch(() => ({})) }
}

/** Claims the gift, then reloads onto the private link, so what is in the
 *  address bar is already the link that gets back here from anywhere. */
export function ClaimButton({ code }: { code: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function claim() {
    setBusy(true)
    setError("")
    const { ok, data } = await post(`/api/gift/${encodeURIComponent(code)}/claim`, {}).catch(() => ({
      ok: false,
      data: {} as Record<string, unknown>,
    }))
    if (ok && typeof data.token === "string") {
      router.replace(`/gift/${encodeURIComponent(code)}?k=${encodeURIComponent(data.token)}`)
      router.refresh()
      return
    }
    setError(typeof data.error === "string" ? data.error : "That didn't work. Try again.")
    setBusy(false)
    // Taken in the meantime: show the page as it now is.
    if (data.reason) router.refresh()
  }

  return (
    <div>
      <button type="button" className={primaryBtn} style={primaryBtnStyle} disabled={busy} onClick={claim}>
        {busy ? "Claiming…" : "Claim your gift"}
      </button>
      {error && <p className="text-[14px] mt-3 text-red-700">{error}</p>}
    </div>
  )
}

export function PrivateLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={url} className={fieldCls} style={fieldStyle} onFocus={(e) => e.target.select()} aria-label="Your private link" />
      <button type="button" className={ghostBtn} style={ghostBtnStyle} onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

export function GiftEmailForm({ code, token }: { code: string; token: string }) {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    const { ok, data } = await post(`/api/gift/${encodeURIComponent(code)}/email`, { email, token }).catch(() => ({
      ok: false,
      data: {} as Record<string, unknown>,
    }))
    if (ok) setSentTo(email.trim())
    else setError(typeof data.error === "string" ? data.error : "Could not send the email. Try again.")
    setBusy(false)
  }

  if (sentTo) {
    return (
      <p className="text-[14px]" style={{ color: "var(--foreground)" }}>
        Sent to <strong>{sentTo}</strong>. Check spam if it isn&apos;t there in a minute. Open the
        &ldquo;Save to my account&rdquo; button in it to keep everything on Sample Roll.
      </p>
    )
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-center gap-2">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-label="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldCls}
          style={fieldStyle}
        />
        <button type="submit" className={ghostBtn} style={ghostBtnStyle} disabled={busy || !email.trim()}>
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p className="text-[14px] mt-2 text-red-700">{error}</p>}
    </form>
  )
}
