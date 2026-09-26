import { Blocks, Buy, Caps, Faq, Hero, Intro } from "./sections"
import StickyBuy from "./StickyBuy"
import type { PluginContent } from "./types"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import styles from "./plugin-page.module.css"

export default function PluginLanding({ id, content }: { id: PluginId; content: PluginContent }) {
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
      <Blocks blocks={content.blocks} />
      <Caps caps={content.caps} />
      <Faq faq={content.faq} />
      <Buy id={id} buy={content.buy} />
    </main>
  )
}
