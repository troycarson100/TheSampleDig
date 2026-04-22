/** AdSense publisher id — Dig + blog (same property) */
export const ADSENSE_CLIENT_ID = "ca-pub-7744671172843728"

/**
 * Dig ad units + script on `/dig` (non‑Pro). Default on; set `NEXT_PUBLIC_DIG_ADSENSE_ENABLED=false` to disable.
 */
export const DIG_ADSENSE_UNITS_ENABLED = (() => {
  const v = process.env.NEXT_PUBLIC_DIG_ADSENSE_ENABLED
  if (v == null) return true
  return v.toLowerCase() === "true"
})()

/** Leader / bottom horizontal unit (falls back to legacy NEXT_PUBLIC_ADSENSE_DIG_SLOT) */
export const ADSENSE_DIG_FOOTER_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_DIG_FOOTER_SLOT ??
  process.env.NEXT_PUBLIC_ADSENSE_DIG_SLOT ??
  "1005638712"

/** Narrow sidebar unit under My Crate / History tabs — override with NEXT_PUBLIC_ADSENSE_DIG_SIDEBAR_SLOT if needed */
export const ADSENSE_DIG_SIDEBAR_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_DIG_SIDEBAR_SLOT ?? "8886555201"

export const adsenseScriptSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT_ID)}`
