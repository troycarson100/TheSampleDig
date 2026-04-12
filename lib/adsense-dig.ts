/** AdSense publisher id — Dig page */
export const ADSENSE_CLIENT_ID = "ca-pub-7744671172843728"

/** Leader / bottom horizontal unit (falls back to legacy NEXT_PUBLIC_ADSENSE_DIG_SLOT) */
export const ADSENSE_DIG_FOOTER_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_DIG_FOOTER_SLOT ??
  process.env.NEXT_PUBLIC_ADSENSE_DIG_SLOT ??
  "1005638712"

/** Narrow sidebar unit under My Crate / History tabs — override with NEXT_PUBLIC_ADSENSE_DIG_SIDEBAR_SLOT if needed */
export const ADSENSE_DIG_SIDEBAR_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_DIG_SIDEBAR_SLOT ?? "8886555201"
