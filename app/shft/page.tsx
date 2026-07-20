import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import ShftLanding from "./ShftLanding"
import styles from "./shft.module.css"

export const metadata: Metadata = {
  title: "shft — Tempo-Synced Trance Gate Plugin | Sample Roll",
  description:
    "shft is a tempo-synced rhythmic gate / trance-gate plugin. A 16-step sequencer chops your audio with a morphable per-step shape, resonant filter and beat-repeat (reverse + granular), plus a built-in FX chain — gated reverb, frequency-shifter echo, OTT multiband, heat — and a lane-based mod matrix. VST3 / AU / Standalone for macOS & Windows.",
  openGraph: {
    title: "shft — Tempo-Synced Trance Gate Plugin",
    description:
      "A 16-step trance-gate that chops your audio into living rhythm. VST3 / AU / Standalone for macOS & Windows.",
    images: ["/shft/sc2.png"],
    type: "website",
  },
  alternates: { canonical: "/shft" },
}

export default function ShftPage() {
  return (
    <div className={styles.page}>
      <header className="site-header w-full shrink-0">
        <SiteNav />
      </header>
      <ShftLanding />
    </div>
  )
}
