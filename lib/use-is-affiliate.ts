"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

// Whether the SIGNED-IN user is an invited affiliate. Cached per user id in
// module memory (one fetch per user per hard page load), so switching accounts
// in the same tab never shows another account's answer — the bug the old
// global sessionStorage key had.
const cache = new Map<string, boolean>()

export function useIsAffiliate(): boolean {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? null
  const [, bump] = useState(0)

  useEffect(() => {
    if (!userId || cache.has(userId)) return
    let cancelled = false
    fetch("/api/affiliate/me")
      .then((r) => r.json())
      .then((d) => {
        cache.set(userId, Boolean(d.isAffiliate))
        if (!cancelled) bump((n) => n + 1)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  return userId !== null && cache.get(userId) === true
}
