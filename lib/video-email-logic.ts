import { PLUGIN_ORDER, type PluginId } from "./plugins"

// The third member email: fltr's deep-dive video, with whichever offers each
// reader still has. The rules, pure - lib/video-email.ts does the I/O and
// lib/video-email-html.ts draws it.
//
// One email, put together per person from two optional parts:
//   - their $10 member code, if they have one and it is unused
//   - the rest of the set for $39, if they own exactly one plugin
// Someone with neither is not written to. Like every send before it, it goes
// only to accounts that still take both kinds of email.

export const VIDEO_EMAIL = {
  /** A row in member_offer_reminders, beside the first reminder's. Claimed
   *  once; the unique slug refuses a second send. */
  slug: "members-fltr-video-2026-10",
  /** The member offer whose codes it carries. */
  offerSlug: "members-10-off-2026-10",
  videoUrl: "https://www.youtube.com/watch?v=GLvR3ZmPgws",
  videoTitle: "I Made a Filter That Turns Drums Into Chords",
  /** When the $39 link stops working: the end of the bundle sale, Pacific. */
  setEndsAt: new Date("2026-10-31T23:59:59-07:00"),
} as const

export type VideoParts = {
  /** Show their member code. Which pitch goes with it follows from `owns`. */
  code: boolean
  /** Show "the other two for $39". */
  set: boolean
}

export type VideoCandidate = {
  emailMarketingOptIn: boolean
  productUpdateOptIn: boolean
  owns: readonly string[]
  /** Their member code, or null if the offer never reached them. */
  code: string | null
  /** Whether Stripe has seen that code used. */
  codeRedeemed: boolean
}

export type VideoExclusion = "opted-out" | "nothing-to-offer"

/** What this person's email holds, or why they get none. */
export function videoParts(c: VideoCandidate): VideoParts | VideoExclusion {
  if (!c.emailMarketingOptIn || !c.productUpdateOptIn) return "opted-out"
  const owned = PLUGIN_ORDER.filter((id) => c.owns.includes(id))
  const code = Boolean(c.code) && !c.codeRedeemed && owned.length < PLUGIN_ORDER.length
  const set = owned.length === 1
  return code || set ? { code, set } : "nothing-to-offer"
}

/** "code+set", "code" or "set": what a send row records, for the admin. */
export function videoVariant(p: VideoParts): string {
  return [p.code && "code", p.set && "set"].filter(Boolean).join("+")
}

export function videoSubject(p: VideoParts): string {
  if (p.set) return "fltr, in depth - and the other two plugins for $39"
  return "fltr, in depth - and your $10 code is still waiting"
}

/** The two plugins someone who owns `owns` would get from the $39 offer. */
export function setMissing(owns: readonly string[]): PluginId[] {
  return PLUGIN_ORDER.filter((id) => !owns.includes(id))
}
