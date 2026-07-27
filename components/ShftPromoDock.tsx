"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import styles from "@/components/shft-promo-dock.module.css"
import { useOwnsShft } from "@/lib/use-owns-shft"

/** localStorage: user closed the card → next load shows the collapsed tab, not the card. */
const STORAGE_DISMISSED = "sampleroll_shft_promo_dismissed_v1"
/** Delay before the card slides in after landing on /dig. */
const APPEAR_DELAY_MS = 5000

const Z = 10050

function readDismissed(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(STORAGE_DISMISSED) === "1"
  } catch {
    return false
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(STORAGE_DISMISSED, "1")
  } catch {
    /* ignore */
  }
}

type Phase = "idle" | "card" | "docked"

/**
 * shft $19 launch promo on /dig: a non-blocking card slides in ~5s after landing.
 * Closing it collapses to a right-edge tab that reopens the card. Hidden from
 * shft owners. "Get shft" routes to /shft (which handles login/checkout/owner state).
 *
 * `loading` from useOwnsShft gates all rendering, so nothing renders during SSR /
 * first paint (no createPortal on the server, no hydration mismatch).
 */
export default function ShftPromoDock() {
  const pathname = usePathname()
  const router = useRouter()
  const { owned, loading } = useOwnsShft()
  // Previously-closed users start collapsed to the tab; everyone else starts idle
  // and the timer below promotes them to the card. (readDismissed() is SSR-safe.)
  const [phase, setPhase] = useState<Phase>(() => (readDismissed() ? "docked" : "idle"))

  const onDigRoute = pathname === "/dig"
  const active = onDigRoute && !loading && !owned

  // Once active and still idle, slide the card in after a short delay. The only
  // setState here is inside the timeout (async), never a synchronous cascade.
  useEffect(() => {
    if (!active || phase !== "idle") return
    const id = window.setTimeout(() => setPhase("card"), APPEAR_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [active, phase])

  const dismiss = useCallback(() => {
    writeDismissed()
    setPhase("docked")
  }, [])

  useEffect(() => {
    if (phase !== "card") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [phase, dismiss])

  if (!active || phase === "idle") return null

  if (phase === "docked") {
    const tab = (
      // Left edge, below the Try Pro tab (~38%), so the two don't collide.
      <div className="fixed left-0 top-[62%] w-max" style={{ zIndex: Z }}>
        <div className={styles.sideTabGradient}>
          <button type="button" className={styles.sideTabInner} onClick={() => setPhase("card")} aria-label="Open shft launch offer">
            <span className={styles.sideTabStack}>
              <svg className={styles.sideTabChevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
              </svg>
              <span className={styles.sideTabLabel}>shft $19</span>
            </span>
          </button>
        </div>
      </div>
    )
    return createPortal(tab, document.body)
  }

  const card = (
    <div
      // Lower-left, clear of the Try Pro tab above and the fixed bottom bar below.
      className={`fixed left-3 top-[58%] w-[min(320px,calc(100vw-1.5rem))] ${styles.card}`}
      style={{ zIndex: Z }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="shft-promo-title"
    >
      <div className={styles.frame}>
        <div className={styles.inner}>
          <button type="button" className={styles.closeBtn} onClick={dismiss} aria-label="Close offer">
            <svg className="w-4 h-4" stroke="currentColor" fill="none" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <span className={styles.badge}>Launch Sale</span>

          <h2 id="shft-promo-title" className={styles.headline}>
            <span className={styles.brand}>shft</span> is here
          </h2>
          <p className={styles.subcopy}>
            Our tempo-synced trance-gate plugin just dropped. Grab it now for{" "}
            <span className={styles.price}>$19</span>
            <s className={styles.priceOld}>$39</s>.
          </p>

          <button type="button" className={styles.getBtn} onClick={() => router.push("/shft")}>
            Get shft <span aria-hidden>→</span>
          </button>
          <button type="button" className={styles.laterBtn} onClick={dismiss}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(card, document.body)
}
