"use client"

import { useEffect, useRef, useState, type SyntheticEvent } from "react"
import styles from "./youtube-embed.module.css"

/* Click-to-load YouTube player. The page renders a static poster (self-hosted,
   or YouTube's own thumbnail) behind a play button, and the real player iframe only mounts
   once the visitor presses play. That keeps YouTube's script — and its
   cookies — off the page for everyone who never watches, which on a landing
   page is most visitors. Same contract as the reel carousel: nothing
   autoplays, nothing loads until asked. */

/** Hosts the player fetches from on first play. Pre-connecting on hover/focus
    takes the DNS + TLS round-trips out of the click-to-play delay. */
const PLAYER_HOSTS = ["https://www.youtube.com", "https://www.google.com"]
let warmed = false
function warmConnections() {
  if (warmed) return
  warmed = true
  for (const href of PLAYER_HOSTS) {
    const link = document.createElement("link")
    link.rel = "preconnect"
    link.href = href
    document.head.appendChild(link)
  }
}

/** Poster fallback chain: a self-hosted poster (if any) → YouTube's 1280x720
    maxresdefault → its 480x360 hqdefault. maxresdefault only exists for
    uploads that had an HD source; hqdefault every video has. */
function onPosterError(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  const id = img.dataset.videoId
  if (!id || img.src.includes("/hqdefault.jpg")) return
  img.src = img.src.includes("/maxresdefault.jpg")
    ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    : `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden>
      <path d="M8 5.2v13.6a.7.7 0 0 0 1.07.6l10.5-6.8a.7.7 0 0 0 0-1.2L9.07 4.6A.7.7 0 0 0 8 5.2z" />
    </svg>
  )
}

export type YouTubeEmbedProps = {
  /** The 11-character id from the watch URL. */
  id: string
  /** Video title: the iframe's accessible name and the play button's label. */
  title: string
  /** Running time shown as a chip on the poster, e.g. "9:36". Omit to hide it. */
  duration?: string
  /** Self-hosted 16:9 poster to show instead of YouTube's thumbnail. Keeps the
      pre-play page free of third-party requests and can be sharper than the
      1280x720 YouTube serves. Falls back to YouTube's if it fails to load. */
  poster?: string
  /** Applied to the outer 16:9 frame so the page can supply radius, border
      and shadow — the frame itself is a bare dark box. */
  className?: string
}

export default function YouTubeEmbed({ id, title, duration, poster, className }: YouTubeEmbedProps) {
  const [playing, setPlaying] = useState(false)
  const playerRef = useRef<HTMLIFrameElement | null>(null)

  // The play button unmounts when the player mounts, which would drop keyboard
  // focus on the body. Hand it to the iframe instead.
  useEffect(() => {
    if (playing) playerRef.current?.focus()
  }, [playing])

  const frame = className ? `${styles.frame} ${className}` : styles.frame
  const label = duration ? `Play video: ${title} (${duration})` : `Play video: ${title}`

  return (
    <div className={frame}>
      {playing ? (
        <iframe
          ref={playerRef}
          className={styles.player}
          src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          className={styles.facade}
          onClick={() => setPlaying(true)}
          onPointerEnter={warmConnections}
          onFocus={warmConnections}
          aria-label={label}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.poster}
            src={poster ?? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`}
            data-video-id={id}
            alt=""
            loading="lazy"
            onError={onPosterError}
          />
          <span className={styles.playBtn} aria-hidden>
            <PlayGlyph />
          </span>
          {duration ? (
            <span className={styles.duration} aria-hidden>
              {duration}
            </span>
          ) : null}
        </button>
      )}
    </div>
  )
}
