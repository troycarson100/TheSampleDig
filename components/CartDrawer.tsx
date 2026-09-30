"use client"

// The slide-out cart drawer, mounted once in app/layout.tsx and driven
// entirely by useCart(). Nothing here adds to the cart yet (that's Task 5) —
// this only renders what's already in it.
//
// It is a real dialog, not a styled <div>: role="dialog", focus moves in on
// open and back to the opener on close, Escape closes it, Tab is trapped
// inside it, and the rest of the page is made `inert` while it's open. It
// renders nothing at all when closed — no hidden-but-focusable subtree — so
// there is deliberately no CSS `display: none` doing that job; the early
// `return null` below is what closed actually means.

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useCart } from "@/components/CartProvider"
import PluginGlyph from "@/components/plugin-page/PluginGlyph"
import PromoCodeField from "@/components/PromoCodeField"
import { formatCents } from "@/lib/cart-promo"
import { cartSuggestions } from "@/lib/cart-suggestions"
import { countWord, PLUGIN_ORDER, PLUGINS, type PluginId } from "@/lib/plugins"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"
import styles from "./cart-drawer.module.css"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

/** "shft" / "shft and drft" / "shft, drft and fltr" — never an Oxford comma,
 *  never a bare join, so the dropped notice reads as English at any count
 *  from one to the whole range. */
function namesList(ids: readonly PluginId[]): string {
  const names = ids.map((id) => PLUGINS[id].name)
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

function CloseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function CartDrawer() {
  const { isOpen, close, totals, quote, remove, dropped, clearDropped, ids, removed, add, addAll } = useCart()
  const ownership = usePluginOwnership()

  // No client-mounted gate needed here (unlike GoProModal/FeatureGateModal,
  // which take `open` as a prop): useCartState() always seeds isOpen as
  // `false`, so `!isOpen` below already returns null on every pre-hydration
  // render, server and client alike, before createPortal's target ever matters.

  // A dedicated portal node, appended straight to <body>, rather than portaling
  // into whatever DOM position this component happens to render at. Two
  // things depend on that: z-index 80 needs to beat the rail (40) and the nav
  // dropdown panel (60) without fighting any stacking context an ancestor
  // might introduce, and the inert-the-rest-of-the-page effect below needs a
  // single node it can unambiguously exclude from "everything else in <body>".
  // useState's lazy initializer (not a ref) computes this once — reading a
  // ref's `.current` during render, which an early version of this did to get
  // the same one-time-creation, trips react-hooks/refs: refs are for values
  // read in effects/handlers, not render.
  const [portalNode] = useState<HTMLDivElement | null>(() =>
    typeof document !== "undefined" ? document.createElement("div") : null
  )
  useEffect(() => {
    if (!portalNode) return
    document.body.appendChild(portalNode)
    return () => {
      document.body.removeChild(portalNode)
    }
  }, [portalNode])

  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<Element | null>(null)

  // The rest of the page is inert while the drawer is open — not just
  // visually behind it, but genuinely unreachable by Tab, click or a screen
  // reader's virtual cursor. Scoped to <body>'s direct children other than
  // our own portal node, so the scrim + panel themselves are never inerted.
  //
  // Declared (and so cleaned up) before the focus-restore effect below: React
  // runs effect cleanups in declaration order, and restoring focus to the
  // opener has to happen after inert is lifted from it, not before — a
  // browser refuses to focus an element that is still inert, which would
  // silently strand focus on <body> instead of the opener.
  useEffect(() => {
    if (!isOpen) return
    const rest = Array.from(document.body.children).filter((el) => el !== portalNode)
    rest.forEach((el) => el.setAttribute("inert", ""))
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      rest.forEach((el) => el.removeAttribute("inert"))
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, portalNode])

  // Open: remember whatever had focus (the opener) and move focus to the
  // close button. Close (including unmount): give focus back to the opener.
  useEffect(() => {
    if (!isOpen) return
    openerRef.current = document.activeElement
    closeButtonRef.current?.focus()
    return () => {
      const opener = openerRef.current
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [isOpen])

  // Escape closes it; Tab (and Shift+Tab) wraps within the panel rather than
  // escaping to browser chrome. `inert` above already keeps the rest of the
  // page out of the tab order, but without this, Tab from the last control
  // would simply run out of focusable elements rather than cycling back to
  // the first, which is the trap the brief calls for.
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== "Tab") return
      const focusables = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [isOpen, close])

  // Closed means closed: no DOM at all, not a hidden-but-focusable subtree.
  if (!isOpen || !portalNode) return null

  const hasLines = totals.lines.length > 0
  const offer = cartSuggestions({
    ids, removed, owned: ownership.owned, known: !ownership.loading && !ownership.error,
  })
  const hasOffer = offer.items.length > 0

  return createPortal(
    <div className={styles.root}>
      <div className={styles.scrim} onClick={close} aria-hidden="true" />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Your cart" className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>Your cart</h2>
          <button ref={closeButtonRef} type="button" className={styles.closeButton} onClick={close} aria-label="Close cart">
            <CloseGlyph />
          </button>
        </div>

        {dropped.length > 0 && (
          <div className={styles.droppedNotice} role="status">
            <p className={styles.droppedText}>
              {namesList(dropped)} {dropped.length === 1 ? "was" : "were"} removed — you already own{" "}
              {dropped.length === 1 ? "it" : "them"}.
            </p>
            <button type="button" className={styles.droppedDismiss} onClick={clearDropped}>
              Dismiss
            </button>
          </div>
        )}

        <div className={styles.body}>
          {hasLines ? (
            <ul className={styles.lines}>
              {totals.lines.map((line) => {
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
                      <span className={styles.msrp}>${line.msrp}</span>
                    </span>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => remove(line.id)}
                      aria-label={`Remove ${plugin.name} from your cart`}
                    >
                      <CloseGlyph />
                    </button>
                  </li>
                )
              })}
              {totals.bundleApplied && (
                <li className={`${styles.line} ${styles.bundleLine}`}>
                  <span className={styles.bundleLabel}>Bundle — all three</span>
                  <span className={styles.bundleSaving}>−${totals.saving}</span>
                </li>
              )}
            </ul>
          ) : (
            <div className={`${styles.empty} ${hasOffer ? styles.emptyWithOffer : ""}`}>
              <p className={styles.emptyText}>Your cart is where plugins wait until you check out.</p>
              <Link href="/shft" className={styles.emptyLink} onClick={close}>
                Browse plugins →
              </Link>
            </div>
          )}

          {/* What was taken out, offered back - and the bundle, where it
              would save money. Adding from here keeps the drawer open: the
              visitor is still deciding. */}
          {hasOffer && (
            <section className={styles.offer} aria-labelledby="cart-offer-title" data-cart-offer>
              <h3 id="cart-offer-title" className={styles.offerTitle}>
                {offer.items.every((s) => removed.includes(s.id)) ? "Add back to your order" : hasLines ? "Add to your order" : "Start with one of these"}
              </h3>

              {offer.bundle && (
                <div className={styles.offerBundle} data-cart-offer-bundle>
                  <span className={styles.offerBundleText}>
                    <span className={styles.offerBundleName}>
                      All {countWord(PLUGIN_ORDER.length).toLowerCase()} for ${offer.bundle.price}
                    </span>
                    <span className={styles.offerBundleNote}>
                      {hasLines
                        ? `$${offer.bundle.extra} more than your cart · save $${offer.bundle.saving}`
                        : `save $${offer.bundle.saving} on buying them one by one`}
                    </span>
                  </span>
                  <button type="button" className={styles.offerBundleAdd} onClick={addAll}>
                    Add all {countWord(PLUGIN_ORDER.length).toLowerCase()}
                  </button>
                </div>
              )}

              <ul className={styles.lines}>
                {offer.items.map((s) => {
                  const plugin = PLUGINS[s.id]
                  return (
                    <li
                      key={s.id}
                      className={`${styles.line} ${styles.offerLine}`}
                      style={{ ["--row-accent" as string]: plugin.accent }}
                      data-cart-offer-item={s.id}
                    >
                      <PluginGlyph id={s.id} className={styles.lineGlyph} />
                      <span className={styles.lineText}>
                        <span className={styles.lineName}>{plugin.name}</span>
                        <span className={styles.lineCategory}>
                          {s.completesBundle ? "completes the bundle" : plugin.category}
                        </span>
                      </span>
                      <span className={styles.linePrice}>
                        {s.completesBundle ? (
                          <>
                            <span className={styles.price}>+${s.extra}</span>
                            <span className={styles.msrp}>${s.price}</span>
                          </>
                        ) : (
                          <span className={styles.price}>${s.price}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className={styles.offerAdd}
                        onClick={() => add(s.id)}
                        aria-label={`Add ${plugin.name} to your cart`}
                      >
                        Add
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>

        {hasLines && (
          <div className={styles.footer}>
            {/* Above the total, which it changes, and above the Checkout
                link, which stays the last control in the dialog. */}
            <PromoCodeField idPrefix="cart" className={styles.promo} />
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue} data-cart-total>{formatCents(quote.totalCents)}</span>
            </div>
            <Link href="/checkout" className={styles.checkout} onClick={close}>
              Checkout →
            </Link>
          </div>
        )}
      </div>
    </div>,
    portalNode
  )
}
