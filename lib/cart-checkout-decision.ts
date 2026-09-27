import { checkCart } from "./cart-ownership"
import { cartTotals } from "./cart-pricing"
import type { CompProduct, PluginProduct } from "./plugin-products"

// The money decision for POST /api/cart/checkout, pulled out of the route so
// the one behaviour this whole increment exists to provide — refuse a sale of
// what's already owned, at the right price otherwise — can be proven without
// a database or a Stripe key. See lib/cart-checkout-decision.test.ts.
//
// Split in two rather than one function: resolveCartIdentity needs nothing
// but the request's own inputs, so the route can call it (and refuse) before
// ever touching the database — exactly where its two checks already lived.
// decideCartContents needs ownership, which only the database can answer, so
// it stays a separate call the route makes after that lookup.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CartBuyer = { id: string; email: string | null } | null

export type CartIdentityDecision =
  | { kind: "invalid-identity" }
  | { kind: "session-email-mismatch"; sessionEmail: string }
  | { kind: "ok" }

/**
 * Who is checking out. A guest needs something that at least looks like an
 * email; a signed-in buyer's session always wins over anything posted, but
 * only openly — a posted email that disagrees with the session's is refused
 * rather than silently overridden. Without this, a page that rendered the
 * guest form because useSession() hadn't yet picked up a sign-in in another
 * tab would let a buyer confirm one address, see that address's ownership,
 * and be charged and granted as a different one — see the whole-increment
 * review's Important 5.
 */
export function resolveCartIdentity(input: { postedEmail: string; buyer: CartBuyer }): CartIdentityDecision {
  const { postedEmail, buyer } = input
  if (!buyer && !EMAIL_RE.test(postedEmail)) return { kind: "invalid-identity" }
  if (buyer?.email && postedEmail && postedEmail !== buyer.email.trim().toLowerCase()) {
    return { kind: "session-email-mismatch", sessionEmail: buyer.email }
  }
  return { kind: "ok" }
}

export type CartContentsDecision =
  | { kind: "already-owned"; owns: PluginProduct[] }
  | { kind: "empty" }
  | { kind: "priced"; product: CompProduct; sellable: PluginProduct[]; bundleApplied: boolean; paid: number }

/**
 * What may actually be sold, once identity is settled and ownership has been
 * looked up. Owned is checked before empty on purpose: a fully-owned cart
 * must say what it owns, not falsely claim there was nothing there — see
 * Task 6's fix report on this branch.
 */
export function decideCartContents(input: {
  ids: readonly string[]
  ownedIds: readonly string[]
}): CartContentsDecision {
  const check = checkCart(input.ids, input.ownedIds)
  if (check.owned.length > 0) return { kind: "already-owned", owns: check.owned }
  if (check.empty) return { kind: "empty" }

  const totals = cartTotals(check.sellable)
  return {
    kind: "priced",
    product: totals.bundleApplied ? "bundle" : check.sellable[0],
    sellable: check.sellable,
    bundleApplied: totals.bundleApplied,
    paid: totals.total,
  }
}
