import { COMPLETE_SET_PRICE } from "./complete-set-logic"
import { VIDEO_EMAIL, type VideoParts } from "./video-email-logic"

// The fifth member email: the fltr video again, a week on, with a new subject
// and new words, the plugins pictured, and whichever deals each reader still
// has. Who gets what is the third email's rule, unchanged (videoParts in
// video-email-logic.ts): their $10 code if unused, the rest of the set if they
// own exactly one, nothing if neither. lib/video-email-2.ts makes it a
// campaign and lib/video-email-2-html.ts draws it.

export const VIDEO_EMAIL_2 = {
  /** Its own row in member_offer_reminders; the unique slug refuses a second send. */
  slug: "members-fltr-video-2026-10-b",
  offerSlug: VIDEO_EMAIL.offerSlug,
  videoUrl: VIDEO_EMAIL.videoUrl,
  videoTitle: VIDEO_EMAIL.videoTitle,
  setEndsAt: VIDEO_EMAIL.setEndsAt,
} as const

/** New subjects, so a mail app does not thread this under the first send. */
export function videoSubject2(p: VideoParts): string {
  if (p.set) return `Complete your set for $${COMPLETE_SET_PRICE[2]}, and see fltr in action`
  return "Drums in, chords out: watch fltr (your $10 code is inside)"
}
