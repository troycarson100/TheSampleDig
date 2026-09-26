// shft's copy, moved verbatim off the old ShftLanding.tsx into the shared
// PluginContent shape. Only the launch-price sentences were touched — see the
// two PRICING interpolations below — because both figures they used to quote
// were stale launch-week numbers, and "limited" implies a deadline that
// doesn't exist. Everything else is the original prose, unchanged.
//
// This is a .tsx, not a .ts: the six capability icons are JSX, copied
// verbatim (same viewBox/stroke/path data) from the pre-template
// ShftLanding.tsx (see `git show 2115c61:app/shft/ShftLanding.tsx`).
import type { PluginContent } from "@/components/plugin-page/types"
import { PRICING } from "@/lib/products"

/* ---- capability icons (thin-line, matching the plugin's minimal look) ---- */
function IconFilter() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 15h6l3-9 3 15 3-9h3" />
    </svg>
  )
}
function IconGrit() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12l3-7 3 14 3-18 3 18 3-14 3 7h2" />
    </svg>
  )
}
function IconSwing() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 18c4 0 4-12 8-12s4 12 8 12" />
      <circle cx="4" cy="18" r="1.4" fill="currentColor" />
      <circle cx="20" cy="18" r="1.4" fill="currentColor" />
    </svg>
  )
}
function IconGrain() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
      <circle cx="6" cy="7" r="1.15" />
      <circle cx="11.5" cy="5.5" r="1.15" />
      <circle cx="17" cy="8" r="1.15" />
      <circle cx="8" cy="12" r="1.15" />
      <circle cx="13.5" cy="11.5" r="1.15" />
      <circle cx="18.5" cy="14.5" r="1.15" />
      <circle cx="6.5" cy="17" r="1.15" />
      <circle cx="12" cy="18" r="1.15" />
    </svg>
  )
}
function IconChaos() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 3l-8 11h5l-1 7 8-11h-5z" />
    </svg>
  )
}
function IconDice() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" />
      <circle cx="9" cy="15" r="1.2" fill="currentColor" />
    </svg>
  )
}

export const SHFT_CONTENT: PluginContent = {
  hero: {
    badge: "out now",
    description: "Gated Multi-FX",
    caption: "One-time purchase · macOS & Windows · VST3 / AU / Standalone",
    media: {
      kind: "video",
      src: "/shft/hero-v2.mp4",
      poster: "/shft/hero-v2-poster.jpg",
      alt: "shft running on a drum loop",
    },
  },

  intro: {
    eyebrow: "Inside shft",
    title: "Draw a curve on every step",
    body: "A grid where each step is a tiny envelope — swell, pluck, pulse. String them together and any sound turns rhythmic, perfectly in time.",
  },

  blocks: [
    {
      title: "Sixteen steps, endless feel",
      body: "A host-locked step grid chops your audio in time. Each step is its own little shape — not just a dot — so you sculpt rhythm and dynamics in a single move. Click to toggle, drag to morph, drag sideways to ratchet.",
      media: {
        kind: "video",
        src: "/shft/steps-v3.mp4",
        poster: "/shft/steps-v3-poster.jpg",
        alt: "shft 16-step strip with per-step shapes",
      },
    },
    {
      title: "Six shapes, endless morph",
      body: "The gate envelope morphs continuously through swell, pluck, pulse, ramp and triangle — no stepping in between. Each step holds its own shape, so every hit can breathe a little differently.",
      media: { kind: "image", src: "/shft/shape.png", alt: "shft morphable gate shape display" },
    },
    {
      title: "Chop, reverse, granulate",
      body: "Arm any step's repeat bar and it stutters in place — blue for tight forward rolls, red for reverse backspin fills, green for a granular cloud that smears the grain into texture. Dial pitch, scatter and grain size across the board, then add chaos for glitches that never land the same way twice.",
      media: {
        kind: "image",
        src: "/shft/sc2.png",
        alt: "shft sequencer with colour-coded beat-repeat, reverse and granular steps",
      },
    },
    {
      title: "A finishing chain, built in",
      body: "Straight after the gate: a gated plate reverb with pitch-shift shimmer, a tempo-synced ping-pong delay that flips into a frequency-shifter echo, a compressor that swaps to 3-band OTT-style multiband, and heat saturation with ten drive models. Everything you need to print the sound without leaving the plugin.",
      media: {
        kind: "image",
        src: "/shft/fxpage.png",
        alt: "shft FX page — OTT multiband comp, heat, frequency-shifter echo, gated reverb",
      },
    },
    {
      title: "Modulation, in lanes",
      body: "Four tempo-synced LFOs feed a lane-based mod matrix that routes any source to almost anything — filter, FX, pitch, auto-pan, chaos, even one LFO bending another's rate. Mod rings on every knob show exactly what's moving, live, so the patch evolves on its own.",
      media: {
        kind: "image",
        src: "/shft/lfo.png",
        alt: "shft LFO page and modulation lanes with live mod rings",
      },
    },
  ],

  caps: {
    title: "More than a gate",
    items: [
      {
        icon: <IconFilter />,
        title: "Resonant filter",
        body: "A multimode LP / BP / HP filter opens on every hit and can self-oscillate — plucky, vocal, alive.",
      },
      {
        icon: <IconGrit />,
        title: "Grit & drive",
        body: "Push resonance into saturation for anything from a gentle warmth to a snarling, broken edge.",
      },
      {
        icon: <IconSwing />,
        title: "Swing & feel",
        body: "Straight, triplet, or dotted — then push the pocket with swing for a human groove.",
      },
      {
        icon: <IconGrain />,
        title: "Granular",
        body: "Freeze a step into a granular cloud — pitch, scatter and grain size reshape one slice into shimmering texture or a wall of grit.",
      },
      {
        icon: <IconChaos />,
        title: "Chaos",
        body: "One knob of generative glitch that re-rolls every step, so fills, stutters and drop-outs never land the same way twice.",
      },
      {
        icon: <IconDice />,
        title: "Snapshots & random",
        body: "Eight instant snapshots and a one-click randomizer for happy accidents on demand.",
      },
    ],
  },

  faq: [
    {
      q: "What is shft?",
      a: "shft is a tempo-synced rhythmic gate — a trance-gate — grown into a full gated multi-FX. A 16-step sequencer chops your audio with a morphable per-step shape, resonant filter and per-step beat-repeat (forward, reverse or granular). Then a built-in chain — gated reverb, frequency-shifter echo, OTT multiband and heat — plus a lane-based mod matrix turn pads, chords, vocals or drums into a moving, evolving part.",
    },
    {
      q: "Which formats does it come in, and will it work in my DAW?",
      a: "shft runs on macOS (Apple Silicon and Intel) as VST3, AU, and Standalone, and on Windows as VST3 and Standalone — so it works in DAWs like Ableton Live, Logic Pro, FL Studio, Bitwig, Studio One and more.",
    },
    {
      q: "Is it a subscription?",
      a: `No. shft is a one-time purchase with free updates — buy it once, keep it forever. $${PRICING.shft.price}, off a $${PRICING.shft.msrp} list price.`,
    },
  ],

  buy: {
    title: "Get shft",
    body: `One-time purchase, free updates. $${PRICING.shft.price}, off a $${PRICING.shft.msrp} list price.`,
  },
}
