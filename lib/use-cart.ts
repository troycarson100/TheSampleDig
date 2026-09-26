"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { cartTotals, type CartTotals } from "@/lib/cart-pricing"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"

const STORAGE_KEY = "sampleroll_cart_v1"

const isPluginId = (v: unknown): v is PluginId =>
  typeof v === "string" && (PLUGIN_ORDER as readonly string[]).includes(v)

/** Stored state is untrusted: a removed plugin or a tampered value must not reach checkout. */
function readStored(): PluginId[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isPluginId) : []
  } catch {
    return []
  }
}

function writeStored(ids: PluginId[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)) } catch { /* private mode */ }
}

export interface Cart {
  ids: PluginId[]
  totals: CartTotals
  add(id: PluginId): void
  remove(id: PluginId): void
  addAll(): void
  clear(): void
  isOpen: boolean
  open(): void
  close(): void
  dropped: PluginId[]
  clearDropped(): void
}

export function useCartState(): Cart {
  // Empty on the server and on the first client render, then hydrated from
  // storage in an effect — reading localStorage during render would mismatch.
  const [ids, setIds] = useState<PluginId[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [dropped, setDropped] = useState<PluginId[]>([])
  const { loading, error, owned } = usePluginOwnership()

  useEffect(() => { setIds(readStored()) }, [])
  useEffect(() => { writeStored(ids) }, [ids])

  // Drop anything the visitor turns out to own. Only once ownership is actually
  // known: acting on loading or error would silently empty a legitimate cart.
  useEffect(() => {
    if (loading || error) return
    setIds((current) => {
      const keep = current.filter((id) => !owned[id])
      if (keep.length === current.length) return current
      setDropped(current.filter((id) => owned[id]))
      return keep
    })
  }, [loading, error, owned])

  const add = useCallback((id: PluginId) => {
    setIds((c) => (c.includes(id) ? c : [...c, id]))
  }, [])
  const remove = useCallback((id: PluginId) => setIds((c) => c.filter((x) => x !== id)), [])
  const addAll = useCallback(() => setIds([...PLUGIN_ORDER]), [])
  const clear = useCallback(() => setIds([]), [])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const clearDropped = useCallback(() => setDropped([]), [])

  const totals = useMemo(() => cartTotals(ids), [ids])

  return { ids, totals, add, remove, addAll, clear, isOpen, open, close, dropped, clearDropped }
}
