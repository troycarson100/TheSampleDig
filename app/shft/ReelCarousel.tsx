"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react"
import type { Reel } from "./shft-social"
import styles from "./reel-carousel.module.css"

/** Cards further than this from centre are fully transparent and inert. */
const VISIBLE_SPAN = 2
/** Horizontal pointer travel that counts as a swipe. */
const SWIPE_PX = 40

function SpeakerOff() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M17 9l4 6M21 9l-4 6" />
    </svg>
  )
}

function SpeakerOn() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  )
}

export default function ReelCarousel({ reels }: { reels: Reel[] }) {
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)
  const [inView, setInView] = useState(false)
  const [reduced, setReduced] = useState(false)
  const deckRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Don't play until the section is actually on screen — it sits well below a
  // hero video that is already playing.
  useEffect(() => {
    const el = deckRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (inView && !reduced) {
      // Autoplay can still be refused; the poster stays up and the catch keeps
      // it out of the console.
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [inView, reduced, active])

  // React's `muted` attribute doesn't reliably reach the element; set the
  // property directly.
  useEffect(() => {
    const v = videoRef.current
    if (v) v.muted = muted
  }, [muted, active])

  /** The only thing that changes slides. Re-muting lives here rather than in an
      effect keyed on `active`: a new clip must always start silent, and doing
      it in the handler avoids a cascading render on every move. */
  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(reels.length - 1, next))
      if (clamped === active) return
      setActive(clamped)
      setMuted(true)
    },
    [active, reels.length],
  )

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      go(active - 1)
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      go(active + 1)
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: PointerEvent) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    // Ignore vertical-dominant drags so page scrolling is never captured.
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return
    go(active + (dx < 0 ? 1 : -1))
  }

  const toggleSound = () => {
    const v = videoRef.current
    if (v?.paused) v.play().catch(() => {})
    setMuted((m) => !m)
  }

  if (reels.length === 0) return null
  const multi = reels.length > 1

  return (
    <section className={styles.section} aria-labelledby="shft-reels-title">
      <h2 className={styles.title} id="shft-reels-title">
        Made with shft<span className={styles.period}>.</span>
      </h2>
      <p className={styles.sub}>Tap a clip to hear it.</p>

      <div
        className={styles.deck}
        ref={deckRef}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label="Reels made with shft"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {multi ? (
          <button
            type="button"
            className={`${styles.nav} ${styles.navPrev}`}
            onClick={() => go(active - 1)}
            disabled={active === 0}
            aria-label="Previous reel"
          >
            &#8249;
          </button>
        ) : null}

        {reels.map((r, i) => {
          const offset = i - active
          const dist = Math.abs(offset)
          const style = { "--off": offset, "--dist": dist, zIndex: reels.length - dist } as CSSProperties
          const out = dist > VISIBLE_SPAN

          if (offset === 0) {
            return (
              <div
                key={r.src}
                className={`${styles.card} ${styles.cardActive}`}
                style={style}
                aria-label={`Reel ${i + 1} of ${reels.length}`}
              >
                <video
                  ref={videoRef}
                  className={styles.media}
                  src={r.src}
                  poster={r.poster}
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
                <button
                  type="button"
                  className={styles.soundBtn}
                  onClick={toggleSound}
                  aria-label={muted ? "Unmute reel" : "Mute reel"}
                >
                  {muted ? <SpeakerOff /> : <SpeakerOn />}
                </button>
                {r.handle ? (
                  r.url ? (
                    <a className={styles.handle} href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.handle}
                    </a>
                  ) : (
                    <span className={styles.handle}>{r.handle}</span>
                  )
                ) : null}
              </div>
            )
          }

          return (
            <button
              type="button"
              key={r.src}
              className={`${styles.card}${out ? ` ${styles.cardOut}` : ""}`}
              style={style}
              onClick={() => go(i)}
              aria-label={`Show reel ${i + 1} of ${reels.length}`}
              aria-hidden={out || undefined}
              tabIndex={out ? -1 : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.media} src={r.poster} alt="" loading="lazy" />
            </button>
          )
        })}

        {multi ? (
          <button
            type="button"
            className={`${styles.nav} ${styles.navNext}`}
            onClick={() => go(active + 1)}
            disabled={active === reels.length - 1}
            aria-label="Next reel"
          >
            &#8250;
          </button>
        ) : null}
      </div>

      {multi ? (
        <div className={styles.dots}>
          {reels.map((r, i) => (
            <button
              type="button"
              key={r.src}
              className={`${styles.dot}${i === active ? ` ${styles.dotOn}` : ""}`}
              onClick={() => go(i)}
              aria-label={`Go to reel ${i + 1}`}
              aria-current={i === active || undefined}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
