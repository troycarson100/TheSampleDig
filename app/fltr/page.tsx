import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import PluginChrome from "@/components/PluginChrome"
import FltrLanding from "./FltrLanding"
import { PRICING } from "@/lib/products"
import { PLUGINS } from "@/lib/plugins"

export const metadata: Metadata = {
  title: "fltr — Morphing Filter That Plays In Key | Sample Roll",
  description:
    `fltr is a morphing filter with twelve characters over two cores, four drag-routed modulation ` +
    `sources, and a Push layer that tunes it to a scale, feeds it back into itself and freezes it. ` +
    `Chord and Harmony turn what passes through into a chord in your key. $${PRICING.fltr.price}. ` +
    `VST3 / AU / Standalone for macOS.`,
  openGraph: {
    title: "fltr — a filter that plays in key",
    description: "Twelve characters, two cores, and a chord engine that follows your key.",
    images: ["/fltr/hero.png"],
    type: "website",
  },
  alternates: { canonical: "/fltr" },
}

export default function FltrPage() {
  // Unlike shft/drft, fltr has no page-scoped CSS module of its own, so
  // nothing else paints its near-black ground behind/below <main> (which
  // PluginLanding themes via --plugin-ground). Painting it here on the shell
  // itself matches shft's and drft's `.page` wrappers.
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: PLUGINS.fltr.ground, color: PLUGINS.fltr.ink }}
    >
      <header className="site-header w-full shrink-0">
        <SiteNav />
      </header>
      <PluginChrome active="fltr" />
      <FltrLanding />
    </div>
  )
}
