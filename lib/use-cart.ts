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
  /** Removes exactly these ids, leaving anything else the visitor added
   *  alone. For clearing what a purchase just paid for — see /thanks. */
  removeMany(ids: readonly PluginId[]): void
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
    const ownedInCart = ids.filter((id) => owned[id])
    if (ownedInCart.length === 0) return
    setDropped(ownedInCart)
    setIds((current) => current.filter((id) => !owned[id]))
  }, [ids, loading, error, owned])

  const add = useCallback((id: PluginId) => {
    setIds((c) => (c.includes(id) ? c : [...c, id]))
  }, [])
  const remove = useCallback((id: PluginId) => setIds((c) => c.filter((x) => x !== id)), [])
  // Empty input is a deliberate no-op rather than a full clear: a caller that
  // computed "nothing to remove" must not accidentally empty the cart.
  const removeMany = useCallback((toRemove: readonly PluginId[]) => {
    if (toRemove.length === 0) return
    const gone = new Set(toRemove)
    setIds((c) => c.filter((x) => !gone.has(x)))
  }, [])
  const addAll = useCallback(() => setIds([...PLUGIN_ORDER]), [])
  const clear = useCallback(() => setIds([]), [])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const clearDropped = useCallback(() => setDropped([]), [])

  const totals = useMemo(() => cartTotals(ids), [ids])

  return { ids, totals, add, remove, removeMany, addAll, clear, isOpen, open, close, dropped, clearDropped }
}
