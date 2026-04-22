"use client"

import { useSession } from "next-auth/react"
import { AdSensePublisherScript } from "./AdSensePublisherScript"
import { DIG_ADSENSE_UNITS_ENABLED } from "@/lib/adsense-dig"

/**
 * Loads the publisher script on `/dig` only for signed-in non‑Pro users when Dig ad units
 * are enabled. Pro subscribers get no ad script in the app shell.
 */
export function DigAdSenseScript() {
  const { data: session, status } = useSession()
  const isPro = session?.user?.isPro === true
  const active =
    DIG_ADSENSE_UNITS_ENABLED && status === "authenticated" && session != null && !isPro
  return <AdSensePublisherScript active={active} />
}
