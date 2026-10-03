import YouTubeEmbed from "@/components/YouTubeEmbed"
import styles from "./fltr-walkthrough.module.css"

/* fltr's deep dive on the Sample Roll YouTube channel, as shft has its
   walkthrough. Only the id is load-bearing; the title names the player for
   screen readers, the duration is the chip on the poster, and the poster is a
   1600x900 JPEG cut from the video's thumbnail - update all four together if
   the video is replaced. The member email links the same video
   (VIDEO_EMAIL in lib/video-email-logic.ts). */
const DEEP_DIVE = {
  id: "GLvR3ZmPgws",
  title: "I Made a Filter That Turns Drums Into Chords",
  duration: "6:03",
  poster: "/fltr/walkthrough-poster.jpg",
}

export default function FltrWalkthrough() {
  return (
    <section className={styles.walkthrough} aria-labelledby="fltr-walkthrough-title" data-fltr-walkthrough>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Deep dive</p>
        <h2 className={styles.title} id="fltr-walkthrough-title">
          See it play in key
        </h2>
        <p className={styles.sub}>
          Six minutes of fltr from the person who built it - turning a drum loop into chords,
          and the rest of what it can do.
        </p>
      </div>
      <YouTubeEmbed
        className={styles.frame}
        id={DEEP_DIVE.id}
        title={DEEP_DIVE.title}
        duration={DEEP_DIVE.duration}
        poster={DEEP_DIVE.poster}
      />
    </section>
  )
}
