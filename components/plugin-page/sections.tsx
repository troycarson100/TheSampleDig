import PluginGlyph from "./PluginGlyph"
import BuyButton from "./BuyButton"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import type { Capability, FaqItem, FeatureBlock, Media, PluginContent } from "./types"
import styles from "./plugin-page.module.css"

/** Video where we have one, still otherwise, nothing if the asset is absent. */
export function MediaSlot({ media, className = "" }: { media?: Media; className?: string }) {
  if (!media) return null
  if (media.kind === "video") {
    return (
      <video
        className={`${styles.media} ${className}`}
        src={media.src}
        poster={media.poster}
        autoPlay muted loop playsInline
        aria-label={media.alt}
      />
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`${styles.media} ${className}`} src={media.src} alt={media.alt} />
}

export function Hero({ id, hero }: { id: PluginId; hero: PluginContent["hero"] }) {
  const p = PLUGINS[id]
  return (
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>
          <PluginGlyph id={id} animate />
          <span className={styles.badge}>{hero.badge}</span>
          <span className={styles.category}>{p.category}</span>
        </p>
        <h1 className={styles.name}>{p.name}</h1>
        <p className={styles.heroDesc}>{hero.description}</p>
        <div className={styles.heroCta}>
          <BuyButton id={id} />
          <span className={styles.heroMeta}>One-time purchase · free updates</span>
        </div>
      </div>
      <MediaSlot media={hero.media} className={styles.heroMedia} />
    </section>
  )
}

export function Intro({ intro }: { intro: PluginContent["intro"] }) {
  return (
    <section className={styles.intro}>
      <h2 className={styles.introTitle}>{intro.title}</h2>
      <p className={styles.introBody}>{intro.body}</p>
      <MediaSlot media={intro.media} />
    </section>
  )
}

export function Blocks({ blocks }: { blocks: FeatureBlock[] }) {
  return (
    <div className={styles.blocks}>
      {blocks.map((b, i) => (
        <section key={b.title} className={`${styles.block} ${i % 2 === 1 ? styles.blockAlt : ""}`}>
          <div className={styles.blockCopy}>
            <h2 className={styles.blockTitle}>{b.title}</h2>
            <p className={styles.blockBody}>{b.body}</p>
          </div>
          <MediaSlot media={b.media} className={styles.blockMedia} />
        </section>
      ))}
    </div>
  )
}

export function Caps({ caps }: { caps: { title: string; items: Capability[] } }) {
  return (
    <section className={styles.caps}>
      <h2 className={styles.capsTitle}>{caps.title}</h2>
      <ul className={styles.capsGrid}>
        {caps.items.map((c) => (
          <li key={c.title} className={styles.cap}>
            <h3 className={styles.capTitle}>{c.title}</h3>
            <p className={styles.capBody}>{c.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Faq({ faq }: { faq: FaqItem[] }) {
  return (
    <section className={styles.faq}>
      <h2 className={styles.faqTitle}>Questions</h2>
      <dl className={styles.faqList}>
        {faq.map((f) => (
          <div key={f.q} className={styles.faqItem}>
            <dt className={styles.faqQ}>{f.q}</dt>
            <dd className={styles.faqA}>{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function Buy({ id, buy }: { id: PluginId; buy: PluginContent["buy"] }) {
  return (
    <section className={styles.getStarted} id={`${id}-buy`}>
      <h2 className={styles.gsTitle}>{buy.title}</h2>
      <p className={styles.gsBody}>{buy.body}</p>
      <BuyButton id={id} />
    </section>
  )
}
