import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import PluginsStore from "./PluginsStore"

export const metadata: Metadata = {
  title: "Plugins — shft & drft | Sample Roll",
  description:
    "Sample Roll plugins: shft, the tempo-synced trance-gate multi-FX, and drft, the VHS / CRT circuit-bend effect. $19 each, or both for $34 for a limited time. VST3 / AU / Standalone for macOS & Windows.",
  openGraph: {
    title: "Sample Roll Plugins — shft & drft",
    description: "shft + drft — $19 each, or both for $34 for a limited time.",
    images: ["/drft/og.png"],
    type: "website",
  },
  alternates: { canonical: "/plugins" },
}

export default function PluginsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="site-header w-full shrink-0">
        <SiteNav />
      </header>
      <PluginsStore />
    </div>
  )
}
