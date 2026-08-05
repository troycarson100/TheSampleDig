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

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden>
      <path d="M8 5.2v13.6a.7.7 0 0 0 1.07.6l10.5-6.8a.7.7 0 0 0 0-1.2L9.07 4.6A.7.7 0 0 0 8 5.2z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden>
      <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
    </svg>
  )
}

export default function ReelCarousel({ reels }: { reels: Reel[] }) {
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(false)
  const [playing, setPlaying] = useState(false)
  /** Landscape sources would be cropped brutally by `cover` in a 9:16 frame, so
      they letterbox instead. Real vertical reels always take the `cover` path. */
  const [fit, setFit] = useState<"cover" | "contain">("cover")
  const deckRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  // Nothing autoplays, but audio playing on a section you've scrolled past is
  // still wrong — pause on the way out. No auto-resume; that would be autoplay.
  useEffect(() => {
    const el = deckRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) videoRef.current?.pause()
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // React's `muted` attribute doesn't reliably reach the element; set the
  // property directly.
  useEffect(() => {
    const v = videoRef.current
    if (v) v.muted = muted
  }, [muted, active])

  /* Aspect check can't ride on an onLoadedMetadata prop: media events don't
     bubble, so React binds them straight to the node, and a cached file fires
     the event before that listener exists. Read readyState first, then listen. */
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const apply = () => setFit(v.videoWidth > v.videoHeight ? "contain" : "cover")
    if (v.readyState >= 1) apply()
    v.addEventListener("loadedmetadata", apply)
    return () => v.removeEventListener("loadedmetadata", apply)
  }, [active])

  /** The only thing that changes slides. Resetting playback state lives here
      rather than in an effect keyed on `active`: react-hooks flags that as a
      cascading render, and a new clip must always start from a clean stop. */
  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(reels.length - 1, next))
      if (clamped === active) return
      setActive(clamped)
      setPlaying(false)
      setFit("cover")
    },
    [active, reels.length],
  )

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    // `playing` is driven by the element's own play/pause events, so it can
    // never disagree with what the video is actually doing.
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

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

  const toggleSound = () => setMuted((m) => !m)

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
                  style={{ objectFit: fit }}
                  src={r.src}
                  poster={r.poster}
                  loop
                  playsInline
                  preload="metadata"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
                <button
                  type="button"
                  className={`${styles.playBtn}${playing ? ` ${styles.playBtnQuiet}` : ""}`}
                  onClick={togglePlay}
                  aria-label={playing ? "Pause reel" : "Play reel"}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
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
