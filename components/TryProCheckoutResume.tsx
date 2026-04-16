"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useGoProModal } from "@/components/GoProModalContext"
import { readBonus14OfferSeen } from "@/lib/pro-bonus-trial-seen"

/**
 * When URL has ?tryPro=1 (set when guest clicks Try Pro → login), after sign-in resume Stripe Checkout.
 */
export default function TryProCheckoutResume() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { openProModal } = useGoProModal()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (status === "loading") return

    const params = new URLSearchParams(window.location.search)
    const try14 = params.get("tryPro14") === "1"
    if (params.get("tryPro") !== "1" && !try14) return

    if (status === "unauthenticated") {
      const target = window.location.pathname + window.location.search
      router.replace(`/login?callbackUrl=${encodeURIComponent(target)}`)
      return
    }

    if (session?.user?.isPro === true) {
      params.delete("tryPro")
      params.delete("tryPro14")
      const next = pathname + (params.toString() ? `?${params.toString()}` : "")
      window.history.replaceState(null, "", next)
      router.replace(next, { scroll: false })
      return
    }

    // Strip flags immediately so React Strict Mode / re-renders don’t start checkout twice
    params.delete("tryPro")
    params.delete("tryPro14")
    const clean = pathname + (params.toString() ? `?${params.toString()}` : "")
    window.history.replaceState(null, "", clean)
    router.replace(clean, { scroll: false })

    let cancelled = false
    ;(async () => {
      try {
        const extended = try14 || readBonus14OfferSeen()
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: extended ? { "Content-Type": "application/json" } : undefined,
          body: extended ? JSON.stringify({ trialDays: 14 }) : undefined,
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok && typeof data?.url === "string" && data.url) {
          window.location.href = data.url
          return
        }
        openProModal()
      } catch {
        if (!cancelled) openProModal()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pathname, router, status, session, openProModal])

  return null
}
