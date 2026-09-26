import { PLUGIN_PRODUCTS, isPluginProduct, type PluginProduct } from "./plugin-products"

export interface CartCheck {
  requested: PluginProduct[]
  owned: PluginProduct[]
  sellable: PluginProduct[]
  empty: boolean
}

/**
 * What may actually be sold to this buyer.
 *
 * Both arguments are untrusted strings: the cart comes from localStorage or a
 * request body, and anything that is not a real plugin id is discarded rather
 * than passed along. Owned items are separated instead of dropped silently, so
 * callers can tell the buyer why their cart changed.
 *
 * Replaces bundle-eligibility: the question is no longer "may they buy the
 * bundle" but "which of these do they already have".
 */
export function checkCart(requestedIds: readonly string[], ownedIds: readonly string[]): CartCheck {
  const asked = new Set(requestedIds.filter(isPluginProduct))
  const has = new Set(ownedIds.filter(isPluginProduct))

  const requested = PLUGIN_PRODUCTS.filter((id) => asked.has(id))
  const owned = requested.filter((id) => has.has(id))
  const sellable = requested.filter((id) => !has.has(id))

  return { requested, owned, sellable, empty: sellable.length === 0 }
}
