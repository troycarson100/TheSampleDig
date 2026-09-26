import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import PluginChrome from "@/components/PluginChrome"
import PluginsStore from "./PluginsStore"
import { PRICING } from "@/lib/products"

export const metadata: Metadata = {
  title: "Plugins — shft, drft & fltr | Sample Roll",
  description:
    `Sample Roll plugins: shft, the tempo-synced trance gate; drft, the VHS / CRT circuit-bend effect; ` +
    `and fltr, a morphing filter that plays in key. All three for $${PRICING.bundle.price}. ` +
    `VST3 / AU / Standalone.`,
  openGraph: {
    title: "Sample Roll Plugins — shft, drft & fltr",
    description: `All three plugins for $${PRICING.bundle.price}.`,
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
      <PluginChrome />
      <PluginsStore />
    </div>
  )
}
