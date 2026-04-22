"use client"

import Script from "next/script"
import { adsenseScriptSrc } from "@/lib/adsense-dig"

type Props = {
  /** When false, the publisher script is not loaded (keeps non-ad routes free of ad tech). */
  active: boolean
}

/**
 * Loads `adsbygoogle.js` only when `active`. Use on `/blog` and `/dig` (non‑Pro) instead of
 * a site-wide tag so thin/splash pages do not trigger AdSense “no publisher content” policy.
 */
export function AdSensePublisherScript({ active }: Props) {
  if (!active) return null
  return (
    <Script
      src={adsenseScriptSrc}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  )
}
