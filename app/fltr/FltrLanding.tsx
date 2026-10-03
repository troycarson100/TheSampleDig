"use client"

import PluginLanding from "@/components/plugin-page/PluginLanding"
import ReelCarousel from "@/components/ReelCarousel"
import FltrAbSection from "./FltrAbSection"
import FltrWalkthrough from "./FltrWalkthrough"
import { REELS } from "./fltr-reels"
import { FLTR_CONTENT } from "./content"

export default function FltrLanding() {
  // The before-and-after sits straight under the hero: the proof, before any
  // of the claims - the same place drft puts its own. Then the reels, on a
  // light grey band of their own, and the deep-dive video back on the page's
  // dark ground, as shft has its walkthrough.
  return (
    <PluginLanding
      id="fltr"
      content={FLTR_CONTENT}
      afterIntro={
        <>
          <FltrAbSection />
          <ReelCarousel reels={REELS} label="Made with fltr" tone="grey" />
          <FltrWalkthrough />
        </>
      }
    />
  )
}
