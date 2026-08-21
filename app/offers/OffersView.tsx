"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import styles from "./offers.module.css"
import { PRICING } from "@/lib/products"

type PluginId = "shft" | "drft"

const NAMES: Record<PluginId, string> = { shft: "shft", drft: "drft" }
const BLURB: Record<PluginId, string> = {
  shft: "Tempo-synced trance-gate multi-FX. Sixteen steps chop your audio into living rhythm.",
  drft: "VHS / CRT circuit-bend FX. Your sound through a dying tape machine, picture and all.",
}
const ART: Record<PluginId, string> = { shft: "/shft/card.jpg", drft: "/drft/field.jpg" }

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

function BuyBtn({ endpoint, children }: { endpoint: string; children: ReactNode }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const buy = async () => {
    setBusy(true)
    setFailed(false)
    const { url, needsAuth, conflict } = await startCheckout(endpoint)
    if (needsAuth) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent("/offers")}`
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
    <button type="button" className={styles.buy} onClick={buy} disabled={busy}>
      {busy ? "…" : failed ? "Opens at launch" : children}
    </button>
  )
}

/** The offer panel: dark chassis card with the limited-time flag, the price,
    and the plugin it unlocks. One shape, three sets of contents. */
function OfferCard({
  flag,
  title,
  sub,
  price,
  was,
  badge,
  art,
  children,
}: {
  flag: string
  title: ReactNode
  sub: ReactNode
  price?: number
  was?: number
  badge?: string
  art?: string
  children: ReactNode
}) {
  return (
    <section className={styles.offer}>
      <div className={styles.sheen} aria-hidden />
      <div className={styles.offerInner}>
        <div className={styles.copy}>
          <p className={styles.flag}>
            <span className={styles.liveDot} aria-hidden />
            {flag}
          </p>
          <h2 className={styles.offerTitle}>{title}</h2>
          <p className={styles.offerSub}>{sub}</p>
          {price !== undefined && (
            <div className={styles.priceRow}>
              <span className={styles.bigPrice}>${price}</span>
              <span className={styles.priceMeta}>
                {was !== undefined && <s>${was}</s>}
                {badge && <span className={styles.saveBadge}>{badge}</span>}
              </span>
            </div>
          )}
          {children}
        </div>
        {art && (
          <div className={styles.art} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.artImg} src={art} alt="" />
          </div>
        )}
      </div>
    </section>
  )
}

export default function OffersView() {
  const { status } = useSession()
  const [owned, setOwned] = useState<Record<PluginId, boolean>>({ shft: false, drft: false })
  const [crossgradeAvailable, setCrossgradeAvailable] = useState<Record<PluginId, boolean>>({
    shft: false,
    drft: false,
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let done = 0
    for (const id of ["shft", "drft"] as const) {
      fetch(`/api/${id}/ownership`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.owned) setOwned((o) => ({ ...o, [id]: true }))
          setCrossgradeAvailable((c) => ({ ...c, [id]: Boolean(d?.crossgrade) }))
        })
        .catch(() => {})
        .finally(() => {
          done += 1
          if (done === 2) setLoaded(true)
        })
    }
  }, [])

  const ownCount = Number(owned.shft) + Number(owned.drft)
  const missing: PluginId = owned.shft ? "drft" : "shft"
  const haveCrossgrade = ownCount === 1 && crossgradeAvailable[missing]

  return (
    <main className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>My Offers</h1>
        <p className={styles.sub}>Deals tied to what you already own. They come and go - grab them while they run.</p>
      </div>

      {status === "unauthenticated" && (
        <OfferCard
          flag="OFFERS INSIDE"
          title={
            <>
              Sign in to see your offers
            </>
          }
          sub="Own one of our plugins? There is a price waiting here for the other one. Sign in with the account you bought with."
          art="/drft/field.jpg"
        >
          <Link className={styles.buy} href={`/login?callbackUrl=${encodeURIComponent("/offers")}`}>
            Sign in
          </Link>
        </OfferCard>
      )}

      {status === "authenticated" && !loaded && <div className={styles.loading}>Checking your offers…</div>}

      {status === "authenticated" && loaded && haveCrossgrade && (
        <OfferCard
          flag="LIMITED TIME"
          title={
            <>
              You own {NAMES[owned.shft ? "shft" : "drft"]} - take{" "}
              <span className={styles.mark}>{NAMES[missing]}</span> for ${PRICING.crossgrade.price}
            </>
          }
          sub={`${BLURB[missing]} Yours at the owner price - the same deal as the bundle, brought to you because you already own the other half.`}
          price={PRICING.crossgrade.price}
          was={PRICING.crossgrade.compareAt}
          badge={`Save $${PRICING.crossgrade.compareAt - PRICING.crossgrade.price}`}
          art={ART[missing]}
        >
          <BuyBtn endpoint={`/api/${missing}/checkout`}>
            Get {NAMES[missing]} - ${PRICING.crossgrade.price}
          </BuyBtn>
          <p className={styles.foot}>
            One-time purchase, free updates - macOS &amp; Windows -{" "}
            <Link className={styles.footLink} href={`/${missing}`}>
              see what {NAMES[missing]} does
            </Link>
          </p>
        </OfferCard>
      )}

      {/* Owns one, but that crossgrade price is not configured: never advertise
          a price checkout cannot charge - show the plugin at its normal price. */}
      {status === "authenticated" && loaded && ownCount === 1 && !haveCrossgrade && (
        <OfferCard
          flag="LIMITED TIME"
          title={
            <>
              Complete the pair with <span className={styles.mark}>{NAMES[missing]}</span>
            </>
          }
          sub={`${BLURB[missing]} Still at its launch price.`}
          price={PRICING[missing].price}
          was={PRICING[missing].msrp}
          badge={`Save $${PRICING[missing].msrp - PRICING[missing].price}`}
          art={ART[missing]}
        >
          <BuyBtn endpoint={`/api/${missing}/checkout`}>
            Get {NAMES[missing]} - ${PRICING[missing].price}
          </BuyBtn>
          <p className={styles.foot}>
            One-time purchase, free updates - macOS &amp; Windows -{" "}
            <Link className={styles.footLink} href={`/${missing}`}>
              see what {NAMES[missing]} does
            </Link>
          </p>
        </OfferCard>
      )}

      {status === "authenticated" && loaded && ownCount === 0 && (
        <OfferCard
          flag="LIMITED TIME"
          title={
            <>
              Get <span className={styles.mark}>shft</span> + <span className={styles.mark}>drft</span>
            </>
          }
          sub="One chops your sound into rhythm. The other drags it through a dying tape machine. Take both for less than one at full price."
          price={PRICING.bundle.price}
          was={PRICING.bundle.compareAt}
          badge={`Save $${PRICING.bundle.msrp - PRICING.bundle.price} off $${PRICING.bundle.msrp} MSRP`}
          art="/drft/field.jpg"
        >
          <BuyBtn endpoint="/api/bundle/checkout">Get the bundle - ${PRICING.bundle.price}</BuyBtn>
          <p className={styles.foot}>
            Or buy them one at a time on the{" "}
            <Link className={styles.footLink} href="/plugins">
              plugins page
            </Link>
          </p>
        </OfferCard>
      )}

      {status === "authenticated" && loaded && ownCount === 2 && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>No offers right now</h2>
          <p className={styles.emptySub}>
            You own the whole rack - there is nothing left for us to discount. New offers land here when we ship
            something new.
          </p>
          <Link className={styles.buy} href="/products">
            Go to My Products
          </Link>
        </div>
      )}
    </main>
  )
}
