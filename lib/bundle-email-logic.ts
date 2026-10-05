import { COMPLETE_SET_PRICE } from "./complete-set-logic"
import { PLUGIN_ORDER, PLUGINS, type PluginId } from "./plugins"
import { PRICING } from "./products"

// The fourth member email: the bundle, and whatever deal each reader has, in
// the dark of the fltr page. The rules, pure - lib/bundle-email.ts makes it a
// campaign and lib/bundle-email-html.ts draws it.
//
// Its lead offer follows what they own:
//   none of the three  -> the bundle, all three for $59 - and with their $10
//                         member code, if unused, $49
//   one or two         -> the rest of the set at the complete-set price
// and a section for each plugin - owned, or its price.
//
// The code is shown only beside the bundle, the one deal it stacks with. The
// complete-set checkout takes no promo code, so a "$10 OFF ANYTHING" under the
// complete-set price read as ten dollars less to anyone skimming - and the
// code never beat that offer anyway: more for the other two, the same for the
// last one. Someone who owns all three has nothing to buy and is not written
// to; nor is anyone who has unsubscribed.

export const BUNDLE_EMAIL = {
  slug: "members-bundle-2026-10",
  offerSlug: "members-10-off-2026-10",
  /** The end of the bundle sale, Pacific - and of the complete-set links. */
  endsAt: new Date("2026-10-31T23:59:59-07:00"),
} as const

/** The order the plugins appear in, wherever this email lists them: fltr
 *  first - the newest, and the one the other emails were about. */
export const BUNDLE_EMAIL_ORDER: readonly PluginId[] = ["fltr", "shft", "drft"]

export type BundleParts = {
  /** "none" only when a complete-set link could not be made for them. */
  offer: "bundle" | "set" | "none"
  code: boolean
  /** The plugins they don't own, in BUNDLE_EMAIL_ORDER. */
  missing: PluginId[]
}

export type BundleExclusion = "opted-out" | "owns-everything"

export function bundleParts(p: {
  emailMarketingOptIn: boolean
  productUpdateOptIn: boolean
  owns: readonly string[]
  code: string | null
  codeRedeemed: boolean
}): BundleParts | BundleExclusion {
  if (!p.emailMarketingOptIn || !p.productUpdateOptIn) return "opted-out"
  const missing = BUNDLE_EMAIL_ORDER.filter((id) => !p.owns.includes(id))
  if (missing.length === 0) return "owns-everything"
  return {
    offer: missing.length === PLUGIN_ORDER.length ? "bundle" : "set",
    code: missing.length === PLUGIN_ORDER.length && Boolean(p.code) && !p.codeRedeemed,
    missing,
  }
}

export function bundleVariant(p: BundleParts): string {
  return p.code ? `${p.offer}+code` : p.offer
}

export const BUNDLE_VARIANTS = ["bundle", "bundle+code", "set", "none"] as const

const names = (ids: readonly PluginId[]) => ids.map((id) => PLUGINS[id].name).join(" + ")

/** What the rest of the set costs them, and what it would at the usual prices. */
export function setPrices(missing: readonly PluginId[]): { price: number; was: number } {
  return {
    price: COMPLETE_SET_PRICE[missing.length] ?? missing.reduce((s, id) => s + PRICING[id].price, 0),
    was: missing.reduce((s, id) => s + PRICING[id].price, 0),
  }
}

export function bundleSubject(p: BundleParts): string {
  if (p.offer === "bundle") return `All three plugins, $${PRICING.bundle.price} - ends October 31`
  if (p.offer === "set") return `Complete your set: ${names(p.missing)} for $${setPrices(p.missing).price}`
  return "Your Sample Roll plugins - and what's left to get"
}
