"use client"

import { useEffect, useRef, useState } from "react"
import styles from "./countdown.module.css"

interface Parts { days: number; hours: number; minutes: number; seconds: number }

function partsUntil(endsAt: Date, now: number): Parts {
  const ms = Math.max(0, endsAt.getTime() - now)
  const total = Math.floor(ms / 1000)
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, "0")

export default function Countdown({
  endsAt,
  onExpire,
  className = "",
}: {
  endsAt: Date
  onExpire?: () => void
  className?: string
}) {
  // null until mounted: the server must not render a time, or hydration mismatches.
  const [now, setNow] = useState<number | null>(null)
  const [coarse, setCoarse] = useState(false)
  const expired = useRef(false)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    setCoarse(reduce)

    // Shared by the initial mount-time set below and by `tick` — without
    // this, the mount-time path never checked expiry, so under reduced
    // motion (60s ticks) a viewer arriving after the deadline already
    // passed could sit looking at "00 days / 00 hrs / 00 min" for up to a
    // minute before the first `tick` finally caught it.
    const checkExpiry = (t: number) => {
      if (!expired.current && t >= endsAt.getTime()) {
        expired.current = true
        onExpire?.()
      }
    }

    const initial = Date.now()
    setNow(initial)
    checkExpiry(initial)

    const tick = () => {
      const t = Date.now()
      setNow(t)
      checkExpiry(t)
    }
    // A repainting clock is motion: coarse viewers get minute resolution.
    const id = setInterval(tick, reduce ? 60_000 : 1_000)
    return () => clearInterval(id)
  }, [endsAt, onExpire])

  // Stable placeholder before mount — same box, no time.
  if (now === null) {
    return <div className={`${styles.clock} ${className}`} aria-hidden data-countdown-placeholder />
  }

  const p = partsUntil(endsAt, now)
  const blocks: [number, string][] = coarse
    ? [[p.days, "days"], [p.hours, "hrs"], [p.minutes, "min"]]
    : [[p.days, "days"], [p.hours, "hrs"], [p.minutes, "min"], [p.seconds, "sec"]]

  return (
    <div className={`${styles.clock} ${className}`} data-countdown>
      {blocks.map(([value, label], i) => (
        <div key={label} className={styles.block}>
          <span className={styles.value}>{pad(value)}</span>
          <span className={styles.label}>{label}</span>
          {i < blocks.length - 1 && <span className={styles.sep} aria-hidden>:</span>}
        </div>
      ))}
    </div>
  )
}
