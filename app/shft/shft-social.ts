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

/* Reels from @memerymusic, in the order they should appear. Files are named by
   their Instagram shortcode so each one maps unambiguously back to its post —
   don't rename them to positional names, reordering this array would make the
   filenames lie. Encoded 720x1280 H.264 +faststart from the originals.

   Set this to [] and the whole section disappears cleanly rather than
   rendering a heading over nothing. */
export const REELS: Reel[] = [
  {
    src: "/shft/reels/DbEpnypvPSE.mp4",
    poster: "/shft/reels/DbEpnypvPSE.jpg",
    handle: "@memerymusic",
    url: "https://www.instagram.com/p/DbEpnypvPSE/",
  },
  {
    src: "/shft/reels/DbmPd3dK65u.mp4",
    poster: "/shft/reels/DbmPd3dK65u.jpg",
    handle: "@memerymusic",
    url: "https://www.instagram.com/p/DbmPd3dK65u/",
  },
  {
    src: "/shft/reels/Da9mQfKqSwS.mp4",
    poster: "/shft/reels/Da9mQfKqSwS.jpg",
    handle: "@memerymusic",
    url: "https://www.instagram.com/p/Da9mQfKqSwS/",
  },
  {
    src: "/shft/reels/DbTdL6xK5tO.mp4",
    poster: "/shft/reels/DbTdL6xK5tO.jpg",
    handle: "@memerymusic",
    url: "https://www.instagram.com/p/DbTdL6xK5tO/",
  },
  {
    src: "/shft/reels/DbG1Q4cyvzt.mp4",
    poster: "/shft/reels/DbG1Q4cyvzt.jpg",
    handle: "@memerymusic",
    url: "https://www.instagram.com/p/DbG1Q4cyvzt/",
  },
]
