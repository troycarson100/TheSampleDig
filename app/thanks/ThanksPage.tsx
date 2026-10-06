"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import PluginKeyCard from "@/components/PluginKeyCard"
import CompleteSetCard, { type CompleteSetCardOffer } from "@/components/CompleteSetCard"
import EmailChangeForm from "@/components/EmailChangeForm"
import { useCart } from "@/components/CartProvider"
import { trackMeta } from "@/lib/meta-pixel"
import { PRICING } from "@/lib/products"
import type { PluginId } from "@/lib/plugins"
import type { CompProduct } from "@/lib/plugin-products"

type Download = { id: string; label: string; href: string }
type Item = { product: PluginId; licenseKey: string; downloads: Download[] }
type Claim = {
  ok: true
  product: CompProduct
  email: string
  signedIn: boolean
  /** Nothing this checkout bought could be shown here: the account predates
   *  it, the viewer is not its owner, and everything was already owned. */
  withheld: boolean
  /** The account predates this checkout and the viewer is not signed in as
   *  its owner. Only what this checkout itself bought is in `items`; the
   *  account's other keys, and its set-password link, are not. */
  existingAccount?: boolean
  needsPassword: boolean
  setPasswordUrl: string | null
  duplicates: string[]
  items: Item[]
  /** Product ids this Stripe session paid for, present even when `withheld`
   *  is true. Not a secret from whoever holds the session id - it is what
   *  they just bought - so it is safe to use for clearing the cart even when
   *  keys and download links are not. */
  purchasedIds: PluginId[]
  /** The rest of the set at the complete-your-set price, for a day; null
   *  when they own none or all of it. */
  completeSet?: CompleteSetCardOffer | null
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

function fallbackPaid(product: string): number {
  return PRICING[product as keyof typeof PRICING]?.price ?? PRICING.shft.price
}

/** This page's own address: it keeps working, so it is the buyer's private
 *  download page until they make an account - the same idea as a gift link's
 *  private link. */
function SavePageCard() {
  // Only ever rendered once the claim has come back, in the browser, so
  // window is there. Without the pixel's `paid`/`product`: the session id is
  // all the page needs.
  const [url] = useState(() => {
    const u = new URL(window.location.href)
    return `${u.origin}${u.pathname}?session_id=${u.searchParams.get("session_id") ?? ""}`
  })
  const [copied, setCopied] = useState(false)
  return (
    <section className="rounded-xl border p-5 sm:p-6" style={card} data-save-page>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
        Save this page
      </h2>
      <p className="text-[14px] mb-3" style={muted}>
        This link is your private download page until you have an account - bookmark it, or keep it
        somewhere safe. It&apos;s your keys, so don&apos;t share it.
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          aria-label="Your private download page"
          className="rounded-lg border px-3 py-2 text-sm outline-none flex-1 min-w-0"
          style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "rgba(255,255,255,0.45)" }}
        />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url).catch(() => {})
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          }}
          className="inline-flex items-center rounded-lg px-3 py-2 text-[13px] font-medium border cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "transparent" }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  )
}

function AccountBlock({ claim }: { claim: Claim }) {
  if (claim.needsPassword && claim.setPasswordUrl) {
    return (
      <section className="rounded-xl border p-5 sm:p-6" style={card} data-account-block="create">
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
          Create your account
        </h2>
        <p className="text-[15px] mb-3" style={{ color: "var(--foreground)" }}>
          Your plugins are saved to <strong>{claim.email}</strong>. Set a password to create your
          account, so you can download them again any time, get updates and manage your machines.
        </p>
        <a href={claim.setPasswordUrl} className={primaryBtn} style={primaryBtnStyle}>
          Create my account
        </a>
      </section>
    )
  }
  if (claim.existingAccount && !claim.signedIn) {
    return (
      <section className="rounded-xl border p-5 sm:p-6" style={card} data-account-block="existing">
        <p className="text-[15px] mb-3" style={{ color: "var(--foreground)" }}>
          These are saved to your Sample Roll account, <strong>{claim.email}</strong>. Sign in to
          download them again any time, get updates and manage your machines.
        </p>
        <Link href="/login?callbackUrl=%2Fproducts" className={primaryBtn} style={primaryBtnStyle}>
          Sign in
        </Link>
        <p className="text-[13px] mt-3" style={muted}>
          Never set a password, or forgotten it?{" "}
          <Link href="/forgot-password" className="underline">
            Reset it
          </Link>{" "}
          with that email.
        </p>
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
  const [changingEmail, setChangingEmail] = useState(false)
  // Named to avoid shadowing the effect's local `const sessionId`, which is
  // still the value the claim request uses.
  const [claimSessionId, setClaimSessionId] = useState<string | null>(null)
  // Destructured, not the whole cart object: useCartState() returns a new
  // object every render, but removeMany itself is useCallback-stable, so
  // this is safe to depend on below without re-running the claim fetch.
  const { removeMany } = useCart()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get("session_id")
    if (!sessionId) {
      setState({ kind: "empty" })
      return
    }
    setClaimSessionId(sessionId)

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
      .then((claim) => {
        // The cart is never cleared anywhere else: not on the redirect to
        // Stripe (that would empty an abandoned checkout) and not by the
        // ownership-drop effect (a guest has no session for it to see). This
        // is the one place a purchase is confirmed, so it's the one place
        // the ids it actually paid for come out of the cart — only those
        // ids, not the whole cart, in case something else was added since.
        // `claim.purchasedIds` is what grantPluginPurchase resolved for this
        // session (fresh grants and already-owned duplicates alike) and is
        // present even when the claim is withheld, so a returning guest who
        // is not signed in still gets their cart cleared. removeMany no-ops
        // on ids no longer present, so reloading /thanks after the cart has
        // already been cleared changes nothing.
        if (claim) removeMany(claim.purchasedIds)
        setState(claim ? { kind: "ready", claim } : { kind: "error" })
      })
      .catch(() => setState({ kind: "error" }))
  }, [removeMany])

  if (state.kind === "empty") {
    return (
      <>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Nothing to claim here
        </h1>
        <p className="text-[15px]" style={muted}>
          Looking for your downloads?{" "}
          <Link href="/products" className="underline">My Products</Link> has them, or{" "}
          <Link href="/shft" className="underline">browse the plugins</Link>.
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
      <p className="text-[15px] mb-2" style={muted}>
        Here&apos;s everything you need. We&apos;ve also sent it to <strong>{claim.email}</strong> -
        check spam if it isn&apos;t there, or{" "}
        <Link href="/lost-key" className="underline">resend it</Link>.
      </p>
      <div className="mb-8">
        {claim.existingAccount ? null : !changingEmail ? (
          <button
            type="button"
            onClick={() => setChangingEmail(true)}
            className="text-[14px] underline cursor-pointer"
            style={{ color: "var(--foreground)", opacity: 0.75, background: "none", border: "none", padding: 0 }}
          >
            Wrong address? Change it
          </button>
        ) : (
          <div className="max-w-sm">
            <p className="text-[14px] mb-2" style={muted}>
              We&apos;ll email the new address to confirm. Your key and downloads on this page keep
              working either way.
            </p>
            <EmailChangeForm currentEmail={claim.email} sessionId={claimSessionId ?? undefined} compact />
          </div>
        )}
      </div>

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
          <PluginKeyCard key={item.product} item={item} />
        ))}
        {claim.completeSet ? <CompleteSetCard offer={claim.completeSet} /> : null}
        <AccountBlock claim={claim} />
        {claim.signedIn ? null : <SavePageCard />}
      </div>
    </>
  )
}
