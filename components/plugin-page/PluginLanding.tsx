import type { ReactNode } from "react"
import { Blocks, Buy, Caps, Faq, Hero, Intro } from "./sections"
import StickyBuy from "./StickyBuy"
import type { PluginContent } from "./types"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import styles from "./plugin-page.module.css"

export default function PluginLanding({
  id,
  content,
  afterIntro,
}: {
  id: PluginId
  content: PluginContent
  /** Rendered between Intro and Blocks. For content that doesn't fit
      PluginContent's shape — a plugin-specific social-proof or walkthrough
      section, say — and still needs to sit above the fold, ahead of the FAQ
      and buy sections. */
  afterIntro?: ReactNode
}) {
  const p = PLUGINS[id]
  return (
    <main
      className={styles.page}
      data-plugin={id}
      style={{
        ["--plugin-ground" as string]: p.ground,
        ["--plugin-ink" as string]: p.ink,
        ["--plugin-accent" as string]: p.accent,
        ["--plugin-accent-2" as string]: p.accent2,
      }}
    >
      <StickyBuy id={id} />
      <Hero id={id} hero={content.hero} />
      <Intro intro={content.intro} />
      {afterIntro}
      <Blocks blocks={content.blocks} />
      <Caps caps={content.caps} />
      <Faq faq={content.faq} />
      <Buy id={id} buy={content.buy} />
    </main>
  )
}
