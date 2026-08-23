// One source of truth for "what can be sold/granted, and what does each grant".
//
// This used to live inline in the Stripe webhook while comp codes hardcoded
// "shft". Two copies of the grant map is exactly the kind of thing that drifts:
// add a third plugin, update one, and comps quietly keep handing out the wrong
// product. Everything that grants entitlements imports from here.

/** A thing a Purchase row can be for. Comp codes may also grant a bundle,
 *  which is not itself a product - see CompProduct. */
export const PLUGIN_PRODUCTS = ["shft", "drft"] as const
export type PluginProduct = (typeof PLUGIN_PRODUCTS)[number]

/** What an admin can mint a comp code for: either plugin, or the bundle. */
export const COMP_PRODUCTS = ["shft", "drft", "bundle"] as const
export type CompProduct = (typeof COMP_PRODUCTS)[number]

/** What each purchasable/grantable thing turns into as Purchase rows. */
export const PLUGIN_GRANTS: Record<CompProduct, readonly PluginProduct[]> = {
  shft: ["shft"],
  drft: ["drft"],
  bundle: ["shft", "drft"],
}

/** Display copy. Lowercase because both plugins are styled lowercase. */
export const PRODUCT_LABEL: Record<CompProduct, string> = {
  shft: "shft",
  drft: "drft",
  bundle: "shft + drft",
}

export function isCompProduct(value: unknown): value is CompProduct {
  return typeof value === "string" && (COMP_PRODUCTS as readonly string[]).includes(value)
}

export function isPluginProduct(value: unknown): value is PluginProduct {
  return typeof value === "string" && (PLUGIN_PRODUCTS as readonly string[]).includes(value)
}

/** Comp codes minted before the product column existed are shft, which is what
 *  the column defaults to - this keeps that assumption in one place. */
export const LEGACY_COMP_PRODUCT: CompProduct = "shft"

/** Narrows a stored string, falling back to the legacy product rather than
 *  throwing: a row with an unexpected value should still be listable in the
 *  admin table, not crash the page. */
export function asCompProduct(value: string | null | undefined): CompProduct {
  return isCompProduct(value) ? value : LEGACY_COMP_PRODUCT
}
