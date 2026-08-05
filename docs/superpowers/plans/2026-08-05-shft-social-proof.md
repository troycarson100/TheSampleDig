# shft Social Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two social-proof sections to the shft landing page — an Instagram-style testimonial marquee under the hero, and a coverflow carousel of self-hosted 9:16 reels after the feature blocks.

**Architecture:** One content module (`shft-social.ts`) holding typed data and nothing else, plus two self-contained client components that each take their array as a prop and own their own state. `ShftLanding.tsx` gains two imports and two JSX elements — no logic moves into it. Both components return `null` on an empty array, so the reel carousel can be built, reviewed and merged before any video files exist.

**Tech Stack:** Next.js 16 App Router, React 19, CSS Modules. No new dependencies. Playwright 1.58 (already installed, used as a library) drives the verification script.

**Spec:** [docs/superpowers/specs/2026-08-05-shft-social-proof-design.md](../specs/2026-08-05-shft-social-proof-design.md)

## Verification approach — read this before Task 1

This plan deliberately does **not** use the write-failing-test-first cycle. Two reasons, both specific to this work:

1. **There is no test runner in this repo.** No `@playwright/test`, no jest, no vitest, no spec files, no test script in `package.json`. The spec explicitly places "introducing a test framework" out of scope.
2. **The deliverables are presentational.** Their behavior *is* a CSS keyframe, a set of transforms driven by custom properties, and the browser's autoplay policy. A jsdom unit test asserting `expect(card).toHaveClass('card')` would pass without proving the marquee wraps seamlessly or that the video actually plays — it would assert that the code says what the code says.

Instead: **every task ends with named, concrete browser checks a reviewer can repeat**, and Task 4 builds a Playwright script that automates them — including the degenerate cases (1 reel, 3 quotes, 0 of each) that are tedious to check by hand. That script is real verification: it drives the actual page in a real browser and fails loudly.

Where a step *can* be checked mechanically (types compile, lint passes, build succeeds, a regex behaves), it is.

## Global Constraints

- **No new npm dependencies.** No carousel, marquee, or animation library. Everything is hand-rolled CSS Modules matching the existing page.
- **No CSP changes.** [next.config.ts](../../../next.config.ts) sets `media-src 'self' https://www.youtube.com`. Self-hosted MP4s work as-is. Any change to `next.config.ts` means the approach went wrong.
- **Palette via custom properties only.** `--paper`, `--paper-2`, `--ink`, `--ink-2`, `--ink-dim`, `--line`, `--accent`, `--accent-deep`, `--cream` are inherited from `.page` in [app/shft/shft.module.css](../../../app/shft/shft.module.css). Every `var()` carries a literal fallback. Never hardcode a palette colour without a `var()` wrapping it. The two exceptions, both deliberate: the verification check's Instagram blue `#3897f0` and the like heart's `#e0245e` — these only communicate *because* they are those exact colours.
- **Copy is fixed.** "Feedback." / "What producers are saying." and "Made with shft." / "Tap a clip to hear it." No usage statistics, no invented numbers, anywhere.
- **Both components are `"use client"`.** `ShftLanding.tsx` is already a client component; this adds no new boundary.
- **Component CSS lives in its own module**, following the [components/shft-promo-dock.module.css](../../../components/shft-promo-dock.module.css) precedent. Do not add to `shft.module.css` (already 648 lines).
- **Testimonial order is load-bearing.** `@mikeartuso` and `@balmoral_court_` are the same person. Keep at least two cards between them. Never reorder without re-checking this.
- **Run commands from the repo root**, which contains a space in its path (`Cursor Projects`). Quote paths.

---

### Task 1: Content module

**Files:**
- Create: `app/shft/shft-social.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export type Testimonial = { name: string; quote: string; avatar?: string; credit?: string; verified?: boolean; platform?: "instagram" | "tiktok"; url?: string; likes?: number }`
  - `export type Reel = { src: string; poster: string; handle?: string; url?: string }`
  - `export const TESTIMONIALS: Testimonial[]` — 5 entries
  - `export const REELS: Reel[]` — empty at launch

Note on avatars: **every testimonial ships with `avatar` unset**, so all five render monograms. The image files do not exist yet, and referencing paths that 404 would mean every commit until the assets land renders broken images. Task 5 adds the paths as the files arrive. Monogram-only is a designed state, not a broken one.

- [ ] **Step 1: Create the content module**

```ts
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

/* Empty until the source files land — see Task 5. The carousel returns null on
   an empty array, so the section is simply absent rather than broken. */
export const REELS: Reel[] = []
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "shft-social" || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add app/shft/shft-social.ts
git commit -m "feat(shft): add social proof content module"
```

---

### Task 2: Testimonial marquee

**Files:**
- Create: `app/shft/testimonial-marquee.module.css`
- Create: `app/shft/TestimonialMarquee.tsx`
- Modify: `app/shft/ShftLanding.tsx` (imports near line 5; JSX after the hero sentinel, currently line 310)

**Interfaces:**
- Consumes: `Testimonial`, `TESTIMONIALS` from `./shft-social` (Task 1).
- Produces: `export default function TestimonialMarquee({ items, rows }: { items: Testimonial[]; rows?: 1 | 2 })`. Default export, `rows` defaults to `1`.

**The seamless-wrap constraint — do not use `gap` on the track.** The marquee renders the list twice and animates to `translateX(-50%)`. With `gap`, a track of 2N cards is `2N` cards plus `2N-1` gaps, so `-50%` lands half a gap off and the loop visibly jumps every cycle. Spacing therefore comes from `margin-right` on every card *including the last*, making the track exactly `2N × (card + margin)` and `-50%` exactly one full set.

- [ ] **Step 1: Create the stylesheet**

```css
/* Testimonial marquee for /shft — Instagram-style comment cards drifting
   under the hero. Palette comes from .page in shft.module.css; every var()
   carries a fallback so the component degrades rather than breaks. */

.section {
  padding: clamp(44px, 6vw, 76px) 0 clamp(48px, 7vw, 88px);
  overflow: hidden;
}

.head {
  max-width: 1180px;
  margin: 0 auto clamp(26px, 3.5vw, 40px);
  padding: 0 20px;
}
.title {
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  font-weight: 800;
  font-size: clamp(34px, 5.5vw, 60px);
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0 0 8px;
  color: var(--ink, #24211d);
}
.period {
  color: var(--accent, #9b8b76);
}
.sub {
  font-size: clamp(14px, 1.6vw, 17px);
  color: var(--ink-dim, rgba(36, 33, 29, 0.62));
  margin: 0;
}

.viewport {
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
}
.viewport + .viewport {
  margin-top: 18px;
}

.track {
  display: flex;
  align-items: stretch;
  width: max-content;
}
.trackAnimated {
  animation: shftMarquee var(--marquee-dur, 45s) linear infinite;
}
.trackReverse {
  animation-direction: reverse;
}
/* Under 3 cards a marquee reads as broken, so the row sits still and centred. */
.trackStatic {
  width: 100%;
  flex-wrap: wrap;
  justify-content: center;
  gap: 18px;
  padding: 0 20px;
  box-sizing: border-box;
}
.trackStatic .card {
  margin-right: 0;
}

.viewport:hover .trackAnimated,
.viewport:focus-within .trackAnimated {
  animation-play-state: paused;
}

@keyframes shftMarquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* ---- Card ---- */
.card {
  position: relative;
  flex: 0 0 auto;
  box-sizing: border-box;
  width: clamp(300px, 34vw, 400px);
  /* Spacing lives here, not in a track gap — see the wrap constraint. */
  margin-right: 18px;
  display: flex;
  flex-direction: column;
  padding: 20px 22px;
  border-radius: 16px;
  background: var(--cream, #f4efe4);
  border: 1px solid var(--line, rgba(36, 33, 29, 0.14));
  text-align: left;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.18s ease, transform 0.18s ease;
}
a.card:hover {
  border-color: var(--accent, #9b8b76);
  transform: translateY(-2px);
}

.glyph {
  position: absolute;
  top: 16px;
  right: 16px;
  line-height: 0;
  color: var(--ink, #24211d);
  opacity: 0.35;
  transition: opacity 0.18s ease;
}
.card:hover .glyph {
  opacity: 1;
}

.who {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 13px;
  padding-right: 26px;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 auto;
  background: var(--paper-2, #e7dfce);
}
/* Must match .avatar's box exactly so mixed rows stay aligned. */
.monogram {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(155, 139, 118, 0.22);
  color: var(--accent-deep, #7d6f5c);
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  font-weight: 700;
  font-size: 17px;
}
/* Must be a block-level column: the children are spans, so a bare inline box
   would collapse .credit's margin and sit it beside the name. */
.ident {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  font-weight: 700;
  font-size: 15px;
  color: var(--ink, #24211d);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.verified {
  flex: 0 0 auto;
}
.credit {
  display: block;
  margin: 3px 0 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-dim, rgba(36, 33, 29, 0.62));
}

.quote {
  margin: 0;
  font-size: 15.5px;
  line-height: 1.55;
  color: var(--ink-2, #46413a);
}
/* A reaction with no words reads as an empty card when set in quote marks,
   and as a deliberate beat when set large and bare. */
.quoteEmoji {
  margin: 2px 0 0;
  font-size: 34px;
  line-height: 1.2;
  letter-spacing: 0.04em;
}

.likes {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 12px 0 0;
  font-size: 12.5px;
  color: var(--ink-dim, rgba(36, 33, 29, 0.62));
}

@media (prefers-reduced-motion: reduce) {
  .trackAnimated {
    animation: none;
  }
  .dupeCard {
    display: none;
  }
  .viewport {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-mask-image: none;
    mask-image: none;
    padding-bottom: 8px;
  }
  .track {
    padding-inline: 20px;
  }
  .card {
    scroll-snap-align: center;
  }
}
```

- [ ] **Step 2: Create the component**

```tsx
"use client"

import type { CSSProperties } from "react"
import type { Testimonial } from "./shft-social"
import styles from "./testimonial-marquee.module.css"

/** Seconds of travel per card. Deliberately slow — this section sits directly
    under the autoplaying hero video and should drift, not slide. */
const SECONDS_PER_CARD = 9

/** Below this many cards a marquee reads as broken rather than as a feed. */
const MIN_FOR_MOTION = 3

/** True when the quote carries no letters or digits — i.e. pure emoji. */
function isEmojiOnly(quote: string): boolean {
  return !/\p{L}|\p{N}/u.test(quote)
}

function VerifiedBadge() {
  return (
    <svg className={styles.verified} viewBox="0 0 24 24" width="15" height="15" role="img" aria-label="Verified account">
      <path
        fill="#3897f0"
        d="M12 1.5l2.6 2.1 3.3-.3.9 3.2 2.7 2-1.5 3 1.5 3-2.7 2-.9 3.2-3.3-.3L12 22.5l-2.6-2.1-3.3.3-.9-3.2-2.7-2 1.5-3-1.5-3 2.7-2 .9-3.2 3.3.3z"
      />
      <path fill="#fff" d="M10.9 15.2l-3-3 1.3-1.3 1.7 1.7 4-4 1.3 1.3z" />
    </svg>
  )
}

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TikTokGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M16.5 2h-2.7v13.2a2.6 2.6 0 1 1-2-2.5V10a5.5 5.5 0 1 0 4.7 5.4V8.9a6.4 6.4 0 0 0 3.7 1.2V7.4a3.7 3.7 0 0 1-3.7-3.7z" />
    </svg>
  )
}

function HeartGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="#e0245e" aria-hidden>
      <path d="M12 21s-7.5-4.7-9.4-9A5.1 5.1 0 0 1 12 6.6 5.1 5.1 0 0 1 21.4 12c-1.9 4.3-9.4 9-9.4 9z" />
    </svg>
  )
}

/** `dupe` marks the duplicated set that makes the loop seamless: hidden from
    assistive tech, untabbable, and removed entirely under reduced motion. */
function Card({ t, dupe }: { t: Testimonial; dupe?: boolean }) {
  const initial = t.name.replace(/^@/, "").charAt(0).toUpperCase()
  const emoji = isEmojiOnly(t.quote)
  const Glyph = t.platform === "tiktok" ? TikTokGlyph : InstagramGlyph
  const className = `${styles.card}${dupe ? ` ${styles.dupeCard}` : ""}`

  const body = (
    <>
      <span className={styles.glyph} aria-hidden>
        <Glyph />
      </span>
      <div className={styles.who}>
        {t.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.avatar} src={t.avatar} alt={t.name} width={40} height={40} loading="lazy" />
        ) : (
          <span className={styles.monogram} aria-hidden>
            {initial}
          </span>
        )}
        <span className={styles.ident}>
          <span className={styles.name}>
            {t.name}
            {t.verified ? <VerifiedBadge /> : null}
          </span>
          {t.credit ? <span className={styles.credit}>{t.credit}</span> : null}
        </span>
      </div>
      <p className={emoji ? styles.quoteEmoji : styles.quote}>{emoji ? t.quote : `“${t.quote}”`}</p>
      {typeof t.likes === "number" ? (
        <span className={styles.likes}>
          <HeartGlyph /> {t.likes}
        </span>
      ) : null}
    </>
  )

  if (t.url) {
    return (
      <a
        className={className}
        href={t.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-hidden={dupe || undefined}
        tabIndex={dupe ? -1 : undefined}
      >
        {body}
      </a>
    )
  }
  return (
    <div className={className} aria-hidden={dupe || undefined}>
      {body}
    </div>
  )
}

export default function TestimonialMarquee({ items, rows = 1 }: { items: Testimonial[]; rows?: 1 | 2 }) {
  if (items.length === 0) return null

  const animate = items.length >= MIN_FOR_MOTION
  // Two rows only earn their keep with enough cards to fill both.
  const split = rows === 2 && items.length >= 6
  const lanes = split ? [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))] : [items]

  return (
    <section className={styles.section} aria-labelledby="shft-feedback-title">
      <div className={styles.head}>
        <h2 className={styles.title} id="shft-feedback-title">
          Feedback<span className={styles.period}>.</span>
        </h2>
        <p className={styles.sub}>What producers are saying.</p>
      </div>
      {lanes.map((lane, laneIndex) => (
        <div className={styles.viewport} key={laneIndex}>
          <div
            data-marquee-track
            className={[
              styles.track,
              animate ? styles.trackAnimated : styles.trackStatic,
              laneIndex === 1 ? styles.trackReverse : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ "--marquee-dur": `${lane.length * SECONDS_PER_CARD}s` } as CSSProperties}
          >
            {lane.map((t, i) => (
              <Card key={`real-${i}`} t={t} />
            ))}
            {animate ? lane.map((t, i) => <Card key={`dupe-${i}`} t={t} dupe />) : null}
          </div>
        </div>
      ))}
    </section>
  )
}
```

- [ ] **Step 3: Wire it into the landing page**

In `app/shft/ShftLanding.tsx`, add to the imports at the top (after the `trackMeta` import):

```tsx
import TestimonialMarquee from "./TestimonialMarquee"
import { TESTIMONIALS } from "./shft-social"
```

Then find the hero sentinel and the Intro comment that follows it:

```tsx
      <span id="shft-hero-sentinel" aria-hidden />

      {/* ---- Intro -------------------------------------------------------- */}
```

Insert the marquee between them:

```tsx
      <span id="shft-hero-sentinel" aria-hidden />

      {/* ---- Feedback (social proof, straight under the hero) -------------- */}
      <TestimonialMarquee items={TESTIMONIALS} />

      {/* ---- Intro -------------------------------------------------------- */}
```

- [ ] **Step 4: Verify types and lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "TestimonialMarquee|shft-social|ShftLanding" || echo "types clean"`
Expected: `types clean`

Run: `npm run lint 2>&1 | tail -20`
Expected: no errors referencing the new files.

- [ ] **Step 5: Verify in the browser**

Start the dev server (`npm run dev`) and open `http://localhost:3000/shft`. Confirm each of these by eye:

1. The Feedback section sits directly below the hero, before "Draw a curve on every step".
2. Five cards drift right-to-left, slowly (a full cycle takes about 45 seconds).
3. **The wrap is seamless** — watch one full cycle and confirm there is no jump or gap when it repeats. A visible stutter means the `margin-right` constraint was violated; check that no `gap` was added to `.track`.
4. Cards fade out at both left and right edges rather than being cut off square.
5. Hovering any card pauses the whole row; moving away resumes it.
6. `@mikeartuso` shows a blue check; the others do not.
7. `@atlasmaison` renders its three emoji large with **no** quotation marks. The other four are wrapped in curly quotes.
8. All five show a monogram circle (M, B, S, B, A) in taupe — this is expected until Task 5.
9. `@mikeartuso` and `@balmoral_court_` are never visible on screen at the same time.
10. Clicking a card opens that Instagram profile in a new tab.

- [ ] **Step 6: Verify the low-count and reduced-motion states**

Temporarily edit `app/shft/shft-social.ts` to export only the first two testimonials (comment out entries 3-5). Reload and confirm: the row is **static and centred**, not animating, with no duplicated cards. Then restore all five.

In Chrome DevTools, open the Command Menu (Cmd+Shift+P), run "Emulate CSS prefers-reduced-motion: reduce", and reload. Confirm: no animation, exactly five cards (no duplicates), and the row scrolls horizontally by trackpad/drag. Turn the emulation off afterwards.

- [ ] **Step 7: Commit**

```bash
git add app/shft/TestimonialMarquee.tsx app/shft/testimonial-marquee.module.css app/shft/ShftLanding.tsx
git commit -m "feat(shft): add testimonial marquee under the hero"
```

---

### Task 3: Reel carousel

**Files:**
- Create: `app/shft/reel-carousel.module.css`
- Create: `app/shft/ReelCarousel.tsx`
- Modify: `app/shft/ShftLanding.tsx` (imports; JSX after the `styles.blocks` div, currently line 352)
- Modify: `app/shft/shft-social.ts` (temporary fixtures — removed in Task 4)

**Interfaces:**
- Consumes: `Reel`, `REELS` from `./shft-social` (Task 1).
- Produces: `export default function ReelCarousel({ reels }: { reels: Reel[] })`. Default export.

**Geometry lives in CSS, not JS.** The component sets only `--off` (signed offset from centre) and `--dist` (absolute offset) as custom properties per card; the stylesheet turns those into translate/scale/blur/opacity. This is what lets the spread tighten on mobile via a media query with no JS involvement and no resize listener.

**Verification needs fixtures.** `REELS` is empty, so the carousel renders nothing and cannot be reviewed. This task temporarily populates it with two videos already in `public/shft/` — real files that exercise autoplay, unmuting, the observer and the transforms. They are the wrong *content* (UI screen recordings, not reels) and Task 4 removes them.

- [ ] **Step 1: Create the stylesheet**

```css
/* Reel carousel for /shft — 9:16 cards in a coverflow, centre one playing.
   Card geometry is driven by --off (signed distance from centre) and --dist
   (absolute distance), set per card by the component. Keeping it in CSS is
   what lets --spread change at a breakpoint without any JS. */

.section {
  padding: clamp(56px, 9vw, 104px) 20px clamp(48px, 8vw, 88px);
  text-align: center;
  overflow: hidden;
}
.title {
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  font-weight: 800;
  font-size: clamp(34px, 5.5vw, 60px);
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0 0 8px;
  color: var(--ink, #24211d);
}
.period {
  color: var(--accent, #9b8b76);
}
.sub {
  font-size: clamp(14px, 1.6vw, 17px);
  color: var(--ink-dim, rgba(36, 33, 29, 0.62));
  margin: 0 0 clamp(30px, 4vw, 48px);
}

.stage {
  --spread: 62%;
  position: relative;
  height: min(74vh, 620px);
  max-width: 1180px;
  margin: 0 auto;
  outline: none;
  /* Vertical drags scroll the page; we only claim horizontal ones. */
  touch-action: pan-y;
}
.stage:focus-visible {
  outline: 2px solid var(--accent, #9b8b76);
  outline-offset: 6px;
  border-radius: 20px;
}

.card {
  position: absolute;
  left: 50%;
  top: 50%;
  width: clamp(240px, 27vw, 330px);
  aspect-ratio: 9 / 16;
  max-height: 100%;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 20px;
  overflow: hidden;
  background: #0e0c0a;
  box-shadow: 0 30px 70px -30px rgba(0, 0, 0, 0.55);
  transform: translate(-50%, -50%) translateX(calc(var(--off) * var(--spread))) scale(calc(1 - var(--dist) * 0.14));
  filter: blur(calc(var(--dist) * 2px));
  opacity: calc(1 - var(--dist) * 0.25);
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), filter 0.45s ease, opacity 0.45s ease;
  will-change: transform;
}
button.card {
  cursor: pointer;
}
.cardActive {
  filter: none;
}
.cardOut {
  opacity: 0;
  pointer-events: none;
}

.media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.soundBtn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--cream, #f4efe4);
  background: rgba(14, 12, 10, 0.55);
  backdrop-filter: blur(6px);
  transition: background 0.15s ease;
}
.soundBtn:hover {
  background: rgba(14, 12, 10, 0.82);
}

.handle {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  color: var(--cream, #f4efe4);
  background: rgba(14, 12, 10, 0.5);
  backdrop-filter: blur(6px);
}
a.handle:hover {
  background: rgba(14, 12, 10, 0.82);
}

.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 60;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid var(--line, rgba(36, 33, 29, 0.14));
  background: var(--cream, #f4efe4);
  color: var(--ink, #24211d);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);
  transition: opacity 0.15s ease, transform 0.12s ease;
}
.nav:disabled {
  opacity: 0.3;
  cursor: default;
}
.nav:not(:disabled):hover {
  transform: translateY(-50%) scale(1.06);
}
.navPrev {
  left: 8px;
}
.navNext {
  right: 8px;
}

.dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 26px;
}
.dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: var(--ink, #24211d);
  opacity: 0.22;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dotOn {
  opacity: 0.85;
  transform: scale(1.25);
}

@media (max-width: 760px) {
  .stage {
    /* Neighbours only peek — a wide spread wastes the narrow viewport. */
    --spread: 84%;
    height: min(68vh, 520px);
  }
  .nav {
    width: 40px;
    height: 40px;
  }
  .navPrev {
    left: 2px;
  }
  .navNext {
    right: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }
}
```

- [ ] **Step 2: Create the component**

```tsx
"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react"
import type { Reel } from "./shft-social"
import styles from "./reel-carousel.module.css"

/** Cards further than this from centre are fully transparent and inert. */
const VISIBLE_SPAN = 2
/** Horizontal pointer travel that counts as a swipe. */
const SWIPE_PX = 40

function SpeakerOff() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M17 9l4 6M21 9l-4 6" />
    </svg>
  )
}

function SpeakerOn() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  )
}

export default function ReelCarousel({ reels }: { reels: Reel[] }) {
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)
  const [inView, setInView] = useState(false)
  const [reduced, setReduced] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Don't play until the section is actually on screen — it sits well below a
  // hero video that is already playing.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (inView && !reduced) {
      // Autoplay can still be refused; the poster stays up and the catch keeps
      // it out of the console.
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [inView, reduced, active])

  // Every slide change mounts a fresh element, so audio can never carry over.
  useEffect(() => {
    setMuted(true)
  }, [active])

  // React's `muted` attribute doesn't reliably reach the element; set the
  // property directly.
  useEffect(() => {
    const v = videoRef.current
    if (v) v.muted = muted
  }, [muted, active])

  const go = useCallback(
    (next: number) => {
      setActive((cur) => {
        const clamped = Math.max(0, Math.min(reels.length - 1, next))
        return clamped === cur ? cur : clamped
      })
    },
    [reels.length],
  )

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      go(active - 1)
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      go(active + 1)
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: PointerEvent) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    // Ignore vertical-dominant drags so page scrolling is never captured.
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return
    go(active + (dx < 0 ? 1 : -1))
  }

  const toggleSound = () => {
    const v = videoRef.current
    if (v?.paused) v.play().catch(() => {})
    setMuted((m) => !m)
  }

  if (reels.length === 0) return null
  const multi = reels.length > 1

  return (
    <section className={styles.section} aria-labelledby="shft-reels-title">
      <h2 className={styles.title} id="shft-reels-title">
        Made with shft<span className={styles.period}>.</span>
      </h2>
      <p className={styles.sub}>Tap a clip to hear it.</p>

      <div
        className={styles.stage}
        ref={stageRef}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label="Reels made with shft"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {multi ? (
          <button
            type="button"
            className={`${styles.nav} ${styles.navPrev}`}
            onClick={() => go(active - 1)}
            disabled={active === 0}
            aria-label="Previous reel"
          >
            &#8249;
          </button>
        ) : null}

        {reels.map((r, i) => {
          const offset = i - active
          const dist = Math.abs(offset)
          const style = { "--off": offset, "--dist": dist, zIndex: reels.length - dist } as CSSProperties
          const out = dist > VISIBLE_SPAN

          if (offset === 0) {
            return (
              <div
                key={r.src}
                className={`${styles.card} ${styles.cardActive}`}
                style={style}
                aria-label={`Reel ${i + 1} of ${reels.length}`}
              >
                <video
                  ref={videoRef}
                  className={styles.media}
                  src={r.src}
                  poster={r.poster}
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
                <button
                  type="button"
                  className={styles.soundBtn}
                  onClick={toggleSound}
                  aria-label={muted ? "Unmute reel" : "Mute reel"}
                >
                  {muted ? <SpeakerOff /> : <SpeakerOn />}
                </button>
                {r.handle ? (
                  r.url ? (
                    <a className={styles.handle} href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.handle}
                    </a>
                  ) : (
                    <span className={styles.handle}>{r.handle}</span>
                  )
                ) : null}
              </div>
            )
          }

          return (
            <button
              type="button"
              key={r.src}
              className={`${styles.card}${out ? ` ${styles.cardOut}` : ""}`}
              style={style}
              onClick={() => go(i)}
              aria-label={`Show reel ${i + 1} of ${reels.length}`}
              aria-hidden={out || undefined}
              tabIndex={out ? -1 : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.media} src={r.poster} alt="" loading="lazy" />
            </button>
          )
        })}

        {multi ? (
          <button
            type="button"
            className={`${styles.nav} ${styles.navNext}`}
            onClick={() => go(active + 1)}
            disabled={active === reels.length - 1}
            aria-label="Next reel"
          >
            &#8250;
          </button>
        ) : null}
      </div>

      {multi ? (
        <div className={styles.dots}>
          {reels.map((r, i) => (
            <button
              type="button"
              key={r.src}
              className={`${styles.dot}${i === active ? ` ${styles.dotOn}` : ""}`}
              onClick={() => go(i)}
              aria-label={`Go to reel ${i + 1}`}
              aria-current={i === active || undefined}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
```

- [ ] **Step 3: Wire it into the landing page**

In `app/shft/ShftLanding.tsx`, extend the imports added in Task 2:

```tsx
import TestimonialMarquee from "./TestimonialMarquee"
import ReelCarousel from "./ReelCarousel"
import { TESTIMONIALS, REELS } from "./shft-social"
```

Find the end of the feature blocks and the Capabilities comment that follows:

```tsx
        ))}
      </div>

      {/* ---- Capabilities ------------------------------------------------- */}
```

Insert the carousel between them:

```tsx
        ))}
      </div>

      {/* ---- Made with shft (reels) --------------------------------------- */}
      <ReelCarousel reels={REELS} />

      {/* ---- Capabilities ------------------------------------------------- */}
```

- [ ] **Step 4: Add temporary fixtures so the carousel can be reviewed**

`REELS` is empty, so nothing renders. Temporarily replace the export in `app/shft/shft-social.ts` with two real videos already in `public/shft/`:

```ts
/* TEMPORARY FIXTURES — removed in Task 4. These are UI screen recordings, not
   reels; they exist only so the carousel can be exercised before real files
   land. Do not ship these. */
export const REELS: Reel[] = [
  { src: "/shft/steps-v3.mp4", poster: "/shft/steps-v3-poster.jpg", handle: "@fixture_one", url: "https://example.com/" },
  { src: "/shft/hero-v2.mp4", poster: "/shft/hero-v2-poster.jpg", handle: "@fixture_two" },
]
```

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "ReelCarousel|shft-social|ShftLanding" || echo "types clean"`
Expected: `types clean`

Run: `npm run lint 2>&1 | tail -20`
Expected: no errors referencing the new files.

- [ ] **Step 6: Verify in the browser**

With the dev server running, open `http://localhost:3000/shft` and scroll to "Made with shft." below the feature blocks. Confirm:

1. Two 9:16 cards: one centred and sharp, one offset, smaller, blurred and dimmed.
2. The centre card **starts playing only as you scroll it into view**, not before. Scroll away and back to confirm it pauses and resumes.
3. It plays silently. Clicking the speaker button turns sound on and swaps the icon.
4. With sound on, clicking the right arrow moves to the next reel and **the new card is silent** — audio does not carry over.
5. Clicking the offset side card brings it to centre.
6. The left arrow is disabled on the first card, the right arrow on the last. No wraparound.
7. The two dots track the active card.
8. Click the stage, then press the Left/Right arrow keys — the carousel moves.
9. Drag horizontally across the stage — it advances. Drag vertically — the **page scrolls** and the carousel does not move.
10. Open DevTools Network, filter to Media, reload, and scroll down: only the centre video file is requested. The side card's MP4 is never fetched.

- [ ] **Step 7: Verify the single-reel and mobile states**

Temporarily cut the fixture array to one entry. Confirm: one centred card, **no arrows, no dots**, and it still plays. Restore both entries.

In DevTools, switch to a 390px-wide device emulation. Confirm the side card only peeks in at the edge rather than sitting far out, and the arrows sit close to the frame edges without overlapping the card.

- [ ] **Step 8: Commit**

```bash
git add app/shft/ReelCarousel.tsx app/shft/reel-carousel.module.css app/shft/ShftLanding.tsx app/shft/shft-social.ts
git commit -m "feat(shft): add reel carousel with fixture videos"
```

---

### Task 4: Verification script, empty-state, and full pass

**Files:**
- Create: `scripts/verify-shft-social.mjs`
- Modify: `app/shft/shft-social.ts` (remove the Task 3 fixtures)

**Interfaces:**
- Consumes: the rendered `/shft` page from Tasks 2 and 3.
- Produces: `node scripts/verify-shft-social.mjs` — exits `0` on pass, `1` on failure, and writes screenshots to `reports/shft-social/`.

This script is a plain Node script using the `playwright` library the repo already depends on. It is **not** a test framework and adds no dependency.

- [ ] **Step 1: Remove the fixtures**

In `app/shft/shft-social.ts`, restore the real export:

```ts
/* Empty until the source files land — see Task 5. The carousel returns null on
   an empty array, so the section is simply absent rather than broken. */
export const REELS: Reel[] = []
```

- [ ] **Step 2: Write the verification script**

```js
#!/usr/bin/env node
// Drives the real /shft page in Chromium and checks the two social-proof
// sections. Not a test framework — a script using the playwright library the
// repo already depends on.
//
//   npm run dev            # in another terminal
//   node scripts/verify-shft-social.mjs
//
// Override the target with BASE_URL=https://... to check a deploy.
import { chromium, devices } from "playwright"
import { mkdirSync } from "node:fs"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const OUT = "reports/shft-social"
const failures = []

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`)
  } else {
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`)
    failures.push(label)
  }
}

async function run() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()

  // ---- Desktop ----------------------------------------------------------
  console.log("\ndesktop 1440x900")
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await desktop.newPage()
  await page.goto(`${BASE}/shft`, { waitUntil: "domcontentloaded" })

  const feedback = page.locator('section[aria-labelledby="shft-feedback-title"]')
  await feedback.waitFor({ state: "attached", timeout: 15000 })
  check("feedback section renders", await feedback.count() === 1)

  // Count cards by anchor, not by [aria-hidden] — the platform glyphs and
  // monogram circles carry aria-hidden too and would make the count meaningless.
  const real = await feedback.locator('a:not([aria-hidden="true"])').count()
  const dupes = await feedback.locator('a[aria-hidden="true"]').count()
  check("five testimonial cards render", real === 5, `got ${real}`)
  check("duplicate set matches and is hidden from assistive tech", dupes === real, `${dupes} dupes vs ${real} real`)

  // Emoji-only quote must not be wrapped in curly quotes. Read it off the card
  // rather than matching on the text, so a regression fails instead of throwing.
  const atlas = (await feedback.locator('a[href*="atlasmaison"]').first().textContent()) || ""
  check("emoji-only quote has no quote marks", atlas.includes("🔥") && !atlas.includes("“"), JSON.stringify(atlas))

  // Track must actually be animating. Targeted by data attribute — an nth()
  // index would silently follow any markup change.
  const anim = await feedback
    .locator("[data-marquee-track]")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName)
  check("marquee track is animating", anim !== "none" && anim !== "", `animation-name: ${anim}`)

  // REELS is empty, so the carousel must be absent entirely.
  const reels = page.locator('section[aria-labelledby="shft-reels-title"]')
  check("reel carousel absent while REELS is empty", (await reels.count()) === 0)

  // The page must never scroll sideways — the marquee track is wider than the
  // viewport and must be clipped by its own overflow, not the body's.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check("no horizontal page overflow", overflow <= 1, `${overflow}px`)

  await page.screenshot({ path: `${OUT}/desktop-full.png`, fullPage: true })
  await feedback.screenshot({ path: `${OUT}/desktop-feedback.png` })

  // ---- Mobile -----------------------------------------------------------
  console.log("\nmobile (iPhone 13)")
  const mobile = await browser.newContext({ ...devices["iPhone 13"] })
  const mpage = await mobile.newPage()
  await mpage.goto(`${BASE}/shft`, { waitUntil: "domcontentloaded" })
  const mfeedback = mpage.locator('section[aria-labelledby="shft-feedback-title"]')
  await mfeedback.waitFor({ state: "attached", timeout: 15000 })
  check("feedback section renders on mobile", (await mfeedback.count()) === 1)
  const moverflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check("no horizontal page overflow on mobile", moverflow <= 1, `${moverflow}px`)
  await mpage.screenshot({ path: `${OUT}/mobile-full.png`, fullPage: true })

  // ---- Reduced motion ---------------------------------------------------
  console.log("\nreduced motion")
  const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })
  const rpage = await rm.newPage()
  await rpage.goto(`${BASE}/shft`, { waitUntil: "domcontentloaded" })
  const rfeedback = rpage.locator('section[aria-labelledby="shft-feedback-title"]')
  await rfeedback.waitFor({ state: "attached", timeout: 15000 })
  const rdupes = rfeedback.locator('a[aria-hidden="true"]')
  const rdupeCount = await rdupes.count()
  const dupeVisible = rdupeCount > 0 ? await rdupes.first().isVisible() : false
  check(
    "duplicate cards rendered but hidden under reduced motion",
    rdupeCount > 0 && !dupeVisible,
    `${rdupeCount} dupes, visible=${dupeVisible}`,
  )
  const ranim = await rfeedback
    .locator("[data-marquee-track]")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName)
  check("marquee animation disabled under reduced motion", ranim === "none", `animation-name: ${ranim}`)
  await rpage.screenshot({ path: `${OUT}/reduced-motion.png`, fullPage: true })

  await browser.close()

  console.log(`\nscreenshots → ${OUT}/`)
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed:`)
    for (const f of failures) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log("\nall checks passed")
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Run the verification script**

Start the dev server in one terminal (`npm run dev`), then:

Run: `node scripts/verify-shft-social.mjs`
Expected: every line prefixed `ok`, ending with `all checks passed`, exit code 0.

If a check fails, fix the component — **do not loosen the check** to make it pass.

- [ ] **Step 4: Review the screenshots**

Open `reports/shft-social/desktop-full.png`, `desktop-feedback.png`, `mobile-full.png` and `reduced-motion.png`. Confirm the Feedback section sits under the hero, the cards read cleanly at both widths, and no "Made with shft." heading appears anywhere (the carousel must be fully absent, not an empty heading).

- [ ] **Step 5: Confirm the production build**

Run: `npm run build 2>&1 | tail -25`
Expected: build completes, `/shft` listed in the route output, no errors.

- [ ] **Step 6: Confirm nothing touched the CSP**

Run: `git diff --stat HEAD~3 -- next.config.ts`
Expected: empty output. Any change here means the approach went wrong — see Global Constraints.

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-shft-social.mjs app/shft/shft-social.ts
git commit -m "feat(shft): add social proof verification script, clear reel fixtures"
```

---

### Task 5: Asset intake — BLOCKED until files arrive

**Files:**
- Create: `public/shft/reels/*.mp4`, `public/shft/reels/*.jpg`
- Create: `public/shft/testimonials/*.jpg`
- Modify: `app/shft/shft-social.ts`

**Interfaces:**
- Consumes: `Testimonial.avatar`, `Reel` from Task 1.
- Produces: populated `REELS`, and `avatar` paths on the testimonials that have pictures.

**This task cannot start until the site owner supplies:**
1. Five reel source files (originals from his editor — any format, any resolution). Instagram is behind a login wall; `yt-dlp` returns "empty media response" on all five URLs, so they cannot be fetched.
2. Four profile pictures: `mikeartuso`, `spookey642`, `balmoral_court_`, `atlasmaison`. `bwanonymous` has no profile picture and keeps its monogram.

Do the two halves independently — avatars can land before videos or vice versa. Each half is its own commit.

- [ ] **Step 1: Process the avatars**

For each supplied image, with `<slug>` being the handle without the `@`:

```bash
mkdir -p public/shft/testimonials
ffmpeg -y -i "<source-image>" \
  -vf "scale=96:96:force_original_aspect_ratio=increase,crop=96:96" \
  -q:v 3 "public/shft/testimonials/<slug>.jpg"
```

Verify each is 96×96 and under ~12KB:

```bash
for f in public/shft/testimonials/*.jpg; do
  echo "$f $(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$f") $(du -h "$f" | cut -f1)"
done
```

- [ ] **Step 2: Reference the avatars in the content module**

Add an `avatar` line to each testimonial that now has a file. `@bwanonymous` gets none — it keeps the monogram:

```ts
  {
    name: "@mikeartuso",
    quote: "This is so sick 🔥🔥🔥",
    avatar: "/shft/testimonials/mikeartuso.jpg",
    verified: true,
    url: "https://www.instagram.com/mikeartuso/",
    likes: 1,
  },
```

Reload `/shft` and confirm: four cards show photos, `@bwanonymous` still shows its "B" monogram, and photo and monogram circles are the same size and vertically aligned.

- [ ] **Step 3: Commit the avatars**

```bash
git add public/shft/testimonials app/shft/shft-social.ts
git commit -m "feat(shft): add testimonial avatars"
```

- [ ] **Step 4: Encode the reels**

For each source video, with `<slug>` a short name (e.g. the handle or a word from the clip):

```bash
mkdir -p public/shft/reels
ffmpeg -y -i "<source-video>" \
  -vf "scale='min(720,iw)':-2:force_original_aspect_ratio=decrease" \
  -c:v libx264 -profile:v high -crf 24 -maxrate 2500k -bufsize 5000k \
  -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 128k \
  "public/shft/reels/<slug>.mp4"
```

`+faststart` is not optional — without it the moov atom sits at the end of the file and playback can't begin until the whole thing downloads.

Then pull a poster frame. Pick a moment with something on screen, not a black frame:

```bash
ffmpeg -y -ss 00:00:02 -i "public/shft/reels/<slug>.mp4" -frames:v 1 -q:v 4 \
  "public/shft/reels/<slug>.jpg"
```

Check the results — each MP4 should land in the 2-4MB range for a 20-30s clip:

```bash
for f in public/shft/reels/*.mp4; do
  echo "$f $(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$f") $(du -h "$f" | cut -f1)"
done
du -sh public/shft/reels
```

If a file lands well above 4MB, raise `-crf` toward 28 and re-encode. If it looks soft, lower it toward 21.

- [ ] **Step 5: Populate REELS**

Replace the empty export in `app/shft/shft-social.ts`. Match each entry to the Instagram permalink it came from:

```ts
export const REELS: Reel[] = [
  {
    src: "/shft/reels/<slug>.mp4",
    poster: "/shft/reels/<slug>.jpg",
    handle: "@<handle>",
    url: "https://www.instagram.com/p/DbEpnypvPSE/",
  },
  // ...one entry per reel, in the order they should appear
]
```

The five permalinks:

```
https://www.instagram.com/p/DbEpnypvPSE/
https://www.instagram.com/p/DbmPd3dK65u/
https://www.instagram.com/p/Da9mQfKqSwS/
https://www.instagram.com/p/DbTdL6xK5tO/
https://www.instagram.com/p/DbG1Q4cyvzt/
```

- [ ] **Step 6: Verify with the real content**

The verification script asserts the carousel is *absent*, which is no longer true. Update that one check in `scripts/verify-shft-social.mjs`:

```js
  const reels = page.locator('section[aria-labelledby="shft-reels-title"]')
  check("reel carousel renders", (await reels.count()) === 1)
  await reels.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  const playing = await reels.locator("video").first().evaluate((v) => !v.paused && v.currentTime > 0)
  check("centre reel autoplays once scrolled into view", playing)
  const isMuted = await reels.locator("video").first().evaluate((v) => v.muted)
  check("centre reel starts muted", isMuted)
  await reels.screenshot({ path: `${OUT}/desktop-reels.png` })
```

Run: `node scripts/verify-shft-social.mjs`
Expected: all checks pass.

Then confirm by hand in the browser, since playback quality can't be asserted: each clip looks sharp at full width, sound is clean when unmuted, and the poster frames aren't black.

- [ ] **Step 7: Commit the reels**

```bash
git add public/shft/reels app/shft/shft-social.ts scripts/verify-shft-social.mjs
git commit -m "feat(shft): add reels to the made-with carousel"
```

- [ ] **Step 8: Final full pass**

Run: `npm run lint 2>&1 | tail -10`
Run: `npm run build 2>&1 | tail -25`
Run: `node scripts/verify-shft-social.mjs`
Expected: all three clean.

Check the added weight is what you expect:

```bash
du -sh public/shft/reels public/shft/testimonials
```

---

## Notes for the reviewer

- **Tasks 1-4 are mergeable on their own.** They ship the testimonial marquee live with monogram avatars, and the reel section simply absent. Task 5 is additive and blocked on external assets.
- **The seamless wrap is the thing most likely to regress.** If anyone adds `gap` to `.track` in `testimonial-marquee.module.css`, the marquee will visibly jump once per cycle. The `margin-right` on `.card` is load-bearing, not a style preference.
- **`@mikeartuso` and `@balmoral_court_` are the same person.** Any reordering of `TESTIMONIALS` must keep at least two cards between them.
- **Nothing in this plan should touch `next.config.ts`.** Task 4 Step 6 asserts it.
