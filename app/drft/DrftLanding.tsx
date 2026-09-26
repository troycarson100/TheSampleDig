"use client"

import { useEffect, useState } from "react"
import PluginLanding from "@/components/plugin-page/PluginLanding"
import DrftAbSection from "./DrftAbSection"
import ReelCarousel from "@/components/ReelCarousel"
import { REELS } from "./drft-reels"
import { DRFT_CONTENT } from "./content"
import styles from "./drft.module.css"

/** Only the canceled state lives here now. Success goes to /thanks, which
    claims the session and shows the key - see app/thanks. */
function PurchaseBanner() {
  const [canceled, setCanceled] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("purchase") === "canceled") setCanceled(true)
  }, [])

  if (!canceled) return null
  return <div className={styles.bannerInfo}>Checkout canceled — no charge was made. Grab drft whenever you&apos;re ready.</div>
}

export default function DrftLanding() {
  return (
    <>
      <PurchaseBanner />

      <PluginLanding
        id="drft"
        content={DRFT_CONTENT}
        afterIntro={
          <>
            {/* ---- A/B compare: the proof, before any of the claims -------- */}
            <DrftAbSection />
            {/* ---- Made with drft: same carousel /shft uses ---------------- */}
            <ReelCarousel reels={REELS} label="Made with drft" />
          </>
        }
      />
    </>
  )
}
