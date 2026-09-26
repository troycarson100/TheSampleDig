import { PLUGIN_ORDER, type PluginId } from "./plugins"
import { PRICING } from "./products"

export interface CartLine {
  id: PluginId
  price: number
  msrp: number
}

export interface CartTotals {
  lines: CartLine[]
  /** Sum of single prices, before any bundle discount. */
  subtotal: number
  /** True only when every plugin is present. Derived from PLUGIN_ORDER, never a literal. */
  bundleApplied: boolean
  /** subtotal, or the bundle price when bundleApplied. */
  total: number
  /** subtotal - total. Zero unless the bundle applied. */
  saving: number
  /** Combined list price, for the struck figure. */
  msrpTotal: number
}

/**
 * The cart's money rule, in one pure place.
 *
 * Items sit at their own price; the bundle price replaces the subtotal only
 * when every plugin is present. There is deliberately no two-item price — the
 * two-plugin bundle was retired, and reintroducing one here by accident is the
 * failure this function exists to make impossible.
 *
 * Input is de-duplicated and ordered by PLUGIN_ORDER, so the drawer's order
 * never depends on the order things were clicked.
 */
export function cartTotals(ids: readonly PluginId[]): CartTotals {
  const present = new Set(ids)
  const lines: CartLine[] = PLUGIN_ORDER.filter((id) => present.has(id)).map((id) => ({
    id,
    price: PRICING[id].price,
    msrp: PRICING[id].msrp,
  }))

  const subtotal = lines.reduce((sum, l) => sum + l.price, 0)
  const msrpTotal = lines.reduce((sum, l) => sum + l.msrp, 0)
  const bundleApplied = lines.length === PLUGIN_ORDER.length
  const total = bundleApplied ? PRICING.bundle.price : subtotal

  return { lines, subtotal, bundleApplied, total, saving: subtotal - total, msrpTotal }
}
