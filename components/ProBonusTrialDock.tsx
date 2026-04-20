"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import styles from "@/components/pro-bonus-trial-dock.module.css"
import { writeBonus14OfferSeen } from "@/lib/pro-bonus-trial-seen"

/** Time toward first modal (Dig / My Crate only) */
const STORAGE_PRE_MS = "sampleroll_bonus14_pre_ms_v1"
const STORAGE_MODAL_DISMISSED = "sampleroll_bonus14_modal_dismissed_v1"
/** Legacy: migrate once into STORAGE_PRE_MS */
const STORAGE_LEGACY_VISIBLE_MS = "sampleroll_bonus14_visible_ms_v1"
/** Legacy: old flow docked tab preference */
const STORAGE_LEGACY_DOCKED = "sampleroll_bonus14_docked_v1"
/** Set in pagehide when modal was open — refresh counts as dismiss for next load */
const SESSION_PAGEHID_MODAL = "sampleroll_bonus14_pagehid_modal_v1"

const THRESHOLD_MS = 1 * 60 * 1000
const TICK_MS = 8000

const Z_MODAL = 10057
const Z_TAB = 10056

function isBonusTrialRoute(path: string | null): boolean {
  if (!path) return false
  return path === "/dig" || path === "/profile"
}

function readPreMs(): number {
  if (typeof window === "undefined") return 0
  try {
    let raw = localStorage.getItem(STORAGE_PRE_MS)
    if (!raw || raw === "0") {
      const legacy = localStorage.getItem(STORAGE_LEGACY_VISIBLE_MS)
      if (legacy && legacy !== "0") {
        localStorage.setItem(STORAGE_PRE_MS, legacy)
        raw = legacy
      }
    }
    const n = parseInt(raw || "0", 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

function writePreMs(n: number) {
  try {
    localStorage.setItem(STORAGE_PRE_MS, String(Math.floor(n)))
  } catch {
    /* ignore */
  }
}

function readModalDismissed(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(STORAGE_MODAL_DISMISSED) === "1"
  } catch {
    return false
  }
}

function writeModalDismissed(dismissed: boolean) {
  try {
    if (dismissed) localStorage.setItem(STORAGE_MODAL_DISMISSED, "1")
    else localStorage.removeItem(STORAGE_MODAL_DISMISSED)
  } catch {
    /* ignore */
  }
}

type UiPhase = "idle" | "modal" | "docked"

/**
 * Dig + My Crate only: ~1 min visible → first modal; closing the modal → left tab immediately.
 */
export default function ProBonusTrialDock() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [phase, setPhase] = useState<UiPhase>("idle")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const lastTickRef = useRef<number>(0)
  const preModalTriggeredRef = useRef(false)
  const tabTriggeredRef = useRef(false)

  useEffect(() => setMounted(true), [])

  const isPro = session?.user?.isPro === true
  const onBonusRoute = isBonusTrialRoute(pathname)

  const dismissModal = useCallback(() => {
    writeModalDismissed(true)
    tabTriggeredRef.current = true
    setPhase("docked")
  }, [])

  /** Refresh / back while the modal is open: next load should not replay the blocking modal */
  useEffect(() => {
    const onPageHide = () => {
      if (phase !== "modal") return
      try {
        sessionStorage.setItem(SESSION_PAGEHID_MODAL, "1")
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [phase])

  const armEngagementTimer = useCallback(() => {
    if (isPro || status === "loading") return
    if (!onBonusRoute) return

    const tick = () => {
      if (typeof document === "undefined") return
      if (document.visibilityState !== "visible") {
        lastTickRef.current = Date.now()
        return
      }
      if (!isBonusTrialRoute(pathname)) {
        lastTickRef.current = Date.now()
        return
      }
      const now = Date.now()
      if (lastTickRef.current === 0) {
        lastTickRef.current = now
        return
      }
      const delta = Math.max(0, now - lastTickRef.current)
      lastTickRef.current = now

      const dismissed = readModalDismissed()

      if (!dismissed) {
        const pre = readPreMs() + delta
        writePreMs(pre)
        if (pre >= THRESHOLD_MS && !preModalTriggeredRef.current) {
          preModalTriggeredRef.current = true
          setPhase("modal")
        }
      }
    }

    lastTickRef.current = Date.now()
    const id = window.setInterval(tick, TICK_MS)
    const onVis = () => {
      lastTickRef.current = Date.now()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [isPro, onBonusRoute, pathname, status])

  useEffect(() => {
    if (!mounted || isPro || status === "loading") return
    if (!onBonusRoute) return

    try {
      if (sessionStorage.getItem(SESSION_PAGEHID_MODAL) === "1") {
        writeModalDismissed(true)
        sessionStorage.removeItem(SESSION_PAGEHID_MODAL)
      }
      if (localStorage.getItem(STORAGE_LEGACY_DOCKED) === "1") {
        writeModalDismissed(true)
        localStorage.removeItem(STORAGE_LEGACY_DOCKED)
      }
    } catch {
      /* ignore */
    }

    const dismissed = readModalDismissed()
    const pre = readPreMs()

    if (dismissed) {
      tabTriggeredRef.current = true
      setPhase("docked")
    } else if (pre >= THRESHOLD_MS) {
      preModalTriggeredRef.current = true
      setPhase("modal")
    }
  }, [mounted, isPro, status, pathname, onBonusRoute])

  useEffect(() => {
    if (isPro || status === "loading") return
    return armEngagementTimer()
  }, [armEngagementTimer, isPro, status])

  useEffect(() => {
    if (!isPro) return
    setPhase("idle")
    writeModalDismissed(false)
  }, [isPro])

  useEffect(() => {
    if (phase !== "modal") return
    writeBonus14OfferSeen()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissModal()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [phase, dismissModal])

  const startCheckout = async () => {
    setError("")
    if (session?.user?.isPro) return
    if (status !== "authenticated" || !session?.user?.id) {
      const base = pathname || "/dig"
      const join = base.includes("?") ? "&" : "?"
      const next = `${base}${join}tryPro14=1`
      writeModalDismissed(true)
      tabTriggeredRef.current = true
      setPhase("idle")
      requestAnimationFrame(() => {
        router.push(`/login?callbackUrl=${encodeURIComponent(next)}`)
      })
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trialDays: 14 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not start checkout")
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setError("No checkout URL returned")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || isPro || !onBonusRoute) return null
  if (phase === "idle") return null

  const tab = (
    <div className="fixed left-0 top-[36%] md:top-[40%]" style={{ zIndex: Z_TAB }}>
      <div className={styles.sideTabGradient}>
        <button
          type="button"
          className={styles.sideTabInner}
          onClick={() => {
            setPhase("modal")
          }}
          aria-label="Open 14-day Pro trial offer"
        >
          <span className={styles.sideTabStack}>
            <svg className={styles.sideTabChevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            </svg>
            <span className={styles.sideTabLabel}>14-day Pro</span>
          </span>
        </button>
      </div>
    </div>
  )

  if (phase === "docked") {
    return createPortal(tab, document.body)
  }

  const overlay = (
    <div
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      style={{ zIndex: Z_MODAL, background: "rgba(0,0,0,0.72)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismissModal()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bonus-14-pro-title"
    >
      <div className={`${styles.gradientFrame} w-full max-w-[440px] my-auto`} onClick={(e) => e.stopPropagation()}>
        <div className={`${styles.innerPanel} ${styles.panelRel}`}>
          <button type="button" className={styles.closeBtn} onClick={dismissModal} aria-label="Close offer">
            <svg className="w-4 h-4" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className={styles.strikeWrap}>
            <span className={styles.strikeOld} aria-hidden>
              7 days free
            </span>
          </div>

          <h2 id="bonus-14-pro-title" className={styles.headline}>
            Get 14 days of Pro on the house
          </h2>
          <p className={styles.subcopy}>Activate Pro 14 Day Trial. Then $5.99/month</p>

          {error ? (
            <p className="text-sm w-full text-center mb-2" style={{ color: "#f87171", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
              {error}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={loading || status === "loading"}
              className="pro-gradient-btn pro-gradient-btn--block pro-gradient-btn--rounded w-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm py-2.5"
            >
              {loading ? "Redirecting…" : "CLAIM 14-DAY TRIAL"}
            </button>
            <button type="button" className={styles.laterBtn} onClick={dismissModal}>
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
