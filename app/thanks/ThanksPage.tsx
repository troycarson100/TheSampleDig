"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import WindowsInstallNote from "@/components/WindowsInstallNote"
import { trackMeta } from "@/lib/meta-pixel"
import { PRICING } from "@/lib/products"

type Download = { id: string; label: string; href: string }
type Item = { product: "shft" | "drft"; licenseKey: string; downloads: Download[] }
type Claim = {
  ok: true
  product: "shft" | "drft" | "bundle"
  email: string
  signedIn: boolean
  /** The account predates this checkout and the viewer is not signed in as
   *  its owner: keys and the set-password link were not returned. */
  withheld: boolean
  needsPassword: boolean
  setPasswordUrl: string | null
  duplicates: string[]
  items: Item[]
}

type State =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; claim: Claim }

const muted = { color: "var(--foreground)", opacity: 0.75 } as const
const card = { borderColor: "var(--border)" } as const
const primaryBtn =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold no-underline"
const primaryBtnStyle = { background: "var(--primary)", color: "var(--primary-foreground, #fff)" } as const
const ghostBtn = "inline-flex items-center rounded-lg px-3 py-2 text-[13px] font-medium border"
const ghostBtnStyle = { borderColor: "var(--border)", color: "var(--foreground)" } as const

function fallbackPaid(product: string): number {
  if (product === "bundle") return PRICING.bundle.price
  if (product === "drft") return PRICING.drft.price
  return PRICING.shft.price
}

function KeyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <code
        className="text-[15px] tracking-wider rounded-lg px-3 py-2 border"
        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
      >
        {value}
      </code>
      <button type="button" onClick={copy} className={ghostBtn} style={ghostBtnStyle}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

function ItemCard({ item }: { item: Item }) {
  return (
    <section className="rounded-xl border p-5 sm:p-6" style={card}>
      <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--foreground)" }}>
        {item.product}
      </h2>
      <p className="text-[13px] font-medium mb-2" style={{ color: "var(--foreground)", opacity: 0.7 }}>
        Licence key
      </p>
      <KeyRow value={item.licenseKey} />
      <p className="text-[14px] mt-3 mb-4" style={muted}>
        Paste it into {item.product} the first time you open it. One key covers 3 machines.
      </p>
      <div className="flex flex-wrap gap-3">
        {item.downloads.map((d) => (
          <a key={d.id} href={d.href} className={primaryBtn} style={primaryBtnStyle}>
            ↓ {d.label}
          </a>
        ))}
      </div>
      {item.downloads.some((d) => d.id === "installer-win") && (
        <WindowsInstallNote product={item.product} />
      )}
    </section>
  )
}

function AccountBlock({ claim }: { claim: Claim }) {
  if (claim.needsPassword && claim.setPasswordUrl) {
    return (
      <section className="rounded-xl border p-5 sm:p-6" style={card}>
        <p className="text-[15px] mb-3" style={{ color: "var(--foreground)" }}>
          Your purchase is saved to <strong>{claim.email}</strong>. Set a password to see it on
          My Products, manage your machines, and re-download any time.
        </p>
        <a href={claim.setPasswordUrl} className={primaryBtn} style={primaryBtnStyle}>
          Set a password
        </a>
      </section>
    )
  }
  if (claim.signedIn) {
    return (
      <section className="rounded-xl border p-5 sm:p-6" style={card}>
        <p className="text-[15px] mb-3" style={{ color: "var(--foreground)" }}>
          This is saved to your account. Downloads, keys and machine management live in My Products.
        </p>
        <Link href="/products" className={primaryBtn} style={primaryBtnStyle}>
          Go to My Products
        </Link>
      </section>
    )
  }
  return (
    <section className="rounded-xl border p-5 sm:p-6" style={card}>
      <p className="text-[15px] mb-3" style={{ color: "var(--foreground)" }}>
        Sign in with <strong>{claim.email}</strong> to see this on My Products.
      </p>
      <Link href="/login?callbackUrl=%2Fproducts" className={primaryBtn} style={primaryBtnStyle}>
        Sign in
      </Link>
      <p className="text-[13px] mt-3" style={muted}>
        Forgot your password?{" "}
        <Link href="/forgot-password" className="underline">
          Reset it
        </Link>
        .
      </p>
    </section>
  )
}

export default function ThanksPage() {
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get("session_id")
    if (!sessionId) {
      setState({ kind: "empty" })
      return
    }

    // Meta Pixel: one Purchase per session, even if the page is reloaded.
    const product = params.get("product") ?? "shft"
    const paid = Number(params.get("paid")) || fallbackPaid(product)
    const pixelKey = `purchase-pixel:${sessionId}`
    try {
      if (!sessionStorage.getItem(pixelKey)) {
        trackMeta("Purchase", { value: paid, currency: "USD", content_name: product, content_type: "product" })
        sessionStorage.setItem(pixelKey, "1")
      }
    } catch {
      trackMeta("Purchase", { value: paid, currency: "USD", content_name: product, content_type: "product" })
    }

    fetch("/api/plugins/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (r) => (r.ok ? ((await r.json()) as Claim) : null))
      .then((claim) => setState(claim ? { kind: "ready", claim } : { kind: "error" }))
      .catch(() => setState({ kind: "error" }))
  }, [])

  if (state.kind === "empty") {
    return (
      <>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Nothing to claim here
        </h1>
        <p className="text-[15px]" style={muted}>
          Looking for your downloads?{" "}
          <Link href="/products" className="underline">My Products</Link> has them, or{" "}
          <Link href="/plugins" className="underline">browse the plugins</Link>.
        </p>
      </>
    )
  }

  if (state.kind === "loading") {
    return (
      <>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Confirming your purchase…
        </h1>
        <p className="text-[15px]" style={muted}>One moment.</p>
      </>
    )
  }

  if (state.kind === "error") {
    return (
      <>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          We couldn&apos;t confirm that purchase
        </h1>
        <p className="text-[15px] mb-4" style={muted}>
          If you were charged, your licence key is on its way by email. Not there?{" "}
          <Link href="/lost-key" className="underline">Resend it</Link>, or reply to your receipt and
          we&apos;ll sort you out.
        </p>
      </>
    )
  }

  const { claim } = state

  if (claim.withheld) {
    return (
      <>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Thanks - you&apos;re all set
        </h1>
        <p className="text-[15px] mb-4" style={muted}>
          This purchase has been added to the account for <strong>{claim.email}</strong>. Your
          licence key and download links are in the receipt we&apos;ve just sent there - check
          spam if it isn&apos;t in your inbox, or{" "}
          <Link href="/lost-key" className="underline">resend it</Link>.
        </p>
        <p className="text-[15px] mb-6" style={muted}>
          Sign in with that email to see everything on My Products.
        </p>
        <Link href="/login?callbackUrl=%2Fproducts" className={primaryBtn} style={primaryBtnStyle}>
          Sign in
        </Link>
      </>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
        You&apos;re in
      </h1>
      <p className="text-[15px] mb-8" style={muted}>
        Here&apos;s everything you need. We&apos;ve also sent it to <strong>{claim.email}</strong> -
        check spam if it isn&apos;t there, or{" "}
        <Link href="/lost-key" className="underline">resend it</Link>.
      </p>

      {claim.duplicates.length > 0 && (
        <div
          className="rounded-xl border p-4 mb-5 text-[14px]"
          style={{ borderColor: "#fde68a", background: "#fef9c3", color: "#854d0e" }}
        >
          It looks like {claim.email} already owned {claim.duplicates.join(" and ")}. The duplicate
          charge will be refunded - reply to your receipt if it hasn&apos;t landed in a few days.
        </div>
      )}

      <div className="space-y-5">
        {claim.items.map((item) => (
          <ItemCard key={item.product} item={item} />
        ))}
        <AccountBlock claim={claim} />
      </div>
    </>
  )
}
