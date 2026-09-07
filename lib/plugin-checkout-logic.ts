import type { CompProduct } from "./plugin-products"

export type CancelPath = "/shft" | "/drft" | "/plugins"

/**
 * Where Stripe sends the buyer afterwards. Success lands on /thanks, which
 * claims the session and shows keys and downloads with no sign-in; cancel
 * returns to the page they left. `paid` rides along for the Purchase pixel.
 * `{CHECKOUT_SESSION_ID}` is a literal Stripe fills in.
 */
export function checkoutUrls(baseUrl: string, product: CompProduct, paid: number, cancelPath: CancelPath) {
  return {
    success_url: `${baseUrl}/thanks?session_id={CHECKOUT_SESSION_ID}&product=${product}&paid=${paid}`,
    cancel_url: `${baseUrl}${cancelPath}?purchase=canceled`,
  }
}
