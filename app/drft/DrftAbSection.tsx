"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import styles from "./drft.module.css"
import peaksData from "./ab-peaks.json"

type AbExample = {
  slug: string
  label: string
  duration: number
  peaks: { off: number[]; on: number[] }
}

const EXAMPLES = peaksData.examples as AbExample[]

const VIEW_W = 1000
const VIEW_H = 200

/** How far the muted player may slip from the audible one before it gets
    yanked back. 50ms is under the threshold where a mid-loop A/B flip would
    land on a different transient. */
const DRIFT_TOLERANCE = 0.05

/** One trace, grown from the centre line in a single direction: -1 draws the
    bypassed half upward, +1 draws the drft'd half downward.

    The two are split rather than overlaid on purpose. Overlaying them reads
    fine on a sparse guitar take and turns to mud on a dense full mix, which
    is exactly the clip most people will play first. Split, the difference in
    shape is legible on any material. Peaks arrive 0-255 from
    scripts/build-drft-ab-peaks.mjs. */
function halfPath(peaks: number[], dir: -1 | 1): string {
  const mid = VIEW_H / 2
  const amp = mid * 0.9
  const n = peaks.length
  let d = `M0 ${mid}`
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * VIEW_W).toFixed(1)
    const y = mid + dir * (peaks[i] / 255) * amp
    d += `L${x} ${y.toFixed(1)}`
  }
  return `${d}L${VIEW_W} ${mid}Z`
}

/** Both traces for every example, built once at module load rather than per
    render - the geometry never changes. */
const PATHS = EXAMPLES.map((e) => ({
  off: halfPath(e.peaks.off, -1),
  on: halfPath(e.peaks.on, 1),
}))

/** The engaged half, drawn as three offset copies in the wordmark's own
    orange -> coral -> pink ramp. Screened together they fringe the way chroma
    bleeds off a worn tape, and the overlap blows out toward white. The clean
    half deliberately gets none of this - that contrast is the whole section. */
function ChromaHalf({ d }: { d: string }) {
  return (
    <>
      <path d={d} transform="translate(-2.5 0)" className={styles.abChromaA} />
      <path d={d} transform="translate(2.5 0)" className={styles.abChromaB} />
      <path d={d} className={styles.abChromaCore} />
    </>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function DrftAbSection() {
  const uid = useId().replace(/:/g, "")
  const offRef = useRef<HTMLAudioElement>(null)
  const onRef = useRef<HTMLAudioElement>(null)
  const scopeRef = useRef<SVGSVGElement>(null)

  const [index, setIndex] = useState(0)
  const [wet, setWet] = useState(true)
  const [playing, setPlaying] = useState(false)
  /** Between the click and the first sample. The pair is only fetched on
      intent, so the first press can sit on a ~1MB download with nothing to
      show for it unless the key says so. */
  const [pending, setPending] = useState(false)
  const [progress, setProgress] = useState(0)
  /** The clips stay unrequested until the visitor shows intent - this section
      sits directly under the hero and must not compete with it for bandwidth. */
  const [armed, setArmed] = useState(false)

  const example = EXAMPLES[index]
  const duration = example.duration

  const arm = useCallback(() => setArmed(true), [])

  // Audibility is a mute flip, never a pause/seek: both files run in lockstep
  // the whole time, so switching lands on the same instant of the same bar.
  useEffect(() => {
    const off = offRef.current
    const on = onRef.current
    if (!off || !on) return
    off.muted = wet
    on.muted = !wet
  }, [wet, index])

  // Switching examples swaps both <audio> sources. Playback carries over so
  // the visitor can walk the chips without re-pressing play each time.
  useEffect(() => {
    setProgress(0)
    if (!playing) return
    const off = offRef.current
    const on = onRef.current
    void off?.play().catch(() => {})
    void on?.play().catch(() => {})
    // `playing` is deliberately not a dependency - this fires on example change
    // only, and reading the latest value inside is exactly what's wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // Progress, drift correction and looping all ride one rAF while playing.
  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      const lead = wet ? onRef.current : offRef.current
      const follow = wet ? offRef.current : onRef.current
      if (lead) {
        // Loop at the pair's clamped duration, not each file's own length -
        // a mismatched pair (Track 2's ON is ~149ms short) would otherwise
        // wrap at two different moments and walk apart.
        if (lead.currentTime >= duration) {
          lead.currentTime = 0
          if (follow) follow.currentTime = 0
        }
        setProgress(Math.min(1, lead.currentTime / duration))
        if (follow && Math.abs(follow.currentTime - lead.currentTime) > DRIFT_TOLERANCE) {
          follow.currentTime = lead.currentTime
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, wet, duration])

  const togglePlay = useCallback(async () => {
    setArmed(true)
    const off = offRef.current
    const on = onRef.current
    if (!off || !on) return
    if (playing) {
      off.pause()
      on.pause()
      setPlaying(false)
      return
    }
    off.muted = wet
    on.muted = !wet
    setPending(true)
    try {
      await Promise.all([off.play(), on.play()])
      setPlaying(true)
    } catch {
      setPlaying(false)
    } finally {
      setPending(false)
    }
  }, [playing, wet])

  const seekToRatio = useCallback(
    (ratio: number) => {
      const t = Math.max(0, Math.min(duration - 0.01, ratio * duration))
      if (offRef.current) offRef.current.currentTime = t
      if (onRef.current) onRef.current.currentTime = t
      setProgress(t / duration)
    },
    [duration]
  )

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = scopeRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      seekToRatio(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)))
    },
    [seekToRatio]
  )

  const onScopePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    arm()
    e.currentTarget.setPointerCapture(e.pointerId)
    seekFromClientX(e.clientX)
  }
  const onScopePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromClientX(e.clientX)
  }
  const onScopeKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02
    if (e.key === "ArrowRight") {
      e.preventDefault()
      seekToRatio(progress + step)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      seekToRatio(progress - step)
    } else if (e.key === "Home") {
      e.preventDefault()
      seekToRatio(0)
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      void togglePlay()
    }
  }

  const paths = PATHS[index]
  const playheadX = progress * VIEW_W
  const preload = armed ? "auto" : "none"

  return (
    <section className={styles.ab} id="drft-ab" aria-labelledby={`${uid}-title`}>
      <div className={styles.abHead}>
        <h2 className={styles.abTitle} id={`${uid}-title`}>
          Hear it in action
        </h2>
      </div>

      <div className={styles.abUnit} onPointerEnter={arm} onFocus={arm}>
        {/* The scope: both traces stacked, the audible one lit, the other a ghost. */}
        <div className={styles.abScope}>
          <svg
            ref={scopeRef}
            className={styles.abScopeSvg}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            role="slider"
            tabIndex={0}
            aria-label={`${example.label} playback position`}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(progress * duration)}
            aria-valuetext={`${formatTime(progress * duration)} of ${formatTime(duration)}`}
            onPointerDown={onScopePointerDown}
            onPointerMove={onScopePointerMove}
            onKeyDown={onScopeKeyDown}
          >
            <defs>
              <clipPath id={`${uid}-played`}>
                <rect x="0" y="0" width={Math.max(0, playheadX)} height={VIEW_H} />
              </clipPath>
              {/* Bloom, applied to the engaged half only - the clean signal
                  never glows. */}
              <filter id={`${uid}-bloom`} x="-4%" y="-25%" width="108%" height="150%">
                <feGaussianBlur stdDeviation="2" result="glow" />
                {/* Held well back - an unattenuated merge hazes the whole half
                    to pale pink and the waveform stops being readable. */}
                <feComponentTransfer in="glow" result="softGlow">
                  <feFuncA type="linear" slope="0.5" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="softGlow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Opaque base so the chroma layers have something to screen against. */}
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} className={styles.abScopeBg} />

            {/* Both halves stay on screen the whole time - the one you are not
                hearing is what the one you are hearing is being judged against. */}
            <path d={paths.off} className={wet ? styles.abDryIdle : styles.abDryLit} />
            {!wet ? (
              <path
                d={paths.off}
                className={styles.abDryPlayed}
                clipPath={`url(#${uid}-played)`}
              />
            ) : null}

            <g className={wet ? styles.abWetLit : styles.abWetIdle}>
              <ChromaHalf d={paths.on} />
            </g>
            {wet ? (
              <g clipPath={`url(#${uid}-played)`} filter={`url(#${uid}-bloom)`}>
                <ChromaHalf d={paths.on} />
              </g>
            ) : null}

            <line
              x1={0}
              y1={VIEW_H / 2}
              x2={VIEW_W}
              y2={VIEW_H / 2}
              className={styles.abCentre}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={playheadX}
              y1={0}
              x2={playheadX}
              y2={VIEW_H}
              className={styles.abPlayhead}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {/* Labels live in HTML, not SVG: the scope stretches to the container
              with preserveAspectRatio="none", which would smear <text>. */}
          <span
            className={`${styles.abScopeTag} ${styles.abScopeTagTop} ${!wet ? styles.abScopeTagLitDry : ""}`}
            aria-hidden
          >
            OFF
          </span>
          <span
            className={`${styles.abScopeTag} ${styles.abScopeTagBottom} ${wet ? styles.abScopeTagLitWet : ""}`}
            aria-hidden
          >
            ON
          </span>
          <div className={styles.abScanlines} aria-hidden />
        </div>

        <div className={styles.abTransport}>
          <button
            type="button"
            className={styles.abPlay}
            onClick={togglePlay}
            aria-label={playing ? `Pause ${example.label}` : `Play ${example.label}`}
          >
            {pending ? (
              <span className={styles.abSpinner} aria-hidden />
            ) : playing ? (
              <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden>
                <rect x="2" y="1" width="6" height="20" fill="currentColor" />
                <rect x="12" y="1" width="6" height="20" fill="currentColor" />
              </svg>
            ) : (
              <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden>
                <path d="M3 1 L19 11 L3 21 Z" fill="currentColor" />
              </svg>
            )}
          </button>

          <p className={styles.abTime}>
            {formatTime(progress * duration)} <span aria-hidden>/</span> {formatTime(duration)}
          </p>

          <div className={styles.abToggle} role="group" aria-label="Effect bypass">
            <button
              type="button"
              className={`${styles.abToggleBtn} ${!wet ? styles.abToggleOn : ""}`}
              onClick={() => setWet(false)}
              aria-pressed={!wet}
            >
              OFF
            </button>
            <button
              type="button"
              className={`${styles.abToggleBtn} ${wet ? styles.abToggleOn : ""}`}
              onClick={() => setWet(true)}
              aria-pressed={wet}
            >
              ON
            </button>
          </div>
        </div>

        <div className={styles.abChips} role="group" aria-label="Example clip">
          {EXAMPLES.map((e, i) => (
            <button
              key={e.slug}
              type="button"
              className={`${styles.abChip} ${i === index ? styles.abChipOn : ""}`}
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
            >
              {e.label}
            </button>
          ))}
        </div>

        {/* Both halves of the pair run at once; only the muted flag differs. */}
        <audio ref={offRef} src={`/drft/ab/${example.slug}-off.mp3`} preload={preload} loop playsInline />
        <audio ref={onRef} src={`/drft/ab/${example.slug}-on.mp3`} preload={preload} loop playsInline />
      </div>
    </section>
  )
}
