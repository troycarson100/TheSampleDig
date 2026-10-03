"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

/**
 * Shared client hook: does the current visitor already own shft?
 *
 * Backed by GET /api/shft/ownership, which returns { owned: false } for
 * logged-out users. The result is cached at module level and the in-flight
 * request is shared, so multiple consumers (the bell popover + the /dig promo
 * dock) trigger a single request per page load.
 *
 * The cache is kept per account. Signing in is a client-side navigation - the
 * page never reloads - so a cache that ignored who was asking kept the answer
 * it got while they were signed out, and the /dig dock went on selling shft
 * to someone who owns it (2026-10-03). When the session changes, the answer
 * is fetched again; until it is, `loading` holds.
 */

type OwnershipState = { owned: boolean; loading: boolean }

let cache: { who: string; owned: boolean } | null = null
let inFlight: { who: string; promise: Promise<boolean> } | null = null

function fetchOwnership(who: string): Promise<boolean> {
  if (cache?.who === who) return Promise.resolve(cache.owned)
  if (inFlight?.who === who) return inFlight.promise
  const promise = fetch("/api/shft/ownership")
    .then((r) => (r.ok ? r.json() : { owned: false }))
    .then((d) => Boolean(d?.owned))
    .catch(() => false)
    .then((owned) => {
      if (inFlight?.who === who) {
        cache = { who, owned }
        inFlight = null
      }
      return owned
    })
  inFlight = { who, promise }
  return promise
}

/** Who is asking: an account id, "anon", or null while the session loads. */
export function useOwnershipViewer(): string | null {
  const { data, status } = useSession()
  if (status === "loading") return null
  return data?.user?.id ?? data?.user?.email ?? "anon"
}

export function useOwnsShft(): OwnershipState {
  const who = useOwnershipViewer()
  const [state, setState] = useState<{ who: string; owned: boolean } | null>(cache)

  useEffect(() => {
    if (!who) return
    let active = true
    // Resolves immediately from cache or shares the in-flight request; setState
    // runs in the async callback, not synchronously in the effect body.
    void fetchOwnership(who).then((owned) => {
      if (active) setState({ who, owned })
    })
    return () => {
      active = false
    }
  }, [who])

  const ready = who !== null && state?.who === who
  return { owned: ready ? state.owned : false, loading: !ready }
}
