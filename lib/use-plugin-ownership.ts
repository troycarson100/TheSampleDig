"use client"

import { useEffect, useState } from "react"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"

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
// so one page load makes one request instead of one per consumer.
let cached: OwnershipData | "error" | null = null
let inFlight: Promise<OwnershipData | "error"> | null = null

function fetchOwnership(): Promise<OwnershipData | "error"> {
  if (cached !== null) return Promise.resolve(cached)
  if (inFlight) return inFlight
  inFlight = fetch("/api/plugins/ownership")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`ownership fetch: ${r.status}`))))
    .then((d): OwnershipData => ({ owned: d.owned, signedIn: Boolean(d.signedIn) }))
    .catch((): "error" => "error")
    .then((result) => {
      cached = result
      inFlight = null
      return result
    })
  return inFlight
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
  const [result, setResult] = useState<OwnershipData | "error" | null>(cached)

  useEffect(() => {
    if (cached !== null) return
    let live = true
    void fetchOwnership().then((r) => {
      if (live) setResult(r)
    })
    return () => {
      live = false
    }
  }, [])

  const loading = result === null
  const error = result === "error"
  const owned = loading || error ? NONE : result.owned
  const signedIn = loading || error ? false : result.signedIn
  const ownedCount = PLUGIN_ORDER.filter((id) => owned[id]).length
  const missing = PLUGIN_ORDER.filter((id) => !owned[id])

  return { loading, error, signedIn, owned, ownedCount, missing }
}
