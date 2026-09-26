// shft's copy, moved verbatim off the old ShftLanding.tsx into the shared
// PluginContent shape. Only the launch-price sentences were touched — see the
// two PRICING interpolations below — because both figures they used to quote
// ($19 / $39) are stale and "limited" implies a deadline that doesn't exist.
// Everything else is the original prose, unchanged.
import type { PluginContent } from "@/components/plugin-page/types"
import { PRICING } from "@/lib/products"

export const SHFT_CONTENT: PluginContent = {
  hero: {
    badge: "out now",
    description: "Gated Multi-FX",
    media: {
      kind: "video",
      src: "/shft/hero-v2.mp4",
      poster: "/shft/hero-v2-poster.jpg",
      alt: "shft running on a drum loop",
    },
  },

  intro: {
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
        title: "Resonant filter",
        body: "A multimode LP / BP / HP filter opens on every hit and can self-oscillate — plucky, vocal, alive.",
      },
      {
        title: "Grit & drive",
        body: "Push resonance into saturation for anything from a gentle warmth to a snarling, broken edge.",
      },
      {
        title: "Swing & feel",
        body: "Straight, triplet, or dotted — then push the pocket with swing for a human groove.",
      },
      {
        title: "Granular",
        body: "Freeze a step into a granular cloud — pitch, scatter and grain size reshape one slice into shimmering texture or a wall of grit.",
      },
      {
        title: "Chaos",
        body: "One knob of generative glitch that re-rolls every step, so fills, stutters and drop-outs never land the same way twice.",
      },
      {
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
      a: `No. shft is a one-time purchase with free updates — buy it once, keep it forever. The $${PRICING.shft.price} launch price is a discount off the regular $${PRICING.shft.msrp}.`,
    },
  ],

  buy: {
    title: "Get shft",
    body: `One-time purchase, free updates. The $${PRICING.shft.price} launch price is a discount off $${PRICING.shft.msrp}.`,
  },
}
