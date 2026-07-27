"use client"

import { useEffect, useState } from "react"

/**
 * Shared client hook: does the current visitor already own shft?
 *
 * Backed by GET /api/shft/ownership, which returns { owned: false } for
 * logged-out users. The result is cached at module level and the in-flight
 * request is shared, so multiple consumers (the bell popover + the /dig promo
 * dock) trigger a single request per page load.
 */

type OwnershipState = { owned: boolean; loading: boolean }

let cached: boolean | null = null
let inFlight: Promise<boolean> | null = null

function fetchOwnership(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached)
  if (inFlight) return inFlight
  inFlight = fetch("/api/shft/ownership")
    .then((r) => (r.ok ? r.json() : { owned: false }))
    .then((d) => Boolean(d?.owned))
    .catch(() => false)
    .then((owned) => {
      cached = owned
      inFlight = null
      return owned
    })
  return inFlight
}

export function useOwnsShft(): OwnershipState {
  const [state, setState] = useState<OwnershipState>(() =>
    cached === null ? { owned: false, loading: true } : { owned: cached, loading: false }
  )

  useEffect(() => {
    let active = true
    // Resolves immediately from cache or shares the in-flight request; setState
    // runs in the async callback, not synchronously in the effect body.
    void fetchOwnership().then((owned) => {
      if (active) setState({ owned, loading: false })
    })
    return () => {
      active = false
    }
  }, [])

  return state
}
