import { COMPLETE_SET_PRICE } from "./complete-set-logic"
import { VIDEO_EMAIL, type VideoParts } from "./video-email-logic"

// The fifth member email: shft's video - the plugin that turns any sound into
// a rhythm - with the plugins pictured and whichever deals each reader still
// has. Who gets what is the third email's rule, unchanged (videoParts in
// video-email-logic.ts): their $10 code if unused, the rest of the set if they
// own exactly one, nothing if neither. lib/video-email-2.ts makes it a
// campaign and lib/video-email-2-html.ts draws it.

export const VIDEO_EMAIL_2 = {
  /** Its own row in member_offer_reminders; the unique slug refuses a second send. */
  slug: "members-shft-video-2026-10",
  offerSlug: VIDEO_EMAIL.offerSlug,
  videoUrl: "https://www.youtube.com/watch?v=KdBNYHwnRtI",
  videoTitle: "I Made a Glitch Plugin That Turns Any Sound Into a Rhythm",
  /** The video's own thumbnail, served by the site, with a play button on it. */
  videoImagePath: "/email/shft-video.jpg",
  setEndsAt: VIDEO_EMAIL.setEndsAt,
} as const

export function videoSubject2(p: VideoParts): string {
  if (p.set) return `Complete your set for $${COMPLETE_SET_PRICE[2]}, and see shft in action`
  return "Watch shft turn any sound into a rhythm ($10 code inside)"
}
