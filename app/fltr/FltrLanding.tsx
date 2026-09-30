"use client"

import PluginLanding from "@/components/plugin-page/PluginLanding"
import FltrAbSection from "./FltrAbSection"
import { FLTR_CONTENT } from "./content"

export default function FltrLanding() {
  // The before-and-after sits straight under the hero: the proof, before any
  // of the claims - the same place drft puts its own.
  return <PluginLanding id="fltr" content={FLTR_CONTENT} afterIntro={<FltrAbSection />} />
}
