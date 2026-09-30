import type { CompProduct } from "./plugin-products"

export type CancelPath = "/shft" | "/drft" | "/fltr" | "/checkout"

/**
 * Where Stripe sends the buyer afterwards. Success lands on /thanks, which
 * claims the session and shows keys and downloads with no sign-in; cancel
 * returns to the page they left. `paid` rides along for the Purchase pixel.
 * `{CHECKOUT_SESSION_ID}` is a literal Stripe fills in.
 */
/**
 * How a Checkout Session takes a discount: either with a promotion code
 * already applied, or with Stripe's own promo box for the buyer to type one
 * into. Never both — Stripe refuses a session that sets `discounts` and
 * `allow_promotion_codes` together — and never neither, which would take the
 * box away from every buyer who did not enter a code on the site first.
 */
export function sessionDiscount(promotionCodeId: string | null | undefined) {
  return promotionCodeId
    ? { discounts: [{ promotion_code: promotionCodeId }] }
    : { allow_promotion_codes: true as const }
}

export function checkoutUrls(baseUrl: string, product: CompProduct, paid: number, cancelPath: CancelPath) {
  return {
    success_url: `${baseUrl}/thanks?session_id={CHECKOUT_SESSION_ID}&product=${product}&paid=${paid}`,
    cancel_url: `${baseUrl}${cancelPath}?purchase=canceled`,
  }
}
