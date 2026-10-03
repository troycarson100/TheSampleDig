"use client"

import { useEffect, useState } from "react"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"
import { useOwnershipViewer } from "@/lib/use-owns-shft"

const NONE = Object.fromEntries(PLUGIN_ORDER.map((id) => [id, false])) as Record<PluginId, boolean>

export interface PluginOwnership {
  loading: boolean
  /**
   * True when the ownership request failed (network error or non-2xx
   * response). Callers must treat this exactly like `loading` — keep
   * rendering the inert placeholder — never fall back to `owned`/`missing`
   * here: a failed request is not evidence that the visitor owns nothing,
   * and offering a sale on that basis is the bug this field exists to stop.
   */
  error: boolean
  signedIn: boolean
  owned: Record<PluginId, boolean>
  ownedCount: number
  /** Plugins the visitor does not own, in display order. */
  missing: PluginId[]
}

interface OwnershipData {
  owned: Record<PluginId, boolean>
  signedIn: boolean
}

// Module-level cache + in-flight dedupe, same shape as lib/use-owns-shft.ts.
// Every consumer on a page (PluginChrome, StickyBuy, BuyButton — twice on a
// product page — and PluginsStore plus one BuyButton per card) shares this,
// so one page load makes one request instead of one per consumer. Kept per
// account, like lib/use-owns-shft.ts and for the same reason: signing in
// does not reload the page, and an answer from before it is someone else's.
type Result = OwnershipData | "error"
let cache: { who: string; result: Result } | null = null
let inFlight: { who: string; promise: Promise<Result> } | null = null

function fetchOwnership(who: string): Promise<Result> {
  if (cache?.who === who) return Promise.resolve(cache.result)
  if (inFlight?.who === who) return inFlight.promise
  const promise = fetch("/api/plugins/ownership")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`ownership fetch: ${r.status}`))))
    .then((d): OwnershipData => ({ owned: d.owned, signedIn: Boolean(d.signedIn) }))
    .catch((): "error" => "error")
    .then((result) => {
      if (inFlight?.who === who) {
        cache = { who, result }
        inFlight = null
      }
      return result
    })
  inFlight = { who, promise }
  return promise
}

/**
 * Ownership for the whole plugin range, in one request.
 *
 * `loading` gates every ownership-dependent render. Nothing that depends on
 * ownership may render before it resolves: showing a bundle to someone who owns
 * two of three, even for one frame, offers to sell them what they already have.
 *
 * A failed request must never resolve to "owns nothing" — that fails open and
 * offers to sell what the visitor may already own. It surfaces as `error`
 * instead of silently settling `owned` to all-false; every consumer must
 * treat `error` the same as `loading` and keep rendering the inert
 * placeholder rather than a purchase control.
 */
export function usePluginOwnership(): PluginOwnership {
  const who = useOwnershipViewer()
  const [state, setState] = useState<{ who: string; result: Result } | null>(cache)

  useEffect(() => {
    if (!who) return
    let live = true
    void fetchOwnership(who).then((r) => {
      if (live) setState({ who, result: r })
    })
    return () => {
      live = false
    }
  }, [who])

  const result = who !== null && state?.who === who ? state.result : null
  const loading = result === null
  const error = result === "error"
  const owned = loading || error ? NONE : result.owned
  const signedIn = loading || error ? false : result.signedIn
  const ownedCount = PLUGIN_ORDER.filter((id) => owned[id]).length
  const missing = PLUGIN_ORDER.filter((id) => !owned[id])

  return { loading, error, signedIn, owned, ownedCount, missing }
}
