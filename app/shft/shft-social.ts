/* Content for the two social-proof sections on /shft — the testimonial
   marquee under the hero and the reel carousel after the feature blocks.
   Adding a quote or a video means editing this file and dropping assets into
   /public/shft/testimonials or /public/shft/reels. Nothing else changes. */

export type Testimonial = {
  /** Display name or handle exactly as it should read on the card. */
  name: string
  /** Comment text without surrounding quote marks — the card adds them. */
  quote: string
  /** 96x96 JPEG under /shft/testimonials. Renders a monogram when unset. */
  avatar?: string
  /** Small-caps line under the name, e.g. "MULTI-PLATINUM PRODUCER". */
  credit?: string
  verified?: boolean
  /** Corner glyph. Defaults to Instagram. */
  platform?: "instagram" | "tiktok"
  likes?: number
}

export type Reel = {
  /** H.264 MP4 under /shft/reels — 720x1280, +faststart. */
  src: string
  /** Poster frame beside the mp4, same basename. */
  poster: string
  /** "@handle" overlaid bottom-left on the playing card. */
  handle?: string
  /** Instagram permalink behind the handle overlay. */
  url?: string
}

/* Order is deliberate. Card 1 is the first thing read after the hero, so the
   verified account leads and the strongest wording follows it.
   @mikeartuso and @balmoral_court_ are the same person — his bio lists
   @balmoral_court_ as his music project. Keep at least two cards between them
   so they never share the screen. */
export const TESTIMONIALS: Testimonial[] = [
  {
    name: "@mikeartuso",
    quote: "This is so sick 🔥🔥🔥",
    verified: true,
    likes: 1,
  },
  {
    name: "@bwanonymous",
    quote: "Buy this plugin. It will open up loads of new possibilities to your sound!",
    likes: 2,
  },
  {
    name: "@spookey642",
    quote: "this is perfect for IDM",
    likes: 1,
  },
  {
    name: "@balmoral_court_",
    quote: "Absolutely awesome 🔥🔥🔥 would love to use this in Studio One 7 for a project (or many... 😗)",
    likes: 1,
  },
  {
    name: "@atlasmaison",
    quote: "🔥🔥🔥",
    likes: 1,
  },
]

/* ⚠️ PLACEHOLDERS — swap these for the real Instagram reels before launch.
   These are existing UI screen recordings, not reels. They are 16:9 forced
   into a 9:16 frame, so object-fit crops them hard — the real vertical clips
   will fill the card properly. They're here so the section is visible while
   the actual files are being collected.

   To go live: drop the encoded reels into /public/shft/reels and replace this
   array. Set it to [] and the whole section disappears cleanly instead of
   rendering a heading over nothing. */
export const REELS: Reel[] = [
  { src: "/shft/steps-v3.mp4", poster: "/shft/steps-v3-poster.jpg", handle: "@placeholder_1" },
  { src: "/shft/hero-v2.mp4", poster: "/shft/hero-v2-poster.jpg", handle: "@placeholder_2" },
]
