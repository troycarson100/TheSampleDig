"use client"

import { useEffect, useState } from "react"
import PluginGlyph from "./PluginGlyph"
import BuyButton from "./BuyButton"
import PluginPanel, { isWidePanel } from "./PluginPanel"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import type { Capability, FaqItem, FeatureBlock, Media, PluginContent } from "./types"
import styles from "./plugin-page.module.css"

/**
 * An intentional empty panel for a media source that failed to load — a
 * missing screenshot, not a decoding glitch. Deliberately *not* the browser's
 * cracked-image glyph plus `alt` rendered as visible body copy (that read as
 * broken, not absent). Colours come from the `--plugin-*` theme variables, so
 * this reads as "on brand, waiting for an asset" on cream shft, warm drft or
 * near-black fltr alike, rather than a hardcoded light- or dark-mode block.
 * `alt` still reaches assistive tech via `aria-label` on the `role="img"`
 * panel; nothing is rendered as visible text.
 */
export function MediaFallback({ alt, className = "" }: { alt: string; className?: string }) {
  return (
    <div className={`${styles.media} ${styles.mediaFallback} ${className}`} role="img" aria-label={alt}>
      <svg width="15%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.4" />
        <path d="M21 15.5l-5.2-5.2-4 4-2.8-2.8L3 17.5" />
      </svg>
    </div>
  )
}

/**
 * Catches a load failure that already happened *before* hydration attached
 * React's `onError` — the browser starts fetching an SSR-rendered `<img src>`
 * or `<video src>` the instant it parses the markup, well before client JS
 * runs, so a fast 404 (as with a locally-missing file) can finish before any
 * listener exists to hear it. `onError` alone catches a failure that happens
 * *after* hydration; this ref callback catches one that already happened by
 * checking the element's own load state the moment it lands in the DOM.
 */
export function checkAlreadyFailed(el: HTMLImageElement | HTMLVideoElement | null, onFail: () => void) {
  if (!el) return
  if (el instanceof HTMLImageElement) {
    if (el.complete && el.naturalWidth === 0 && el.src) onFail()
  } else if (el.error) {
    onFail()
  }
}

/**
 * Video where we have one, still otherwise, nothing if the asset is absent —
 * and the fallback panel above if the asset is *present in content* but the
 * file itself 404s (or otherwise fails to decode).
 *
 * Starts assuming reduced motion and only switches a video on to autoplay once
 * `prefers-reduced-motion` is confirmed *not* "reduce" — the same shape as the
 * ownership guard in BuyButton: never render the state you have to walk back,
 * even for one frame. CSS can't stop a video autoplaying, so this has to be JS.
 */
export function MediaSlot({ media, className = "" }: { media?: Media; className?: string }) {
  const [motionOk, setMotionOk] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setMotionOk(!mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  // A different source deserves a fresh attempt — without this, a slot that
  // already failed once would never show a real asset dropped in later
  // without a full remount. Adjusted directly during render (the React-docs
  // "resetting state when a prop changes" pattern:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // rather than in an effect, so the reset lands in the same render/commit as
  // the new source instead of one render later, and setFailed never runs
  // inside a useEffect body.
  const [prevSrc, setPrevSrc] = useState(media?.src)
  if (media?.src !== prevSrc) {
    setPrevSrc(media?.src)
    setFailed(false)
  }

  if (!media) return null
  if (failed) return <MediaFallback alt={media.alt} className={className} />

  const onError = () => setFailed(true)

  if (media.kind === "video") {
    if (motionOk) {
      return (
        <video
          ref={(el) => checkAlreadyFailed(el, onError)}
          className={`${styles.media} ${className}`}
          src={media.src}
          poster={media.poster}
          autoPlay muted loop playsInline
          aria-label={media.alt}
          onError={onError}
        />
      )
    }
    // Reduced motion (or not yet confirmed otherwise): freeze on the poster.
    // `poster` is optional on Media — a video with nothing to freeze on falls
    // back to the video itself, paused and with controls, rather than showing
    // nothing: the visitor can still choose to play it.
    if (media.poster) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={(el) => checkAlreadyFailed(el, onError)}
          className={`${styles.media} ${className}`}
          src={media.poster}
          alt={media.alt}
          onError={onError}
        />
      )
    }
    return (
      <video
        ref={(el) => checkAlreadyFailed(el, onError)}
        className={`${styles.media} ${className}`}
        src={media.src}
        controls
        playsInline
        aria-label={media.alt}
        onError={onError}
      />
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(el) => checkAlreadyFailed(el, onError)}
      className={`${styles.media} ${className}`}
      src={media.src}
      alt={media.alt}
      onError={onError}
    />
  )
}

export function Hero({ id, hero }: { id: PluginId; hero: PluginContent["hero"] }) {
  const p = PLUGINS[id]
  // A wide panel needs more than half the hero to be legible, so it takes the
  // wider of two unequal columns.
  const wide = hero.panel ? isWidePanel(hero.panel) : false
  return (
    <section className={`${styles.hero} ${hero.panel ? styles.heroPanel : ""} ${wide ? styles.heroWide : ""}`} data-hero-wide={wide ? "" : undefined}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>
          <PluginGlyph id={id} animate />
          <span className={styles.badge}>{hero.badge}</span>
          <span className={styles.category}>{p.category}</span>
        </p>
        <h1 className={styles.name}>{p.name}</h1>
        <p className={styles.heroDesc}>{hero.description}</p>
        {hero.body ? <p className={styles.heroBody}>{hero.body}</p> : null}
        <div className={styles.heroCta}>
          <BuyButton id={id} />
          {/* A still can't show a gate moving. When the panel has taken the
              video's place, this is the way down to it. */}
          {hero.panel && hero.media ? (
            <a className={styles.heroWatch} href={`#${loopId(id)}`} data-hero-watch>
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden>
                <path d="M4 2.5 13 8l-9 5.5Z" />
              </svg>
              Watch it run
            </a>
          ) : null}
          <span className={styles.heroMeta}>{hero.caption ?? "One-time purchase · free updates"}</span>
        </div>
      </div>
      {hero.panel ? (
        <PluginPanel
          panel={hero.panel}
          className={styles.heroPanelFit}
          fallback={<MediaFallback alt={hero.panel.views[0]?.shot.alt ?? ""} className={styles.heroMedia} />}
        />
      ) : (
        <MediaSlot media={hero.media} className={styles.heroMedia} />
      )}
    </section>
  )
}

/** The anchor the hero's "Watch it run" link points at. */
const loopId = (id: PluginId) => `${id}-loop`

/** The hero's clip, in its own section directly under the hero. Only rendered
    when a panel has taken the clip's place in the hero itself. */
export function Loop({ id, media }: { id: PluginId; media: Media }) {
  return (
    <section className={styles.loop} id={loopId(id)} data-hero-loop>
      <MediaSlot media={media} className={styles.loopMedia} />
    </section>
  )
}

export function Intro({ intro }: { intro: NonNullable<PluginContent["intro"]> }) {
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
        <section
          key={b.title}
          className={`${styles.block} ${i % 2 === 1 ? styles.blockAlt : ""} ${!b.media ? styles.blockNoMedia : ""}`}
        >
          <div className={styles.blockCopy}>
            {b.osdTag ? <p className={styles.blockOsd} aria-hidden>{b.osdTag}</p> : null}
            <h2 className={styles.blockTitle}>{b.title}</h2>
            <p className={styles.blockBody}>{b.body}</p>
            {b.more ? (
              <details className={styles.blockMore}>
                <summary>Full details</summary>
                <p>{b.more}</p>
              </details>
            ) : null}
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
