/** Set when the 14-day bonus promo modal has been shown (persists for Try Pro copy + checkout). */
export const BONUS_14_OFFER_SEEN_KEY = "sampleroll_bonus14_offer_seen_v1"

export const BONUS_14_OFFER_SEEN_EVENT = "sampleroll:bonus14-offer-seen"

export function readBonus14OfferSeen(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(BONUS_14_OFFER_SEEN_KEY) === "1"
  } catch {
    return false
  }
}

export function writeBonus14OfferSeen(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(BONUS_14_OFFER_SEEN_KEY, "1")
    window.dispatchEvent(new CustomEvent(BONUS_14_OFFER_SEEN_EVENT))
  } catch {
    /* ignore */
  }
}
