import { PLUGIN_GRANTS, PRODUCT_LABEL, type CompProduct, type PluginProduct } from "@/lib/plugin-products"

// A buyer paying again for something they already own leaves no trace of its
// own: Purchase is @@unique([userId, product]), so the repeat charge writes no
// row and appears in no sales figure on /admin/attribution. The grant already
// works this out — grantPluginPurchase returns `duplicates` — and until now
// that only ever reached a console.warn. This turns it into something the site
// owner actually receives.

export type DuplicatePurchaseAlertInput = {
  buyerEmail: string
  product: CompProduct
  /** Products this email already owned before the checkout began. */
  duplicates: PluginProduct[]
  /**
   * Everything this session actually granted (fresh grants and duplicates
   * alike) — session.metadata.products on a cart checkout, i.e.
   * result.items.map(i => i.product) from grantPluginPurchase. Undefined or
   * empty falls back to PLUGIN_GRANTS[product] for a legacy session that
   * predates the cart, where `product` alone (a single plugin id or
   * "bundle") already says the whole grant.
   *
   * This is the fix for the whole-increment review's Important 4: `product`
   * is session.metadata.product, which a cart checkout sets to sellable[0] —
   * a single plugin id — regardless of how many items were actually in the
   * cart. Computing "was this partial?" against PLUGIN_GRANTS[product] alone
   * made a two-item cart with one duplicate read as a FULL duplicate
   * (1 owned < PLUGIN_GRANTS["shft"].length === 1 is false), telling the
   * owner to refund a charge that had, in fact, delivered the second plugin.
   */
  products?: PluginProduct[]
  /** Stripe's amount_total, in cents. Null on a session that charged nothing. */
  amountTotal: number | null
  sessionId: string
}

/** Stripe amounts are in cents; an alert quoting "3400" would be unreadable. */
function formatAmount(cents: number | null): string {
  if (cents === null) return "an unknown amount"
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * The alert for a purchase that granted nothing new, or null when the purchase
 * was not a duplicate at all. Returning null rather than an empty message keeps
 * the "should we send anything?" decision here, where it is testable, instead
 * of in the webhook.
 */
export function duplicatePurchaseAlert(
  input: DuplicatePurchaseAlertInput,
): { subject: string; text: string } | null {
  if (input.duplicates.length === 0) return null

  const amount = formatAmount(input.amountTotal)
  const bought = PRODUCT_LABEL[input.product]
  const owned = input.duplicates.map((p) => PRODUCT_LABEL[p]).join(", ")
  const granted = input.products && input.products.length > 0 ? input.products : PLUGIN_GRANTS[input.product]
  const partial = input.duplicates.length < granted.length

  const subject = `Duplicate purchase: ${input.buyerEmail} paid ${amount} for ${bought}`

  const text = [
    `${input.buyerEmail} was charged ${amount} for ${bought}.`,
    ``,
    `They already owned: ${owned}.`,
    partial
      ? `PARTIAL duplicate - they did receive something new, so refunding the whole charge would be wrong.`
      : `Nothing new was granted. They paid again for what they already had.`,
    ``,
    `No refund has been issued. Decide in Stripe.`,
    `Checkout session: ${input.sessionId}`,
  ].join("\n")

  return { subject, text }
}
