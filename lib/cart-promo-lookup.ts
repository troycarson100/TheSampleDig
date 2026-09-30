import type Stripe from "stripe"
import { offerFromPromotionCode, type PromoOffer } from "./cart-promo"

/**
 * Asks Stripe about a promo code. Null means "not one this checkout can
 * honour" — unknown, expired, used up, or refused by offerFromPromotionCode —
 * and deliberately does not say which.
 *
 * Shared by the two routes that need it: /api/cart/promo, which answers the
 * box on the page, and /api/cart/checkout, which asks again at the moment of
 * sale. The second lookup is the one that counts. What the page was told a
 * minute ago is not trusted, and neither is anything the page sends back about
 * what a code is worth — only the code itself crosses from one to the other.
 *
 * `code` must already be through normalizePromoCode. Stripe matches it without
 * regard to case. `active: true` leaves expired and used-up codes out of the
 * reply altogether. The coupon, and the products it is limited to, are both
 * left out of a promotion code unless asked for, hence `expand`.
 */
export async function lookupPromo(
  stripe: Stripe,
  code: string,
): Promise<{ id: string; offer: PromoOffer } | null> {
  const found = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 1,
    expand: ["data.promotion.coupon.applies_to"],
  })
  const match = found.data[0]
  if (!match) return null
  const offer = offerFromPromotionCode(match)
  return offer ? { id: match.id, offer } : null
}
