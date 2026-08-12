"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

export interface AffiliateStatus {
  isAffiliate: boolean
  isAdmin: boolean
}

// Whether the SIGNED-IN user is an invited affiliate and/or the program admin.
// Cached per user id in module memory (one fetch per user per hard page load),
// so switching accounts in the same tab never shows another account's answer.
const cache = new Map<string, AffiliateStatus>()

export function useAffiliateStatus(): AffiliateStatus {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? null
  const [, bump] = useState(0)

  useEffect(() => {
    if (!userId || cache.has(userId)) return
    let cancelled = false
    fetch("/api/affiliate/me")
      .then((r) => r.json())
      .then((d) => {
        cache.set(userId, { isAffiliate: Boolean(d.isAffiliate), isAdmin: Boolean(d.isAdmin) })
        if (!cancelled) bump((n) => n + 1)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!userId) return { isAffiliate: false, isAdmin: false }
  return cache.get(userId) ?? { isAffiliate: false, isAdmin: false }
}

export function useIsAffiliate(): boolean {
  return useAffiliateStatus().isAffiliate
}
