/* Clips for the reel carousel on /drft, mirroring app/shft/shft-social.ts.
   Adding one means dropping an H.264 MP4 and a poster frame of the same
   basename into /public/drft/reels and appending an entry here.

   An empty array makes the whole section disappear cleanly rather than
   rendering an empty deck, so this is safe to ship half-built. */

import type { Reel } from "@/components/ReelCarousel"

/* Named by YouTube ID so each file maps unambiguously back to its source,
   the same rule /shft follows with Instagram shortcodes. Don't rename to
   positional names - reordering this array would make the filenames lie. */
export const REELS: Reel[] = [
  {
    src: "/drft/reels/K8_CuGDqh-Y.mp4",
    poster: "/drft/reels/K8_CuGDqh-Y.jpg",
    handle: "@Sample-Roll",
    url: "https://www.youtube.com/shorts/K8_CuGDqh-Y",
  },
]
