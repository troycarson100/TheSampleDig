import { PLUGIN_GRANTS, PLUGIN_PRODUCTS, isCompProduct, type PluginProduct } from "./plugin-products"

// Abandoned checkouts: the rules, pure. lib/cart-recovery.ts does the I/O.
//
// A plugin checkout that is never paid expires; Stripe then sends the webhook
// a `checkout.session.expired` with a recovery link that rebuilds the same
// cart (same plugins, same buyer, same thanks page - checked against Stripe
// test mode, 2026-10-02). We email that link, once, to buyers who said yes to
// hearing from us at checkout.
//
// Off unless STRIPE_CART_RECOVERY=on. Stripe refuses to create a session that
// asks for that consent until the account has accepted its terms at
// dashboard.stripe.com/settings/checkout - with this on before then, every
// checkout would fail - so it is switched on by hand, after that.

export function cartRecoveryEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.STRIPE_CART_RECOVERY === "on"
}

/** How long a checkout stays open. Stripe's default is a day; a reminder a
 *  day later finds most people long gone, so the cart is called abandoned
 *  after three hours. Someone who pays inside that never notices. */
export const RECOVERY_SESSION_TTL_S = 3 * 60 * 60

/** What a plugin Checkout Session adds when recovery is on. */
export function recoverySessionParams(nowMs: number) {
  return {
    consent_collection: { promotions: "auto" as const },
    after_expiration: { recovery: { enabled: true, allow_promotion_codes: true } },
    expires_at: Math.floor(nowMs / 1000) + RECOVERY_SESSION_TTL_S,
  }
}

/** The fields of an expired session this decides on, declared structurally
 *  so tests pass plain objects. */
export type ExpiredSession = {
  id: string
  created: number
  metadata?: Record<string, string> | null
  customer_email?: string | null
  customer_details?: { email?: string | null } | null
  consent?: { promotions?: string | null } | null
  recovered_from?: string | null
  after_expiration?: { recovery?: { url?: string | null } | null } | null
}

/** Another checkout by the same address, as Stripe lists it. */
export type OtherSession = { id: string; created: number; status: string | null }

/** What an abandoned cart held: the sold list when the session carries one
 *  (a cart), otherwise what its product grants (a single plugin, the bundle). */
export function cartProducts(metadata: Record<string, string> | null | undefined): PluginProduct[] {
  const listed = (metadata?.products ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is PluginProduct => (PLUGIN_PRODUCTS as readonly string[]).includes(s))
  if (listed.length) return listed
  const product = metadata?.product
  return isCompProduct(product) ? [...PLUGIN_GRANTS[product]] : []
}

export type RecoveryDecision =
  | { send: true; email: string; url: string; products: PluginProduct[] }
  | { send: false; reason: "not_plugin" | "no_link" | "no_consent" | "no_email" | "second_try" | "superseded" | "owned" }

/**
 * Whether to email this abandoned cart. Once per person per run of attempts:
 * a cart re-opened from a reminder that expires again gets no second one, and
 * of several checkouts started by one address only the newest is written
 * about - and not at all if any later one was paid. `owned` is what the
 * address owns now, looked up by the caller; a cart holding anything in it
 * is let go.
 */
export function decideRecoveryEmail(
  s: ExpiredSession,
  others: readonly OtherSession[],
  owned: readonly string[],
): RecoveryDecision {
  const products = cartProducts(s.metadata)
  if (!products.length) return { send: false, reason: "not_plugin" }
  const url = s.after_expiration?.recovery?.url
  if (!url) return { send: false, reason: "no_link" }
  // Consent is Stripe's record of the box at checkout. No box ticked, no email.
  if (s.consent?.promotions !== "opt_in") return { send: false, reason: "no_consent" }
  const email = (s.customer_details?.email ?? s.customer_email ?? "").trim().toLowerCase()
  if (!email) return { send: false, reason: "no_email" }
  if (s.recovered_from) return { send: false, reason: "second_try" }
  if (others.some((o) => o.id !== s.id && (o.created > s.created || (o.status === "complete" && o.created >= s.created)))) {
    return { send: false, reason: "superseded" }
  }
  // The link rebuilds the cart exactly as it was, so if any of it has since
  // been bought - here, or on another visit - following it would charge for
  // a plugin they already have.
  if (products.some((p) => owned.includes(p))) return { send: false, reason: "owned" }
  return { send: true, email, url, products }
}
