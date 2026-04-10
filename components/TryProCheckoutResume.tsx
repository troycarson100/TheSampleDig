"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useGoProModal } from "@/components/GoProModalContext"

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
    if (params.get("tryPro") !== "1") return

    if (status === "unauthenticated") {
      const target = window.location.pathname + window.location.search
      router.replace(`/login?callbackUrl=${encodeURIComponent(target)}`)
      return
    }

    if (session?.user?.isPro === true) {
      params.delete("tryPro")
      const next = pathname + (params.toString() ? `?${params.toString()}` : "")
      window.history.replaceState(null, "", next)
      router.replace(next, { scroll: false })
      return
    }

    // Strip flag immediately so React Strict Mode / re-renders don’t start checkout twice
    params.delete("tryPro")
    const clean = pathname + (params.toString() ? `?${params.toString()}` : "")
    window.history.replaceState(null, "", clean)
    router.replace(clean, { scroll: false })

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/stripe/checkout", { method: "POST" })
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
