"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cartTotals, type CartTotals } from "@/lib/cart-pricing"
import { normalizePromoCode, quotePromo, sanitizeStoredOffer, type PromoOffer, type PromoQuote } from "@/lib/cart-promo"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"

const STORAGE_KEY = "sampleroll_cart_v1"
const PROMO_STORAGE_KEY = "sampleroll_cart_promo_v1"
const MEMBER_CODE_KEY = "sampleroll_member_code_v1"
/** The member code the visitor took off the current order, kept with the cart
 *  so a page load does not put it straight back. */
const DECLINED_KEY = "sampleroll_member_declined_v1"

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

/** Same rule as the ids: whatever is in storage is checked before it is
 *  believed. A stored offer only ever decides what the page shows — checkout
 *  looks the code up again — but it should not be able to show a discount no
 *  code gives. */
function readStoredPromo(): PromoOffer | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(PROMO_STORAGE_KEY)
    return raw ? sanitizeStoredOffer(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeStoredPromo(offer: PromoOffer | null) {
  try {
    if (offer) window.localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(offer))
    else window.localStorage.removeItem(PROMO_STORAGE_KEY)
  } catch { /* private mode */ }
}

/** A member's own code, which the cart applies without being asked (see
 *  lib/member-offer.ts). Remembered by the visitor, not the order: a code that
 *  arrived by the link in its email still applies to an order started next
 *  week, until it expires or Stripe says it has been used. */
interface MemberCode {
  code: string
  /** ms since the epoch, when known - a code from the account is dated, one
   *  from a link is not until Stripe is asked about it. */
  expiresAt: number | null
}

function readMemberCode(now: number): MemberCode | null {
  try {
    const raw = window.localStorage.getItem(MEMBER_CODE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { code?: unknown; expiresAt?: unknown }
    const code = normalizePromoCode(v.code)
    const expiresAt = typeof v.expiresAt === "number" && Number.isFinite(v.expiresAt) ? v.expiresAt : null
    if (!code || (expiresAt !== null && expiresAt <= now)) return null
    return { code, expiresAt }
  } catch {
    return null
  }
}

function writeMemberCode(value: MemberCode | null) {
  try {
    if (value) window.localStorage.setItem(MEMBER_CODE_KEY, JSON.stringify(value))
    else window.localStorage.removeItem(MEMBER_CODE_KEY)
  } catch { /* private mode */ }
}

/** A code in the address - `?promo=SR10ABC123`, the link in a member-offer
 *  email - taken off the address once it has been read, so it is not left in
 *  the history, in a shared link, or in the page someone bookmarks. */
function takeCodeFromAddress(): string | null {
  const url = new URL(window.location.href)
  const raw = url.searchParams.get("promo")
  if (raw === null) return null
  url.searchParams.delete("promo")
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
  return normalizePromoCode(raw)
}

/** Why a code was not applied, in the terms the page needs to explain it. */
export type PromoFailure = "not_valid" | "rate_limited" | "unavailable"

export interface Cart {
  ids: PluginId[]
  totals: CartTotals
  /** The promo code on this order, or null. One per order, shared by the
   *  drawer and the checkout page. */
  promo: PromoOffer | null
  /** `totals` with the promo code on it: what the order will actually cost.
   *  This, not `totals.total`, is the figure to show as the amount due. */
  quote: PromoQuote
  /** Asks the server about a code and, if it is good, puts it on the order.
   *  Resolves to null on success, or to the reason it was not applied. */
  applyPromo(code: string): Promise<PromoFailure | null>
  clearPromo(): void
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
  /** What the visitor took out of the cart by hand, newest last. The drawer
      offers these back (see lib/cart-suggestions.ts). Only `remove` adds to
      it: what a purchase clears or ownership drops is not something the
      visitor changed their mind about. Held for the visit, not stored. */
  removed: PluginId[]
  /** The member code this visitor's cart applies by itself, or null. For the
      promo box to say so, when that is the code on the order. */
  memberCode: string | null
}

export function useCartState(): Cart {
  // Empty on the server and on the first client render, then hydrated from
  // storage in an effect — reading localStorage during render would mismatch.
  const [ids, setIds] = useState<PluginId[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [dropped, setDropped] = useState<PluginId[]>([])
  const [removed, setRemoved] = useState<PluginId[]>([])
  const [memberCode, setMemberCode] = useState<MemberCode | null>(null)
  // The member code the visitor took off this order. It stays off until the
  // order ends - the cart empties - and the next order gets it back.
  const [declined, setDeclined] = useState<string | null>(null)
  const [storedPromo, setStoredPromo] = useState<PromoOffer | null>(null)
  // False until storage has been read. An empty cart writes "no promo" to
  // storage (below), and before hydration the cart is always empty — without
  // this, the first render would throw away a stored code every time.
  const [hydrated, setHydrated] = useState(false)
  const { loading, error, owned } = usePluginOwnership()

  useEffect(() => {
    setIds(readStored())
    setStoredPromo(readStoredPromo())
    const fromLink = takeCodeFromAddress()
    if (fromLink) writeMemberCode({ code: fromLink, expiresAt: null })
    setMemberCode(readMemberCode(Date.now()))
    try { setDeclined(window.localStorage.getItem(DECLINED_KEY)) } catch { /* private mode */ }
    setHydrated(true)
  }, [])

  // A signed-in member's code, from their account. It wins over one from a
  // link: it is certainly theirs, and it comes with its expiry.
  useEffect(() => {
    let live = true
    void fetch("/api/cart/offer")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { offer?: { code?: unknown; expiresAt?: unknown } | null } | null) => {
        const code = normalizePromoCode(d?.offer?.code)
        const expiresAt = typeof d?.offer?.expiresAt === "string" ? Date.parse(d.offer.expiresAt) : NaN
        if (!live || !code || !Number.isFinite(expiresAt)) return
        const next = { code, expiresAt }
        writeMemberCode(next)
        setMemberCode(next)
      })
      .catch(() => { /* no code is the same as no answer */ })
    return () => { live = false }
  }, [])
  useEffect(() => { writeStored(ids) }, [ids])

  // A code belongs to an order, not to the visitor. Once the cart is empty —
  // everything removed by hand, or cleared by /thanks after a purchase — the
  // order is over, and the code must not be waiting on whatever is bought
  // next. Two halves: an empty cart has no promo (derived here, and written to
  // storage as none), and the first thing added to an empty cart starts a new
  // order without one (see `add` and `addAll`).
  const promo = ids.length > 0 ? storedPromo : null
  useEffect(() => { if (hydrated) writeStoredPromo(promo) }, [promo, hydrated])
  const idsRef = useRef(ids)
  useEffect(() => { idsRef.current = ids }, [ids])

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
    if (idsRef.current.length === 0) { setStoredPromo(null); setDeclined(null) }
    setIds((c) => (c.includes(id) ? c : [...c, id]))
  }, [])
  const remove = useCallback((id: PluginId) => {
    setIds((c) => c.filter((x) => x !== id))
    setRemoved((r) => [...r.filter((x) => x !== id), id])
  }, [])
  // Empty input is a deliberate no-op rather than a full clear: a caller that
  // computed "nothing to remove" must not accidentally empty the cart.
  const removeMany = useCallback((toRemove: readonly PluginId[]) => {
    if (toRemove.length === 0) return
    const gone = new Set(toRemove)
    setIds((c) => c.filter((x) => !gone.has(x)))
  }, [])
  const addAll = useCallback(() => {
    if (idsRef.current.length === 0) { setStoredPromo(null); setDeclined(null) }
    setIds([...PLUGIN_ORDER])
  }, [])
  const clear = useCallback(() => setIds([]), [])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const clearDropped = useCallback(() => setDropped([]), [])

  const applyPromo = useCallback(async (raw: string): Promise<PromoFailure | null> => {
    // Not worth a request, or one of the ten a minute the server allows.
    const code = normalizePromoCode(raw)
    if (!code) return "not_valid"
    try {
      const res = await fetch("/api/cart/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      if (res.status === 429) return "rate_limited"
      if (res.status === 404) return "not_valid"
      if (!res.ok) return "unavailable"
      const data: unknown = await res.json().catch(() => null)
      const offer = sanitizeStoredOffer((data as { offer?: unknown } | null)?.offer)
      if (!offer) return "unavailable"
      setStoredPromo(offer)
      return null
    } catch {
      return "unavailable"
    }
  }, [])
  // Taking the member code off is a choice about this order, and is kept to:
  // it is not put straight back.
  // Stored with the order it belongs to: written while there is one, and gone
  // with it. Only once storage has been read, or the first render - always an
  // empty cart - would erase it.
  const declinedNow = ids.length > 0 ? declined : null
  useEffect(() => {
    if (!hydrated) return
    try {
      if (declinedNow) window.localStorage.setItem(DECLINED_KEY, declinedNow)
      else window.localStorage.removeItem(DECLINED_KEY)
    } catch { /* private mode */ }
  }, [declinedNow, hydrated])

  const promoRef = useRef(promo)
  useEffect(() => { promoRef.current = promo }, [promo])
  const clearPromo = useCallback(() => {
    if (promoRef.current) setDeclined(promoRef.current.code.toUpperCase())
    setStoredPromo(null)
  }, [])

  // The member code goes on by itself, whenever there is something in the
  // cart and no code on the order - the drawer and checkout alike, since both
  // read this one cart. Asked about like any code, so Stripe's word decides:
  // refused means used or expired, and it is forgotten rather than tried on
  // every page. A failure to ask at all is not a refusal, and is not held
  // against it past this page.
  const asking = useRef(false)
  const refused = useRef(new Set<string>())
  useEffect(() => {
    if (!hydrated || ids.length === 0 || promo || !memberCode || asking.current) return
    const code = memberCode.code
    if (declinedNow === code.toUpperCase() || refused.current.has(code)) return
    asking.current = true
    // Started after this effect returns, not inside it: nothing here sets
    // state before the request is answered, and this says so to the linter.
    void Promise.resolve().then(() => applyPromo(code)).then((failure) => {
      asking.current = false
      if (!failure) return
      refused.current.add(code)
      if (failure === "not_valid") {
        writeMemberCode(null)
        setMemberCode(null)
      }
    })
  }, [hydrated, ids.length, promo, memberCode, declinedNow, applyPromo])

  const totals = useMemo(() => cartTotals(ids), [ids])
  const quote = useMemo(() => quotePromo(totals, promo), [totals, promo])

  return {
    ids, totals, promo, quote, applyPromo, clearPromo,
    add, remove, removeMany, addAll, clear, isOpen, open, close, dropped, clearDropped, removed,
    memberCode: memberCode?.code ?? null,
  }
}
