"use client"

// Order summary on the right, buyer identification on the left — this is
// where a cart becomes an identified sale.
//
// Two identities feed this: a NextAuth session (ownership already known
// exactly, no form needed) or a typed email (a guest — no account, no
// password, no verification step; one gets created and verified automatically
// after purchase by machinery that already exists elsewhere). The confirm-email
// field is load-bearing, not decoration: licence keys are delivered by email
// and there is no verification step to catch a typo, so a mismatch is rejected
// before anything is sent anywhere. A typo is also exactly what the ownership
// check below would silently miss — get the address right, or the check means
// nothing.
//
// On blur of a valid, matching email we ask /api/cart/owned what that address
// already owns and drop it from the cart right here, before Stripe ever sees
// it — the whole point of doing this identification step before checkout
// instead of at the Stripe redirect. /api/cart/checkout re-checks the same
// thing server-side regardless (ids and email are never trusted from a prior
// response), so a rate-limited or skipped lookup here must never block a
// legitimate sale — it only ever saves the buyer a round trip through Stripe.
//
// trackMeta("InitiateCheckout", ...) fires from the submit handler below. It
// used to fire from BuyButton, back when "buy" meant "go straight to Stripe";
// once buying became add-to-cart, nothing fired it at all. This is the first
// point after that change where a checkout genuinely begins, so this is where
// it belongs.

import { useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { useCart } from "@/components/CartProvider"
import PluginGlyph from "@/components/plugin-page/PluginGlyph"
import PromoCodeField from "@/components/PromoCodeField"
import { formatCents } from "@/lib/cart-promo"
import { PLUGIN_ORDER, PLUGINS, type PluginId } from "@/lib/plugins"
import { trackMeta } from "@/lib/meta-pixel"
import { usePageRestore } from "@/lib/use-page-restore"
import styles from "./checkout.module.css"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CALLBACK_URL = "/checkout"
/** Past this, the button gives up and says so rather than spinning on. */
const CHECKOUT_TIMEOUT_MS = 30_000

const isPluginId = (v: unknown): v is PluginId =>
  typeof v === "string" && (PLUGIN_ORDER as readonly string[]).includes(v)

function toPluginIds(value: unknown): PluginId[] {
  return Array.isArray(value) ? value.filter(isPluginId) : []
}

/** "shft" / "shft and drft" / "shft, drft and fltr" — never an Oxford comma. */
function namesList(ids: readonly PluginId[]): string {
  const names = ids.map((id) => PLUGINS[id].name)
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** "You already own drft, so we've taken it out of your cart." */
function ownedNoticeText(ids: readonly PluginId[]): string {
  const pronoun = ids.length === 1 ? "it" : "them"
  return `You already own ${namesList(ids)}, so we've taken ${pronoun} out of your cart.`
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

type Phase =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "launch-pending" }
  | { kind: "fully-owned" }
  /** The server refused to override a live session with a different typed
   *  email (see /api/cart/checkout's `session_email_mismatch` reason) — this
   *  page rendered the guest form before useSession() picked up a sign-in
   *  from another tab. `sessionEmail` is the address that will actually be
   *  charged and granted if the buyer continues. */
  | { kind: "session-mismatch"; sessionEmail: string }
  | { kind: "error"; message: string }

type OwnershipStatus = "idle" | "checking" | "unavailable"

export default function CheckoutForm() {
  const cart = useCart()
  const { data: session, status } = useSession()

  const [email, setEmail] = useState("")
  const [confirmEmail, setConfirmEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [ownershipStatus, setOwnershipStatus] = useState<OwnershipStatus>("idle")
  const [ownedNotice, setOwnedNotice] = useState<PluginId[] | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "form" })
  // Back from Stripe restores this page as it was left - mid-submit, button
  // at "…". Put it back to the form. See lib/use-page-restore.ts.
  usePageRestore(() => setPhase((p) => (p.kind === "submitting" ? { kind: "form" } : p)))

  // Guards re-checking the same address twice (e.g. blurring email then
  // confirm-email with nothing changed in between) without needing an effect.
  const lastChecked = useRef<string | null>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const confirmInputRef = useRef<HTMLInputElement>(null)

  const accountEmail = session?.user?.email ?? null
  const signedIn = status === "authenticated" && Boolean(accountEmail)
  const hasItems = cart.totals.lines.length > 0

  if (!hasItems) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>Your cart is empty — there&apos;s nothing to check out yet.</p>
        <Link href="/shft" className={styles.emptyLink}>
          Browse plugins →
        </Link>
      </div>
    )
  }

  if (phase.kind === "fully-owned") {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>Everything in your cart is already yours.</p>
        <Link href="/products" className={styles.emptyLink}>
          Go to My Products →
        </Link>
      </div>
    )
  }

  if (phase.kind === "session-mismatch") {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          You&apos;re signed in as <strong>{phase.sessionEmail}</strong> in another tab, so checkout will
          use that account rather than the email you typed here.
        </p>
        <button
          type="button"
          className={styles.emptyLink}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
          onClick={() => void continueAsSession()}
        >
          Continue as {phase.sessionEmail} →
        </button>
        <button type="button" className={styles.switchAccount} onClick={() => signOut({ callbackUrl: CALLBACK_URL })}>
          Not you? Sign out
        </button>
      </div>
    )
  }

  async function checkOwnership(candidate: string) {
    const key = normalize(candidate)
    if (lastChecked.current === key) return
    lastChecked.current = key
    setOwnershipStatus("checking")
    try {
      const res = await fetch("/api/cart/owned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: key }),
      })
      if (!res.ok) {
        // 429 (rate limited) or anything else: the server re-checks this
        // exact question again at checkout, so failing open here never risks
        // a duplicate purchase — it only means this one visitor doesn't get
        // an early warning.
        setOwnershipStatus("unavailable")
        return
      }
      const data: unknown = await res.json().catch(() => null)
      const owned = toPluginIds((data as { owned?: unknown } | null)?.owned)
      setOwnershipStatus("idle")
      const ownedInCart = cart.ids.filter((id) => owned.includes(id))
      if (ownedInCart.length === 0) return
      setOwnedNotice(ownedInCart)
      ownedInCart.forEach((id) => cart.remove(id))
      const remaining = cart.ids.filter((id) => !ownedInCart.includes(id))
      if (remaining.length === 0) setPhase({ kind: "fully-owned" })
    } catch {
      setOwnershipStatus("unavailable")
    }
  }

  function validateEmail(value: string): string | null {
    if (!value.trim()) return "Enter your email address."
    if (!EMAIL_RE.test(value.trim())) return "Enter a valid email address."
    return null
  }

  function validateConfirm(value: string, against: string): string | null {
    if (!value.trim()) return "Confirm your email address."
    if (normalize(value) !== normalize(against)) return "This doesn't match the email above."
    return null
  }

  function handleEmailBlur() {
    const err = validateEmail(email)
    setEmailError(err)
    if (err || !confirmEmail) return
    const cErr = validateConfirm(confirmEmail, email)
    setConfirmError(cErr)
    if (!cErr) void checkOwnership(email)
  }

  function handleConfirmBlur() {
    const cErr = validateConfirm(confirmEmail, email)
    setConfirmError(cErr)
    if (cErr) return
    const err = validateEmail(email)
    setEmailError(err)
    if (!err) void checkOwnership(email)
  }

  // Shared by the normal submit and by "Continue as {sessionEmail}" below
  // (the resolution to a session/typed-email mismatch, which resubmits the
  // same cart with no posted email so the server falls back to the session)
  // — one place to read every status this route can return.
  async function submitCheckout(payload: { ids: PluginId[]; email?: string }) {
    setPhase({ kind: "submitting" })
    // A request that never answers would leave the button at "…" for good.
    const abort = new AbortController()
    const timer = window.setTimeout(() => abort.abort(), CHECKOUT_TIMEOUT_MS)
    try {
      const res = await fetch("/api/cart/checkout", {
        signal: abort.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The code and nothing about what it is worth: the server asks Stripe
        // that itself, at the moment of sale.
        body: JSON.stringify({ ...payload, ...(cart.promo ? { promoCode: cart.promo.code } : {}) }),
      })

      if (res.status === 200) {
        const data: unknown = await res.json().catch(() => null)
        const url = (data as { url?: unknown } | null)?.url
        if (typeof url === "string") {
          window.location.href = url
          return
        }
        setPhase({ kind: "error", message: "Something went wrong — try again in a moment." })
        return
      }

      if (res.status === 409) {
        const data: unknown = await res.json().catch(() => null)
        const reason = (data as { reason?: unknown } | null)?.reason
        if (reason === "already_owned") {
          const owns = toPluginIds((data as { owns?: unknown }).owns)
          setOwnedNotice(owns)
          owns.forEach((id) => cart.remove(id))
          setPhase({ kind: "form" })
          return
        }
        // The code held when it was typed in and does not now — expired, used
        // up, or not one this buyer may use. It comes off, so the summary goes
        // back to the real total, and the buyer decides again with that in
        // front of them rather than being sent to pay a price they did not see.
        if (reason === "promo_invalid") {
          cart.clearPromo()
          setPhase({
            kind: "error",
            message: "That promo code can't be used on this order, so we've taken it off. Check the total and continue when you're ready.",
          })
          return
        }
        if (reason === "session_email_mismatch") {
          const sessionEmail = (data as { sessionEmail?: unknown } | null)?.sessionEmail
          setPhase({
            kind: "session-mismatch",
            sessionEmail: typeof sessionEmail === "string" ? sessionEmail : (accountEmail ?? ""),
          })
          return
        }
        setPhase({ kind: "fully-owned" })
        return
      }

      if (res.status === 429) {
        setPhase({ kind: "error", message: "You've tried this too many times — please wait a moment and try again." })
        return
      }

      if (res.status === 503) {
        setPhase({ kind: "launch-pending" })
        return
      }

      setPhase({ kind: "error", message: "That didn't go through — check your details and try again." })
    } catch {
      setPhase({ kind: "error", message: "That didn't go through — check your connection and try again." })
    } finally {
      window.clearTimeout(timer)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (phase.kind === "submitting") return

    if (!signedIn) {
      const eErr = validateEmail(email)
      const cErr = validateConfirm(confirmEmail, email)
      setEmailError(eErr)
      setConfirmError(cErr)
      if (eErr || cErr) {
        ;(eErr ? emailInputRef : confirmInputRef).current?.focus()
        return
      }
    }

    // Checkout actually begins here — the moment a validated attempt is sent
    // to the server, not when the cart was built or a button first rendered.
    trackMeta("InitiateCheckout", { value: cart.quote.totalCents / 100, currency: "USD", content_type: "product" })
    await submitCheckout({ ids: cart.ids, ...(signedIn ? {} : { email: normalize(email) }) })
  }

  // The resolution offered on a session/typed-email mismatch: resubmit with
  // no posted email at all, so the server resolves the buyer from the
  // session alone — the same account the mismatch response just named.
  async function continueAsSession() {
    await submitCheckout({ ids: cart.ids })
  }

  const busy = phase.kind === "submitting"
  const launchPending = phase.kind === "launch-pending"
  const due = formatCents(cart.quote.totalCents)
  const submitLabel = busy ? "…" : launchPending ? "Opens at launch" : `Continue to payment · ${due}`

  return (
    <div className={styles.layout}>
      <section className={styles.identify} aria-labelledby="checkout-identify-title">
        <h1 id="checkout-identify-title" className={styles.pageTitle}>
          Checkout
        </h1>

        {cart.dropped.length > 0 && (
          <p className={styles.ownedNotice} role="status">
            {ownedNoticeText(cart.dropped)}
          </p>
        )}
        {ownedNotice && ownedNotice.length > 0 && (
          <p className={styles.ownedNotice} role="status">
            {ownedNoticeText(ownedNotice)}
          </p>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {status === "loading" ? (
            <div className={styles.identifyLoading} aria-busy="true" />
          ) : signedIn ? (
            <div className={styles.account}>
              <p className={styles.accountLabel}>Paying as</p>
              <p className={styles.accountEmail}>{accountEmail}</p>
              <button
                type="button"
                className={styles.switchAccount}
                onClick={() => signOut({ callbackUrl: CALLBACK_URL })}
              >
                Use a different account
              </button>
            </div>
          ) : (
            <>
              <p className={styles.signInPrompt}>
                Already have an account?{" "}
                <Link href={`/login?callbackUrl=${encodeURIComponent(CALLBACK_URL)}`} className={styles.signInLink}>
                  Sign in
                </Link>
              </p>

              <div className={styles.field}>
                <label htmlFor="checkout-email" className={styles.label}>
                  Email
                </label>
                <input
                  ref={emailInputRef}
                  id="checkout-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError(null)
                  }}
                  onBlur={handleEmailBlur}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "checkout-email-error" : undefined}
                />
                {emailError && (
                  <p id="checkout-email-error" className={styles.fieldError} role="alert">
                    {emailError}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="checkout-confirm-email" className={styles.label}>
                  Confirm email
                </label>
                <input
                  ref={confirmInputRef}
                  id="checkout-confirm-email"
                  name="confirmEmail"
                  type="email"
                  autoComplete="email"
                  className={styles.input}
                  value={confirmEmail}
                  onChange={(e) => {
                    setConfirmEmail(e.target.value)
                    if (confirmError) setConfirmError(null)
                  }}
                  onBlur={handleConfirmBlur}
                  aria-invalid={Boolean(confirmError)}
                  aria-describedby={confirmError ? "checkout-confirm-email-error" : undefined}
                />
                {confirmError && (
                  <p id="checkout-confirm-email-error" className={styles.fieldError} role="alert">
                    {confirmError}
                  </p>
                )}
              </div>

              {/* Always rendered (even with nothing to say) and given a fixed
                  min-height in CSS: appearing/disappearing here would shift
                  the submit button right as someone tabs or clicks from
                  confirm-email straight to it — exactly the moment a blur
                  triggers this text. A layout shift at that instant is a
                  real miss-click risk, not just a cosmetic wobble. */}
              <p className={styles.ownershipStatus} role="status">
                {ownershipStatus === "checking" && "Checking whether you already own anything…"}
                {ownershipStatus === "unavailable" &&
                  "We couldn't check that email right now — you can still continue."}
              </p>
            </>
          )}

          {phase.kind === "error" && (
            <p className={styles.submitError} role="alert">
              {phase.message}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={busy || launchPending || status === "loading"}>
            {submitLabel}
          </button>
        </form>
      </section>

      <aside className={styles.summary} aria-labelledby="checkout-summary-title">
        <h2 id="checkout-summary-title" className={styles.summaryTitle}>
          Order summary
        </h2>
        <ul className={styles.lines}>
          {cart.totals.lines.map((line) => {
            const plugin = PLUGINS[line.id]
            return (
              <li key={line.id} className={styles.line} style={{ ["--row-accent" as string]: plugin.accent }}>
                <PluginGlyph id={line.id} className={styles.lineGlyph} />
                <span className={styles.lineText}>
                  <span className={styles.lineName}>{plugin.name}</span>
                  <span className={styles.lineCategory}>{plugin.category}</span>
                </span>
                <span className={styles.linePrice}>
                  <span className={styles.price}>${line.price}</span>
                  <s className={styles.msrp}>${line.msrp}</s>
                </span>
              </li>
            )
          })}
          {cart.totals.bundleApplied && (
            <li className={`${styles.line} ${styles.bundleLine}`}>
              <span className={styles.bundleLabel}>Bundle — all three</span>
              <span className={styles.bundleSaving}>−${cart.totals.saving}</span>
            </li>
          )}
        </ul>
        {/* Here, outside the form on the left: it is a form of its own, and
            Enter in a box inside the checkout form would submit the order. */}
        <PromoCodeField idPrefix="checkout" className={styles.promo} />
        <div className={styles.dueRow}>
          <span className={styles.dueLabel}>Amount due</span>
          <span className={styles.dueValue}>
            <span className={styles.dueTotal} data-amount-due>{due}</span>
            <s className={styles.dueMsrp}>${cart.totals.msrpTotal}</s>
          </span>
        </div>
      </aside>
    </div>
  )
}
