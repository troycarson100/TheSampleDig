import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import DrftLanding from "./DrftLanding"
import styles from "./drft.module.css"

export const metadata: Metadata = {
  title: "drft — VHS / CRT Circuit-Bend FX Plugin | Sample Roll",
  description:
    "drft is a VHS / CRT circuit-bend effect. Six character knobs — burn, drift, bend, dropout, wash, noise — run your sound through a dying tape machine while a CRT plays your video, a GIF, your live camera or twenty built-in generators through the same damage. Press REC and export what you see and hear as a real MP4 in 16:9, 9:16 or ultrawide. VST3 / AU / Standalone for macOS & Windows.",
  openGraph: {
    title: "drft — VHS / CRT Circuit-Bend FX",
    description:
      "Your sound through a dying tape machine, your picture on a CRT wired to the same damage. VST3 / AU / Standalone for macOS & Windows.",
    images: ["/drft/og.png"],
    type: "website",
  },
  alternates: { canonical: "/drft" },
}

export default function DrftPage() {
  return (
    <div className={styles.page}>
      <header className="site-header w-full shrink-0">
        <SiteNav />
      </header>
      <DrftLanding />
    </div>
  )
}
