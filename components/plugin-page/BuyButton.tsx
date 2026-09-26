"use client"

import { useState } from "react"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import { PRICING } from "@/lib/products"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"
import { trackMeta } from "@/lib/meta-pixel"
import styles from "./plugin-page.module.css"

export default function BuyButton({ id, className = "" }: { id: PluginId; className?: string }) {
  const { loading, error, owned } = usePluginOwnership()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
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

  const buy = async () => {
    setBusy(true)
    setFailed(false)
    trackMeta("InitiateCheckout", {
      value: price.price, currency: "USD", content_name: id, content_type: "product",
    })
    try {
      const res = await fetch(`/api/${id}/checkout`, { method: "POST" })
      if (res.status === 409) { window.location.reload(); return }
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data?.url === "string") { window.location.href = data.url; return }
    } catch { /* fall through to the failed state */ }
    setFailed(true)
    setBusy(false)
  }

  return (
    <button type="button" className={`${styles.buy} ${className}`} onClick={buy} disabled={busy}>
      {busy ? "…" : failed ? "Opens at launch" : (
        <>Buy · <span className={styles.buyPrice}>${price.price}</span>{" "}
        <s className={styles.buyWas}>${price.msrp}</s></>
      )}
    </button>
  )
}
