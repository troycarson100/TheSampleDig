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
  /** Links the whole card out. Profile URL when there's no comment permalink. */
  url?: string
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
    url: "https://www.instagram.com/mikeartuso/",
    likes: 1,
  },
  {
    name: "@bwanonymous",
    quote: "Buy this plugin. It will open up loads of new possibilities to your sound!",
    url: "https://www.instagram.com/bwanonymous/",
    likes: 2,
  },
  {
    name: "@spookey642",
    quote: "this is perfect for IDM",
    url: "https://www.instagram.com/spookey642/",
    likes: 1,
  },
  {
    name: "@balmoral_court_",
    quote: "Absolutely awesome 🔥🔥🔥 would love to use this in Studio One 7 for a project (or many... 😗)",
    url: "https://www.instagram.com/balmoral_court_/",
    likes: 1,
  },
  {
    name: "@atlasmaison",
    quote: "🔥🔥🔥",
    url: "https://www.instagram.com/atlasmaison/",
    likes: 1,
  },
]

/* Empty until the source files land. The carousel returns null on an empty
   array, so the section is simply absent rather than broken — which is why
   this can ship before the videos exist. */
export const REELS: Reel[] = []
