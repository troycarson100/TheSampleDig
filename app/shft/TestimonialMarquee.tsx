"use client"

import type { CSSProperties } from "react"
import type { Testimonial } from "./shft-social"
import styles from "./testimonial-marquee.module.css"

/** Seconds of travel per card. Deliberately slow — this section sits directly
    under the autoplaying hero video and should drift, not slide. */
const SECONDS_PER_CARD = 9

/** Below this many cards a marquee reads as broken rather than as a feed. */
const MIN_FOR_MOTION = 3

/** True when the quote carries no letters or digits — i.e. pure emoji. */
function isEmojiOnly(quote: string): boolean {
  return !/\p{L}|\p{N}/u.test(quote)
}

function VerifiedBadge() {
  return (
    <svg className={styles.verified} viewBox="0 0 24 24" width="15" height="15" role="img" aria-label="Verified account">
      <path
        fill="#3897f0"
        d="M12 1.5l2.6 2.1 3.3-.3.9 3.2 2.7 2-1.5 3 1.5 3-2.7 2-.9 3.2-3.3-.3L12 22.5l-2.6-2.1-3.3.3-.9-3.2-2.7-2 1.5-3-1.5-3 2.7-2 .9-3.2 3.3.3z"
      />
      <path fill="#fff" d="M10.9 15.2l-3-3 1.3-1.3 1.7 1.7 4-4 1.3 1.3z" />
    </svg>
  )
}

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TikTokGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M16.5 2h-2.7v13.2a2.6 2.6 0 1 1-2-2.5V10a5.5 5.5 0 1 0 4.7 5.4V8.9a6.4 6.4 0 0 0 3.7 1.2V7.4a3.7 3.7 0 0 1-3.7-3.7z" />
    </svg>
  )
}

function HeartGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="#e0245e" aria-hidden>
      <path d="M12 21s-7.5-4.7-9.4-9A5.1 5.1 0 0 1 12 6.6 5.1 5.1 0 0 1 21.4 12c-1.9 4.3-9.4 9-9.4 9z" />
    </svg>
  )
}

/** Cards are inert by design — nothing here links out. `dupe` marks the
    duplicated set that makes the loop seamless: hidden from assistive tech and
    removed entirely under reduced motion. */
function Card({ t, dupe }: { t: Testimonial; dupe?: boolean }) {
  const initial = t.name.replace(/^@/, "").charAt(0).toUpperCase()
  const emoji = isEmojiOnly(t.quote)
  const Glyph = t.platform === "tiktok" ? TikTokGlyph : InstagramGlyph
  const className = `${styles.card}${dupe ? ` ${styles.dupeCard}` : ""}`

  return (
    <div className={className} data-testimonial={t.name} aria-hidden={dupe || undefined}>
      <span className={styles.glyph} aria-hidden>
        <Glyph />
      </span>
      <div className={styles.who}>
        {t.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.avatar} src={t.avatar} alt={t.name} width={40} height={40} loading="lazy" />
        ) : (
          <span className={styles.monogram} aria-hidden>
            {initial}
          </span>
        )}
        <span className={styles.ident}>
          <span className={styles.name}>
            {t.name}
            {t.verified ? <VerifiedBadge /> : null}
          </span>
          {t.credit ? <span className={styles.credit}>{t.credit}</span> : null}
        </span>
      </div>
      <p className={emoji ? styles.quoteEmoji : styles.quote}>{emoji ? t.quote : `“${t.quote}”`}</p>
      {typeof t.likes === "number" ? (
        <span className={styles.likes}>
          <HeartGlyph /> {t.likes}
        </span>
      ) : null}
    </div>
  )
}

export default function TestimonialMarquee({ items, rows = 1 }: { items: Testimonial[]; rows?: 1 | 2 }) {
  if (items.length === 0) return null

  const animate = items.length >= MIN_FOR_MOTION
  // Two rows only earn their keep with enough cards to fill both.
  const split = rows === 2 && items.length >= 6
  const lanes = split ? [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))] : [items]

  return (
    <section className={styles.section} aria-labelledby="shft-feedback-title">
      <div className={styles.head}>
        <h2 className={styles.title} id="shft-feedback-title">
          Feedback<span className={styles.period}>.</span>
        </h2>
        <p className={styles.sub}>What producers are saying.</p>
      </div>
      {lanes.map((lane, laneIndex) => (
        <div className={styles.viewport} key={laneIndex}>
          <div
            data-marquee-track
            className={[
              styles.track,
              animate ? styles.trackAnimated : styles.trackStatic,
              laneIndex === 1 ? styles.trackReverse : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ "--marquee-dur": `${lane.length * SECONDS_PER_CARD}s` } as CSSProperties}
          >
            {lane.map((t, i) => (
              <Card key={`real-${i}`} t={t} />
            ))}
            {animate ? lane.map((t, i) => <Card key={`dupe-${i}`} t={t} dupe />) : null}
          </div>
        </div>
      ))}
    </section>
  )
}
