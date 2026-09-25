"use client"

import { useEffect, useState } from "react"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"

const NONE = Object.fromEntries(PLUGIN_ORDER.map((id) => [id, false])) as Record<PluginId, boolean>

export interface PluginOwnership {
  loading: boolean
  signedIn: boolean
  owned: Record<PluginId, boolean>
  ownedCount: number
  /** Plugins the visitor does not own, in display order. */
  missing: PluginId[]
}

/**
 * Ownership for the whole plugin range, in one request.
 *
 * `loading` gates every ownership-dependent render. Nothing that depends on
 * ownership may render before it resolves: showing a bundle to someone who owns
 * two of three, even for one frame, offers to sell them what they already have.
 */
export function usePluginOwnership(): PluginOwnership {
  const [owned, setOwned] = useState<Record<PluginId, boolean>>(NONE)
  const [signedIn, setSignedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    fetch("/api/plugins/ownership")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d) return
        setOwned(d.owned)
        setSignedIn(Boolean(d.signedIn))
      })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

  const ownedCount = PLUGIN_ORDER.filter((id) => owned[id]).length
  const missing = PLUGIN_ORDER.filter((id) => !owned[id])
  return { loading, signedIn, owned, ownedCount, missing }
}
