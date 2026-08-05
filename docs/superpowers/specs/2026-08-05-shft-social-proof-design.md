# shft landing — social proof (testimonial marquee + reel carousel)

**Date:** 2026-08-05
**Status:** Approved, ready for implementation plan

## Goal

Add two social-proof sections to the shft landing page ([app/shft/ShftLanding.tsx](../../../app/shft/ShftLanding.tsx)):

1. **Feedback** — a horizontally drifting marquee of Instagram/TikTok-style testimonial cards.
2. **Made with shft** — a coverflow carousel of 9:16 Instagram reels with inline playback.

Visual reference: ilgranello.com's "Feedback" marquee and its centered video carousel with blurred side previews.

## Constraints and context

- The page is hand-rolled CSS Modules. No carousel, marquee, or animation library is installed, and none will be added.
- The palette lives as custom properties on `.page` in [app/shft/shft.module.css](../../../app/shft/shft.module.css): `--paper #efe9dc`, `--paper-2 #e7dfce`, `--ink #24211d`, `--ink-2 #46413a`, `--ink-dim`, `--line`, `--accent #9b8b76`, `--accent-deep #7d6f5c`, `--cream #f4efe4`. New components are descendants of `.page` and inherit these; every `var()` carries a literal fallback so the components degrade rather than break if rendered elsewhere.
- The CSP in [next.config.ts](../../../next.config.ts) sets `media-src 'self' https://www.youtube.com` and a `frame-src` without Instagram. Self-hosted MP4s work under the existing policy. **No CSP changes are needed or permitted by this work.**
- `ffmpeg` and `ffprobe` are installed locally (`/opt/homebrew/bin`), used for asset prep only — not at build or run time.
- The repo has no test framework (no playwright config, no spec files). None is introduced here.

## Decisions

| Question | Decision |
| --- | --- |
| Video delivery | Self-hosted MP4s in `/public/shft/reels/`. Not Instagram embeds (would require loosening the CSP, loads Meta JS, unstylable), not the S3/Spaces bucket. |
| Content volume at launch | Thin: under ~6 quotes, 1-3 reels. Both components must look intentional at that size and scale up without a rewrite. |
| Avatars | Real Instagram profile pictures, self-hosted as 96×96 JPEGs. |
| Section placement | Testimonials directly under the hero, before Intro. Reels after the five feature blocks, before Capabilities. |
| Reel playback | Centered card autoplays muted and looping; a control unmutes it. Side cards are static posters. |
| Headlines | Plain, no usage statistics. "Feedback." / "What producers are saying." and "Made with shft." / "Tap a clip to hear it." No numbers are invented. |
| Marquee rows | One row at launch. `rows` prop allows two opposing rows later without a rewrite. |
| Carousel at low N | Adapts to array length rather than padding with duplicates. |

Resulting page order:

```
Hero → Feedback marquee → Intro → 5 feature blocks → Reel carousel → Capabilities → FAQ → Get shft
```

## Architecture

Four new files plus edits to two existing ones:

```
app/shft/shft-social.ts                     # content + types (the file new content goes into)
app/shft/TestimonialMarquee.tsx             # marquee component
app/shft/testimonial-marquee.module.css
app/shft/ReelCarousel.tsx                   # carousel component
app/shft/reel-carousel.module.css
app/shft/ShftLanding.tsx                    # + 2 imports, + 2 JSX placements
```

Component-scoped CSS modules follow the existing [components/shft-promo-dock.module.css](../../../components/shft-promo-dock.module.css) precedent. They are kept separate from `shft.module.css` (already 648 lines) so each file stays focused.

Both components are `"use client"`. `ShftLanding.tsx` is already a client component, so this adds no new boundary.

### Isolation

- `shft-social.ts` has no imports and no behavior — pure data and types. It is the only file that changes when content is added.
- Each component takes its array as a prop, owns its own state, and shares nothing with the other. Either can be dropped into another page.
- `ShftLanding.tsx` gains only import lines and two JSX elements. No logic moves into it.

## Component 1 — content module (`app/shft/shft-social.ts`)

```ts
export type Testimonial = {
  name: string           // display name or handle, e.g. "WOLVS" / "@skome_otoh"
  avatar: string         // "/shft/testimonials/wolvs.jpg"
  quote: string          // no surrounding quote marks — the card adds them
  credit?: string        // small-caps line, e.g. "MULTI-PLATINUM PRODUCER"
  verified?: boolean     // renders the blue check
  platform?: "instagram" | "tiktok"   // corner glyph; default "instagram"
  url?: string           // makes the whole card a link to the post/profile
  likes?: number         // heart + count; omitted entirely when unset
}

export type Reel = {
  src: string            // "/shft/reels/soloinmyroom.mp4"
  poster: string         // "/shft/reels/soloinmyroom.jpg"
  handle?: string        // "@soloinmyroom" overlay, bottom-left
  url?: string           // links the handle overlay to the post
}

export const TESTIMONIALS: Testimonial[] = [ /* strongest name first */ ]
export const REELS: Reel[] = []
```

Every optional field must render cleanly when absent — no reserved empty space, no dangling separators. A card with only `name`, `avatar`, and `quote` is a valid, complete-looking card.

`TESTIMONIALS` is ordered deliberately: the first entry is the first thing a visitor reads after the hero, so the most recognizable name leads.

### Empty-array behavior

Each component returns `null` when handed an empty array, so the page never renders a headline over nothing. This is what allows the sections to be merged before all content has been collected.

## Component 2 — `TestimonialMarquee`

```tsx
<TestimonialMarquee items={TESTIMONIALS} rows={1} />
```

### Structure

```
<section>
  <h2>Feedback.</h2>              // period in --accent, matching the reference
  <p>What producers are saying.</p>
  <div class="viewport">          // overflow hidden + mask-image edge fade
    <div class="track">           // the animated element
      {items}                     // real set
      {items}                     // duplicate, aria-hidden
    </div>
  </div>
</section>
```

### Motion

- The track renders the list exactly twice and animates `translateX(0 → -50%)`, `linear`, `infinite`. Because the second copy is identical and exactly half the track, the wrap is seamless. No JS, no measurement, no resize handling.
- Duration is derived from item count so perceived speed is constant as content grows: `items.length × 9` seconds, passed as an inline `--marquee-dur` custom property. Deliberately slow — this section sits immediately below the autoplaying hero video and must read as a drift, not a slide.
- **Fewer than 3 items (1 or 2):** no animation at all. The track renders once, centered, as a static row. Two cards sliding past on a 1440px screen reads as broken, not as a feed. At 3+ the marquee animates.
- Edge fade uses `mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)` on the viewport, with the `-webkit-` prefix. Cards dissolve at both margins instead of hard-clipping.
- `animation-play-state: paused` on `:hover` and on `:focus-within`, so a card can be read and its link reached by keyboard.

### Card

Cream on cream: `--cream` background, 1px `--line` border, 16px radius, ~22px padding, width `clamp(300px, 34vw, 400px)`, fixed gap between cards.

- 40px circular avatar, `<img>` with explicit `width`/`height` (no layout shift) and `loading="lazy"`.
- Name at 15px/700 `--ink`; blue check inline after it when `verified`.
- `credit` at 11px, uppercase, `letter-spacing: 0.06em`, `--ink-dim`.
- Quote at 15-16px / 1.55 line-height, `--ink-2`, wrapped in typographic quote marks.
- Platform glyph pinned top-right at 40% opacity, 100% on hover.
- `likes` renders as a heart glyph plus the number, below the quote, only when present.
- When `url` is set the card root is an `<a>`; otherwise a `<div>`. The link text is the person's name, not "click here".

The blue verification check is the single non-palette color on the page. It is deliberate: the glyph only communicates because it is that exact blue.

### Two-row mode

`rows={2}` splits `items` into two halves and renders two tracks, the second with `animation-direction: reverse` and a slightly different duration so they never sync up. Not used at launch; the prop exists so the switch is a one-word edit once there are ~10+ quotes.

### Reduced motion

Under `prefers-reduced-motion: reduce`: animation disabled, duplicate set `display: none`, viewport becomes `overflow-x: auto` with `scroll-snap-type: x mandatory` and visible scroll affordance. The content is fully reachable without motion.

## Component 3 — `ReelCarousel`

```tsx
<ReelCarousel reels={REELS} />
```

### Structure

```
<section>
  <h2>Made with shft.</h2>
  <p>Tap a clip to hear it.</p>
  <div class="stage">             // relative, fixed aspect-driven height
    <button class="nav prev">     // circular cream button, --ink chevron
    {reels.map(card)}             // absolutely positioned, transformed by offset
    <button class="nav next">
  </div>
  <div class="dots">              // one button per reel
</section>
```

### Geometry

State is a single `active` index. Each card computes `offset = index - active` and is positioned from it:

- `translateX(offset × 62%)` (tightened on narrow viewports so neighbors only peek)
- `scale(1 − |offset| × 0.14)`
- `filter: blur(|offset| × 2px)`
- opacity falling off with `|offset|`
- `z-index` by proximity, so the active card is on top
- `|offset| > 2` → `opacity: 0; pointer-events: none`

Cards are 9:16, `width: clamp(260px, 30vw, 340px)`, 20px radius, `overflow: hidden`, with a soft drop shadow. Transitions are a single `transform/filter/opacity` ease of ~0.45s.

### Playback

- **Only the active card mounts a `<video>`.** Every other card renders its poster as an `<img>`. Nothing but the visible clip is ever downloaded.
- The active video is `muted loop playsInline preload="metadata"` with its `poster` set, so the frame is filled instantly on mount and the swap between cards has no flash.
- Autoplay is gated on visibility: an IntersectionObserver at `threshold: 0.5` plays the active video when the section is at least half on screen and pauses it when it leaves. This matters because the section sits well below an already-autoplaying hero video.
- A speaker button overlays the active card. Clicking it sets `video.muted = false`. The entire active card is also a tap target for the same toggle, so the gesture is forgiving on mobile.
- Because changing `active` mounts a fresh video element (always muted initially), two clips can never play audio simultaneously. No cross-card mute bookkeeping is needed.
- The `handle` overlay sits bottom-left over a small scrim, linking to `url` when present.

### Navigation

- Clicking a side card makes it active.
- Arrows step by one and are disabled at the ends (no wraparound — with 1-3 reels, looping is disorienting).
- Dots jump directly to an index.
- `ArrowLeft` / `ArrowRight` on the focused stage step the index. Arrows and dots are real `<button>`s with `aria-label`s; the stage carries `aria-roledescription="carousel"` and each card a `aria-label` of the form "Reel 2 of 3".
- Swipe via pointer events: `pointerdown` → `pointerup` horizontal delta beyond 40px steps the index. Vertical-dominant gestures are ignored so page scroll is never captured.

### Adapting to length

| `reels.length` | Rendering |
| --- | --- |
| 0 | Component returns `null` |
| 1 | Single centered card. No arrows, no dots, no swipe. |
| 2-3 | Arrows, dots, swipe. Neighbors peek at reduced scale and blur. |
| 4+ | Identical code; more cards simply fall into the ±2 visible band. |

No duplication or padding of the reel list to fill side slots under any circumstance.

### Reduced motion

Under `prefers-reduced-motion: reduce`: no autoplay (poster plus a visible play button, which starts the video on click), and card transitions become instantaneous rather than eased.

## Asset pipeline

Manual, run per new piece of content. Nothing is added to the build.

**Reels** → `/public/shft/reels/<slug>.mp4` and `<slug>.jpg`

- Re-encode to H.264, max 720×1280, ~1.5-2.5 Mbps, AAC audio, `-movflags +faststart` so playback starts before the file finishes downloading.
- Target 2-4 MB for a 20-30 second reel.
- Poster extracted with `ffmpeg` at a representative frame, saved as a JPEG around 60 KB.

**Avatars** → `/public/shft/testimonials/<slug>.jpg`, 96×96 center-cropped JPEG.

**Weight budget:** three reels is roughly 6-12 MB committed to the repo. Acceptable now and served from Vercel's CDN; revisit hosting if the set grows past ~10 reels.

## Failure and edge cases

| Case | Behavior |
| --- | --- |
| Empty `TESTIMONIALS` or `REELS` | Component returns `null`; no headline over an empty region. |
| Missing avatar file | The `<img>` alt text carries the person's name, so the card stays legible. Avatar presence is verified during asset prep. |
| Video fails to load or decode | The `poster` remains visible; the card reads as a still image rather than a black box. |
| Autoplay blocked by the browser | `play()` is called with a caught rejection; the poster stays up and the play affordance remains. Never an unhandled rejection in the console. |
| 1 or 2 testimonials | Static centered row, no animation (see Motion above). |
| Very long quote | Card height grows; the track is `align-items: stretch` so cards in a row share a height and the baseline stays even. |

## Verification

There is no test framework in this repo and none is being added. Verification is:

1. `npm run lint` — clean.
2. `npm run build` — succeeds.
3. Dev server, `/shft`, real screenshots at desktop (~1440px) and mobile (~390px) widths, confirming: marquee drifts and wraps seamlessly, hover pauses it, edge fades read correctly, carousel centers and blurs neighbors, the active clip autoplays muted and unmutes on click, arrows/dots/swipe all move the index.
4. Degenerate cases exercised by temporarily truncating the arrays: 1 reel, 3 quotes, 0 of each. Confirm each looks intentional rather than broken.
5. `prefers-reduced-motion` emulated in devtools — no marquee animation, no video autoplay, content still fully reachable.

## Explicitly out of scope

- Any CSP modification.
- Instagram/TikTok embed SDKs or oEmbed calls.
- A database table, CMS, or admin UI for testimonials. Content is added by editing `shft-social.ts`.
- Reusing these components on other product pages.
- Introducing a test framework.
- Fabricating usage statistics for the headlines.
