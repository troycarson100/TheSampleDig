"use client"

import { useEffect, useState } from "react"
import PluginGlyph from "./PluginGlyph"
import BuyButton from "./BuyButton"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import type { Capability, FaqItem, FeatureBlock, Media, PluginContent } from "./types"
import styles from "./plugin-page.module.css"

/**
 * Video where we have one, still otherwise, nothing if the asset is absent.
 *
 * Starts assuming reduced motion and only switches a video on to autoplay once
 * `prefers-reduced-motion` is confirmed *not* "reduce" — the same shape as the
 * ownership guard in BuyButton: never render the state you have to walk back,
 * even for one frame. CSS can't stop a video autoplaying, so this has to be JS.
 */
export function MediaSlot({ media, className = "" }: { media?: Media; className?: string }) {
  const [motionOk, setMotionOk] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setMotionOk(!mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  if (!media) return null

  if (media.kind === "video") {
    if (motionOk) {
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
    // Reduced motion (or not yet confirmed otherwise): freeze on the poster.
    // `poster` is optional on Media — a video with nothing to freeze on falls
    // back to the video itself, paused and with controls, rather than showing
    // nothing: the visitor can still choose to play it.
    if (media.poster) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img className={`${styles.media} ${className}`} src={media.poster} alt={media.alt} />
    }
    return (
      <video
        className={`${styles.media} ${className}`}
        src={media.src}
        controls
        playsInline
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
          <span className={styles.heroMeta}>{hero.caption ?? "One-time purchase · free updates"}</span>
        </div>
      </div>
      <MediaSlot media={hero.media} className={styles.heroMedia} />
    </section>
  )
}

export function Intro({ intro }: { intro: PluginContent["intro"] }) {
  return (
    <section className={styles.intro}>
      {intro.eyebrow ? <p className={styles.eyebrow}>{intro.eyebrow}</p> : null}
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
            {c.icon ? <div className={styles.capIcon}>{c.icon}</div> : null}
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
