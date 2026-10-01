/* Clips for the reel carousel on /fltr, mirroring app/drft/drft-reels.ts.
   Adding one means dropping an H.264 MP4 (720x1280, +faststart) and a poster
   frame of the same basename into /public/fltr/reels and appending an entry
   here. Named by Instagram shortcode, the rule /shft follows. */

import type { Reel } from "@/components/ReelCarousel"

export const REELS: Reel[] = [
  {
    src: "/fltr/reels/Dd7UhVySifQ.mp4",
    poster: "/fltr/reels/Dd7UhVySifQ.jpg",
    // Sample Roll's own post. The handle reads as the link until the account
    // name is confirmed - see the card's overlay in ReelCarousel.
    handle: "View on Instagram",
    url: "https://www.instagram.com/reel/Dd7UhVySifQ/",
  },
]
