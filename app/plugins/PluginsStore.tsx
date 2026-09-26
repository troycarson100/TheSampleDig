"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import PluginGlyph from "@/components/plugin-page/PluginGlyph"
import BuyButton from "@/components/plugin-page/BuyButton"
import styles from "./plugins.module.css"
import { trackMeta } from "@/lib/meta-pixel"
import { pluginList, PLUGINS, type PluginId } from "@/lib/plugins"
import { PRICING } from "@/lib/products"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"

/** Only the canceled state lives here. Success goes to /thanks. */
function CanceledNotice() {
  const [canceled, setCanceled] = useState(false)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("purchase") === "canceled") setCanceled(true)
  }, [])
  if (!canceled) return null
  return <div className={styles.notice}>Checkout canceled — no charge was made. The bundle is here whenever you want it.</div>
}

function BundleButton() {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const buy = async () => {
    setBusy(true); setFailed(false)
    trackMeta("InitiateCheckout", {
      value: PRICING.bundle.price, currency: "USD", content_name: "bundle", content_type: "product",
    })
    try {
      const res = await fetch("/api/bundle/checkout", { method: "POST" })
      if (res.status === 409) { window.location.reload(); return }
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data?.url === "string") { window.location.href = data.url; return }
    } catch { /* fall through */ }
    setFailed(true); setBusy(false)
  }
  return (
    <button type="button" className={styles.bundleBuy} onClick={buy} disabled={busy}>
      {busy ? "…" : failed ? "Opens at launch" : `Get all three · $${PRICING.bundle.price}`}
    </button>
  )
}

function Bundle({ loading, ownedCount, missing }: {
  loading: boolean; ownedCount: number; missing: PluginId[]
}) {
  if (loading) return <section className={styles.bundle} id="bundle" aria-busy="true" />

  if (ownedCount === 3) {
    return (
      <section className={styles.bundle} id="bundle">
        <p className={styles.bundleTag}>The whole rack</p>
        <h2 className={styles.bundleTitle}>Every plugin is yours</h2>
        <p className={styles.bundleSub}>
          Downloads and licence keys live in My Products — take them as many times as you need.
        </p>
        <Link href="/products" className={styles.bundleBuy}>Go to My Products</Link>
      </section>
    )
  }

  if (ownedCount > 0) {
    const total = missing.reduce((sum, id) => sum + PRICING[id].price, 0)
    return (
      <section className={styles.bundle} id="bundle">
        <p className={styles.bundleTag}>Finish the rack</p>
        <h2 className={styles.bundleTitle}>
          {missing.length === 1 ? "One plugin left" : "Two plugins left"}
        </h2>
        <p className={styles.bundleSub}>
          {missing.map((id) => PLUGINS[id].name).join(" and ")} — ${total} for what you are missing.
        </p>
        {/* No bundle button: a partial owner has no bundle price that is correct
            for them, and buying one would charge again for what they own. */}
      </section>
    )
  }

  const save = PRICING.bundle.compareAt - PRICING.bundle.price
  return (
    <section className={styles.bundle} id="bundle">
      <p className={styles.bundleTag}>All three plugins</p>
      <h2 className={styles.bundleTitle}>
        {pluginList().map((p) => p.name).join(" + ")}
      </h2>
      <p className={styles.bundleSub}>
        One chops your sound into rhythm, one drags it through a dying tape machine, and one
        tunes it to your track. Take all three for less than two at list price.
      </p>
      <p className={styles.priceRow}>
        <span className={styles.bigPrice}>${PRICING.bundle.price}</span>
        <s className={styles.wasPrice}>${PRICING.bundle.compareAt}</s>
        <span className={styles.saveBadge}>Save ${save}</span>
      </p>
      <BundleButton />
    </section>
  )
}

export default function PluginsStore() {
  const { loading, ownedCount, missing } = usePluginOwnership()

  return (
    <main className={styles.store}>
      <CanceledNotice />
      <div className={styles.head}>
        <h1 className={styles.title}>Plugins</h1>
        <p className={styles.sub}>
          Instruments of damage, rhythm and key. One-time purchase, free updates, macOS and Windows.
        </p>
      </div>

      <Bundle loading={loading} ownedCount={ownedCount} missing={missing} />

      <div className={styles.cards}>
        {pluginList().map((p) => (
          <article key={p.id} className={styles.card} data-plugin-card={p.id}
            style={{
              ["--card-ground" as string]: p.ground,
              ["--card-ink" as string]: p.ink,
              ["--card-accent" as string]: p.accent,
              ["--card-accent-2" as string]: p.accent2,
            }}>
            <Link href={p.href} className={styles.cardMedia} aria-label={`Learn more about ${p.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.cardImg} src={p.art.card} alt={`${p.name} plugin interface`} />
            </Link>
            <div className={styles.cardBody}>
              <p className={styles.cardEyebrow}>
                <PluginGlyph id={p.id} /> {p.category}
              </p>
              <h2 className={styles.cardName}>{p.name}</h2>
              <p className={styles.cardTagline}>{p.tagline}</p>
              <div className={styles.cardRow}>
                <BuyButton id={p.id} />
                <Link href={p.href} className={styles.cardMore}>Learn more →</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
