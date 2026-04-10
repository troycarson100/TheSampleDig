/** AdSense publisher id — Dig page */
export const ADSENSE_CLIENT_ID = "ca-pub-7744671172843728"

/** Leader / bottom horizontal unit (falls back to legacy NEXT_PUBLIC_ADSENSE_DIG_SLOT) */
export const ADSENSE_DIG_FOOTER_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_DIG_FOOTER_SLOT ?? process.env.NEXT_PUBLIC_ADSENSE_DIG_SLOT

/** Narrow sidebar unit under My Crate / History tabs — create a separate Display unit in AdSense */
export const ADSENSE_DIG_SIDEBAR_SLOT = process.env.NEXT_PUBLIC_ADSENSE_DIG_SIDEBAR_SLOT
