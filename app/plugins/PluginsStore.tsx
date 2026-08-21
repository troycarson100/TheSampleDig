"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import styles from "./plugins.module.css"
import { trackMeta } from "@/lib/meta-pixel"
import { PRICING } from "@/lib/products"

type PluginId = "shft" | "drft"

const PLUGINS: { id: PluginId; name: string; tagline: string; img: string; theme: string; href: string }[] = [
  {
    id: "shft",
    name: "shft",
    tagline: "Tempo-synced trance-gate multi-FX. Sixteen steps chop your audio into living rhythm.",
    img: "/shft/card.jpg",
    theme: "cardShft",
    href: "/shft",
  },
  {
    id: "drft",
    name: "drft",
    tagline: "VHS / CRT circuit-bend FX. Your sound through a dying tape machine, picture and all.",
    img: "/drft/field.jpg",
    theme: "cardDrft",
    href: "/drft",
  },
]

async function startCheckout(endpoint: string): Promise<{ url: string | null; needsAuth: boolean; conflict: boolean }> {
  try {
    const res = await fetch(endpoint, { method: "POST" })
    if (res.status === 401) return { url: null, needsAuth: true, conflict: false }
    if (res.status === 409) return { url: null, needsAuth: false, conflict: true }
    const data = await res.json().catch(() => ({}))
    if (res.ok && typeof data?.url === "string") return { url: data.url, needsAuth: false, conflict: false }
  } catch {
    /* fall through */
  }
  return { url: null, needsAuth: false, conflict: false }
}

/** Buy button used for singles and the bundle. On 409 (ownership changed under
    us) it reloads so the page re-renders the right state. */
function BuyBtn({ endpoint, className, children }: { endpoint: string; className: string; children: ReactNode }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const buy = async () => {
    setBusy(true)
    setFailed(false)
    const { url, needsAuth, conflict } = await startCheckout(endpoint)
    if (needsAuth) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent("/plugins")}`
      return
    }
    if (conflict) {
      window.location.reload()
      return
    }
    if (url) {
      window.location.href = url
      return
    }
    setFailed(true)
    setBusy(false)
  }

  return (
    <button type="button" className={className} onClick={buy} disabled={busy}>
      {busy ? "…" : failed ? "Opens at launch" : children}
    </button>
  )
}

function PurchaseBanner() {
  const [canceled, setCanceled] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get("purchase")
    if (p === "canceled") {
      setCanceled(true)
      return
    }
    if (p !== "success") return

    const paid = Number(params.get("paid")) || PRICING.bundle.price
    trackMeta("Purchase", { value: paid, currency: "USD", content_name: "bundle", content_type: "product" })

    const sessionId = params.get("session_id")
    if (!sessionId) {
      window.location.replace("/products")
      return
    }
    fetch("/api/bundle/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).finally(() => {
      window.location.replace("/products")
    })
  }, [])

  if (!canceled) return null
  return <div className={styles.bannerInfo}>Checkout canceled — no charge was made. The bundle is here whenever you&apos;re ready.</div>
}

export default function PluginsStore() {
  const [owned, setOwned] = useState<Record<PluginId, boolean>>({ shft: false, drft: false })
  // Whether each product's crossgrade price actually exists in Stripe - the UI
  // must never advertise a $15 price the checkout route cannot actually charge.
  const [crossgradeAvailable, setCrossgradeAvailable] = useState<Record<PluginId, boolean>>({ shft: false, drft: false })

  useEffect(() => {
    for (const id of ["shft", "drft"] as const) {
      fetch(`/api/${id}/ownership`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.owned) setOwned((o) => ({ ...o, [id]: true }))
          setCrossgradeAvailable((c) => ({ ...c, [id]: Boolean(d?.crossgrade) }))
        })
        .catch(() => {})
    }
  }, [])

  const ownCount = Number(owned.shft) + Number(owned.drft)
  const missing: PluginId = owned.shft ? "drft" : "shft"
  const missingCrossgradeOn = ownCount === 1 && crossgradeAvailable[missing]

  return (
    <main className={styles.store}>
      <PurchaseBanner />
      <div className={styles.head}>
        <h1 className={styles.title}>Plugins</h1>
        <p className={styles.sub}>Instruments of damage and rhythm. One-time purchase, free updates, macOS &amp; Windows.</p>
      </div>

      {/* ---- The offer leads the page: both plugins, one price. State depends
              on how much of the pair you already own. ------------------------ */}
      <section className={styles.bundle}>
        <div className={styles.bundleSheen} aria-hidden />
        <div className={styles.bundleInner}>
          <div className={styles.bundleCopy}>
            {ownCount === 0 && (
              <>
                <p className={styles.bundleTag}>
                  <span className={styles.liveDot} aria-hidden />
                  LIMITED TIME
                </p>
                <h2 className={styles.bundleTitle}>
                  Get <span className={styles.markShft}>shft</span> <span className={styles.plus}>+</span>{" "}
                  <span className={styles.markDrft}>drft</span>
                </h2>
                <p className={styles.bundleSub}>
                  One chops your sound into rhythm. The other drags it through a dying tape machine.
                  Take both for less than one at full price.
                </p>
                <div className={styles.priceRow}>
                  <span className={styles.bigPrice}>${PRICING.bundle.price}</span>
                  <span className={styles.priceMeta}>
                    <s>${PRICING.bundle.compareAt}</s>
                    <span className={styles.saveBadge}>
                      Save ${PRICING.bundle.compareAt - PRICING.bundle.price}
                    </span>
                  </span>
                </div>
                <BuyBtn endpoint="/api/bundle/checkout" className={styles.bundleBuy}>
                  Get the bundle - ${PRICING.bundle.price}
                </BuyBtn>
              </>
            )}
            {ownCount === 1 && missingCrossgradeOn && (
              <>
                <p className={styles.bundleTag}>
                  <span className={styles.liveDot} aria-hidden />
                  COMPLETE THE PAIR
                </p>
                <h2 className={styles.bundleTitle}>
                  You own {owned.shft ? "shft" : "drft"} - take {missing} for ${PRICING.crossgrade.price}
                </h2>
                <p className={styles.bundleSub}>
                  The same deal as the bundle, kept open for you: ${PRICING.crossgrade.price} brings your pair
                  to ${PRICING.bundle.price} total.
                </p>
                <div className={styles.priceRow}>
                  <span className={styles.bigPrice}>${PRICING.crossgrade.price}</span>
                  <span className={styles.priceMeta}>
                    <s>${PRICING.crossgrade.compareAt}</s>
                    <span className={styles.saveBadge}>
                      Save ${PRICING.crossgrade.compareAt - PRICING.crossgrade.price}
                    </span>
                  </span>
                </div>
                <BuyBtn endpoint={`/api/${missing}/checkout`} className={styles.bundleBuy}>
                  Get {missing} - ${PRICING.crossgrade.price}
                </BuyBtn>
              </>
            )}
            {ownCount === 1 && !missingCrossgradeOn && (
              <>
                <p className={styles.bundleTag}>
                  <span className={styles.liveDot} aria-hidden />
                  COMPLETE THE PAIR
                </p>
                <h2 className={styles.bundleTitle}>
                  You own {owned.shft ? "shft" : "drft"} - complete the pair
                </h2>
                <p className={styles.bundleSub}>
                  {missing} is the other half of the rack, at its launch price.
                </p>
                <div className={styles.priceRow}>
                  <span className={styles.bigPrice}>${PRICING[missing].price}</span>
                  <span className={styles.priceMeta}>
                    <s>${PRICING[missing].msrp}</s>
                  </span>
                </div>
                <BuyBtn endpoint={`/api/${missing}/checkout`} className={styles.bundleBuy}>
                  Get {missing} - ${PRICING[missing].price}
                </BuyBtn>
              </>
            )}
            {ownCount === 2 && (
              <>
                <p className={styles.bundleTag}>
                  <span className={styles.liveDot} aria-hidden />
                  THE WHOLE RACK
                </p>
                <h2 className={styles.bundleTitle}>Both plugins are yours</h2>
                <p className={styles.bundleSub}>
                  Downloads and licence keys live in My Products - grab them any time, as many times as you need.
                </p>
                <a href="/products" className={styles.bundleBuy}>
                  Go to My Products
                </a>
              </>
            )}
          </div>

          {/* Both plugins, stacked like a boxed pair. */}
          <div className={styles.bundleArt} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.artBack} src="/shft/card.jpg" alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.artFront} src="/drft/field.jpg" alt="" />
          </div>
        </div>
      </section>

      <div className={styles.cards}>
        {PLUGINS.map((p) => (
          <article key={p.id} className={`${styles.card} ${styles[p.theme]}`}>
            <Link href={p.href} className={styles.cardMedia} aria-label={`Learn more about ${p.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.cardImg} src={p.img} alt={`${p.name} plugin UI`} />
            </Link>
            <div className={styles.cardBody}>
              <h2 className={styles.cardName}>{p.name}</h2>
              <p className={styles.cardTagline}>{p.tagline}</p>
              <div className={styles.cardRow}>
                {owned[p.id] ? (
                  <a className={styles.cardBuy} href="/products">
                    You own {p.name} — Download
                  </a>
                ) : (
                  <BuyBtn endpoint={`/api/${p.id}/checkout`} className={styles.cardBuy}>
                    Buy — <strong>${p.id === missing && missingCrossgradeOn ? PRICING.crossgrade.price : PRICING[p.id].price}</strong>{" "}
                    <s>${p.id === missing && missingCrossgradeOn ? PRICING.crossgrade.compareAt : PRICING[p.id].msrp}</s>
                  </BuyBtn>
                )}
                <Link href={p.href} className={styles.cardMore}>
                  Learn more →
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

    </main>
  )
}
