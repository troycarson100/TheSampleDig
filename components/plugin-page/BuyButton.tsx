"use client"

import { useState } from "react"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import { PRICING } from "@/lib/products"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"
import { useCart } from "@/components/CartProvider"
import styles from "./plugin-page.module.css"

export default function BuyButton({ id, className = "" }: { id: PluginId; className?: string }) {
  const { loading, error, owned } = usePluginOwnership()
  const { add, open } = useCart()
  const [busy, setBusy] = useState(false)
  const price = PRICING[id]

  // Never render a purchase control before ownership resolves, or when it
  // failed to resolve at all — offering an owned plugin for sale, even for
  // one frame, is the bug this guards. A failed request is unknown ownership,
  // not "owns nothing", so it gets the same inert placeholder as loading.
  if (loading || error) return <span className={`${styles.buy} ${styles.buyIdle} ${className}`} aria-hidden />

  if (owned[id]) {
    return (
      <a className={`${styles.buy} ${className}`} href="/products">
        You own {PLUGINS[id].name} — download
      </a>
    )
  }

  // Adding to the cart is synchronous local state, not a round trip — this
  // can no longer fail the way a checkout POST could. `busy` still gates
  // `disabled` (see the note above the button) so the mechanism that guards
  // against interacting with the control mid-click stays in place, but there
  // is no longer a distinct failure state to render.
  const addToCart = () => {
    setBusy(true)
    add(id)
    open()
    setBusy(false)
  }

  return (
    <button type="button" className={`${styles.buy} ${className}`} onClick={addToCart} disabled={busy}>
      Add · <span className={styles.buyPrice}>${price.price}</span>{" "}
      <s className={styles.buyWas}>${price.msrp}</s>
    </button>
  )
}
