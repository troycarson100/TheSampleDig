"use client"

import { useEffect, useState } from "react"
import PluginLanding from "@/components/plugin-page/PluginLanding"
import ReelCarousel from "@/components/ReelCarousel"
import YouTubeEmbed from "@/components/YouTubeEmbed"
import TestimonialMarquee from "./TestimonialMarquee"
import { SHFT_CONTENT } from "./content"
import { REELS, TESTIMONIALS } from "./shft-social"
import styles from "./shft.module.css"

/* The long-form walkthrough on the Sample Roll YouTube channel. Only the id is
   load-bearing; the title names the player for screen readers, the duration is
   the chip on the poster, and the poster is a 1600x900 JPEG cut from the
   video's thumbnail source, so update all four together when the video is
   replaced. */
const WALKTHROUGH = {
  id: "KdBNYHwnRtI",
  title: "I Made a Glitch Plugin That Turns Any Sound Into a Rhythm",
  duration: "9:36",
  poster: "/shft/walkthrough-poster.jpg",
}

/** Only the canceled state lives here now. Success goes to /thanks, which
    claims the session and shows the key - see app/thanks. */
function PurchaseBanner() {
  const [canceled, setCanceled] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("purchase") === "canceled") setCanceled(true)
  }, [])

  if (!canceled) return null
  return <div className={styles.bannerInfo}>Checkout canceled — no charge was made. Grab shft whenever you&apos;re ready.</div>
}

export default function ShftLanding() {
  return (
    <>
      <PurchaseBanner />

      <PluginLanding
        id="shft"
        content={SHFT_CONTENT}
        afterIntro={
          <>
            <ReelCarousel reels={REELS} />
            <TestimonialMarquee items={TESTIMONIALS} />
            <section className={styles.walkthrough} aria-labelledby="shft-walkthrough-title">
              <div className={styles.walkthroughHead}>
                <p className={styles.eyebrow}>Walkthrough</p>
                <h2 className={styles.walkthroughTitle} id="shft-walkthrough-title">
                  See how it all works
                </h2>
                <p className={styles.walkthroughSub}>
                  A ten-minute tour of shft from the person who built it — lanes and shapes,
                  beat repeat and granular, building a rhythm from a sample, dragging MIDI
                  out, the FX page and the LFOs.
                </p>
              </div>
              <YouTubeEmbed
                className={styles.shotFrame}
                id={WALKTHROUGH.id}
                title={WALKTHROUGH.title}
                duration={WALKTHROUGH.duration}
                poster={WALKTHROUGH.poster}
              />
            </section>
          </>
        }
      />
    </>
  )
}
