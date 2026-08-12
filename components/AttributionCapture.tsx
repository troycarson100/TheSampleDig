"use client"

import { useEffect } from "react"
import { ensureLandingPing } from "@/lib/landing-ping"

/**
 * Fires the first-touch landing ping. Sits alongside AffiliateRefCapture in the
 * root layout and renders nothing.
 *
 * ConsentProvider calls the same deduped function, but this component exists so
 * the landing is still recorded for visitors whose consent is already decided
 * and who therefore never need a region lookup.
 */
export default function AttributionCapture() {
  useEffect(() => {
    ensureLandingPing().catch(() => {})
  }, [])
  return null
}
