"use client"

// The promo code box, used in the cart drawer and in the checkout page's order
// summary. One component for both, reading and writing the one code the cart
// holds, so a code applied in the drawer is already applied at checkout.
//
// Three states, and only ever one of them on screen:
//   closed  — a single line of text, "Have a promo code?". Most buyers do not
//             have one, and an empty box on every order makes the ones who do
//             not go looking for one.
//   open    — the box and its Apply button.
//   applied — the code, what it is worth, what it takes off, and Remove.
//
// Its own <form>, so Enter in the box applies the code. That is why this sits
// in the order summary at checkout and not among the email fields: a form
// cannot go inside another form, and Enter in a box inside the checkout form
// would submit the order.
//
// Focus follows the state. Each change takes away the control that had focus
// (Apply disappears when a code is applied, Remove when it is removed), and in
// the drawer a focus left on nothing falls out of the dialog's tab trap.

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useCart } from "@/components/CartProvider"
import { describeOffer, formatCents } from "@/lib/cart-promo"
import type { PromoFailure } from "@/lib/use-cart"
import styles from "./promo-code.module.css"

const FAILURE_TEXT: Record<PromoFailure, string> = {
  not_valid: "That code isn't valid.",
  rate_limited: "Too many tries — wait a minute and try again.",
  unavailable: "We couldn't check that code just now. Try again in a moment.",
}

export default function PromoCodeField({ idPrefix, className = "" }: { idPrefix: string; className?: string }) {
  const { promo, quote, applyPromo, clearPromo, memberCode } = useCart()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [checking, setChecking] = useState(false)
  const [failure, setFailure] = useState<PromoFailure | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const removeRef = useRef<HTMLButtonElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  // Which control to focus once the next state has rendered. Set by the
  // handler that caused the change, so a code that arrives from storage on
  // page load — a change nobody here caused — never moves focus.
  const focusNext = useRef<"input" | "remove" | "toggle" | null>(null)

  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    ;({ input: inputRef, remove: removeRef, toggle: toggleRef })[target].current?.focus()
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (checking) return
    setChecking(true)
    setFailure(null)
    const failed = await applyPromo(value)
    setChecking(false)
    if (failed) {
      setFailure(failed)
      focusNext.current = "input"
      return
    }
    setValue("")
    setOpen(false)
    focusNext.current = "remove"
  }

  if (promo) {
    const worth =
      quote.kind === "applied"
        ? `−${formatCents(quote.discountCents)}`
        : quote.kind === "at-payment"
          ? "at payment"
          : null
    return (
      <div className={`${styles.root} ${className}`} data-promo="applied">
        <div className={styles.applied}>
          <span className={styles.appliedText}>
            <span className={styles.code}>{promo.code}</span>
            <span className={styles.offer}>{describeOffer(promo)}</span>
          </span>
          {worth && <span className={styles.worth} data-promo-worth>{worth}</span>}
          <button
            ref={removeRef}
            type="button"
            className={styles.remove}
            onClick={() => {
              clearPromo()
              focusNext.current = "toggle"
            }}
            aria-label={`Remove promo code ${promo.code}`}
          >
            Remove
          </button>
        </div>
        {memberCode && promo.code.toUpperCase() === memberCode.toUpperCase() && (
          <p className={styles.note} data-promo-member>
            Your member code, applied for you. It works once, until it expires.
          </p>
        )}
        {quote.kind === "below-minimum" && (
          <p className={styles.note} role="status">
            This code needs an order of {formatCents(quote.minimumCents)} or more, so it isn&apos;t taking anything
            off yet.
          </p>
        )}
        {quote.kind === "at-payment" && (
          <p className={styles.note} role="status">
            This code covers certain plugins. What it takes off is worked out on the payment page.
          </p>
        )}
      </div>
    )
  }

  if (!open) {
    return (
      <div className={`${styles.root} ${className}`} data-promo="closed">
        <button
          ref={toggleRef}
          type="button"
          className={styles.toggle}
          onClick={() => {
            setOpen(true)
            focusNext.current = "input"
          }}
        >
          Have a promo code?
        </button>
      </div>
    )
  }

  const inputId = `${idPrefix}-promo-code`
  const errorId = `${idPrefix}-promo-error`
  return (
    <form className={`${styles.root} ${className}`} onSubmit={handleSubmit} noValidate data-promo="open">
      <label htmlFor={inputId} className={styles.label}>
        Promo code
      </label>
      <div className={styles.row}>
        <input
          ref={inputRef}
          id={inputId}
          name="promoCode"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={styles.input}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (failure) setFailure(null)
          }}
          aria-invalid={Boolean(failure)}
          aria-describedby={failure ? errorId : undefined}
        />
        <button type="submit" className={styles.apply} disabled={checking || value.trim() === ""}>
          {checking ? "…" : "Apply"}
        </button>
      </div>
      {failure && (
        <p id={errorId} className={styles.error} role="alert">
          {FAILURE_TEXT[failure]}
        </p>
      )}
    </form>
  )
}
