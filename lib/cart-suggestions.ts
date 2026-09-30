import { cartTotals } from "./cart-pricing"
import { PLUGIN_ORDER, type PluginId } from "./plugins"
import { PRICING } from "./products"

/** A plugin taken out of the cart, offered back under it. */
export interface Suggestion {
  id: PluginId
  /** What it costs on its own. */
  price: number
  /** What adding it would actually put on the order. Less than `price` when
      it is the last one missing and the bundle takes over. */
  extra: number
  /** Adding it puts all of them in the cart, at the bundle price. */
  completesBundle: boolean
}

/** All of them at once, offered when more than one is missing. */
export interface BundleOffer {
  price: number
  /** What it would add to the order as it stands. */
  extra: number
  /** Against buying the missing ones one at a time. */
  saving: number
}

export interface Suggestions {
  items: Suggestion[]
  bundle: BundleOffer | null
}

const NONE: Suggestions = { items: [], bundle: null }

/**
 * What the cart drawer offers under the cart: the plugins the visitor took out
 * of it, and the bundle where it would save them money. An empty cart offers
 * every plugin the visitor does not own, taken out or not: there is nothing in
 * it to add to, so the drawer suggests where to start.
 *
 * Only ever from known ownership. Unknown (still loading, or the request
 * failed) offers nothing: a failed request is not evidence that the visitor
 * owns nothing, and offering what they may already have is the one thing this
 * must not do. Anything owned is left out, and so is anything back in the
 * cart.
 *
 * The bundle is offered only to someone who owns none of the range: an owned
 * plugin can never be in the cart, so the cart can never hold all of them and
 * the bundle price can never apply. And only when more than one plugin is
 * missing from the cart - with one missing, that one's own suggestion already
 * says it completes the bundle, and a second card would say it again.
 */
export function cartSuggestions({
  ids,
  removed,
  owned,
  known,
}: {
  ids: readonly PluginId[]
  removed: readonly PluginId[]
  owned: Readonly<Record<PluginId, boolean>>
  known: boolean
}): Suggestions {
  if (!known) return NONE
  const inCart = new Set(ids)
  const taken = new Set(removed)
  const now = cartTotals(ids).total
  const ownsAny = PLUGIN_ORDER.some((id) => owned[id])

  const empty = inCart.size === 0
  const items = PLUGIN_ORDER.filter((id) => (empty || taken.has(id)) && !inCart.has(id) && !owned[id]).map((id) => {
    const withIt = cartTotals([...ids, id])
    return { id, price: PRICING[id].price, extra: withIt.total - now, completesBundle: withIt.bundleApplied }
  })
  if (items.length === 0) return NONE

  const missing = PLUGIN_ORDER.filter((id) => !inCart.has(id))
  const all = cartTotals(PLUGIN_ORDER)
  const bundle =
    !ownsAny && missing.length > 1
      ? {
          price: all.total,
          extra: all.total - now,
          saving: missing.reduce((sum, id) => sum + PRICING[id].price, 0) - (all.total - now),
        }
      : null

  return { items, bundle: bundle && bundle.saving > 0 ? bundle : null }
}
