import { PLUGIN_PRODUCTS, type PluginProduct } from "./plugin-products"

export interface BundleEligibility {
  ok: boolean
  reason?: "already_owned" | "partial_owner"
  owns: PluginProduct[]
}

/**
 * May this visitor buy the all-three bundle?
 *
 * Only someone who owns none of it. There is no bundle price that is correct for
 * a partial owner — charging them the bundle would charge again for what they
 * already have — and with the crossgrade retired there is no discounted price to
 * offer instead. They buy the singles they are missing.
 */
export function bundleEligibility(ownedIds: readonly string[]): BundleEligibility {
  const owns = PLUGIN_PRODUCTS.filter((id) => ownedIds.includes(id))
  if (owns.length === PLUGIN_PRODUCTS.length) return { ok: false, reason: "already_owned", owns: [...owns] }
  if (owns.length > 0) return { ok: false, reason: "partial_owner", owns: [...owns] }
  return { ok: true, owns: [] }
}
