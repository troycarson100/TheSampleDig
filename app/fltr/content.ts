// fltr's copy, transcribed from the FLTR product brief into the shared
// PluginContent shape, then brought up to the plugin as it now stands.
//
// Three things changed in the plugin after the brief was written, and the
// copy follows the plugin:
//  - Disperse, Liquid and Shatter came off the character grid (2026-09-15), so
//    there are nine characters, not twelve.
//  - Smear left Push, and Space, Comp and Arp joined it: eight tabs, not six.
//  - Every patch became two sounds, A and B, with a morph between them. The
//    brief has no words for that; the block about it is drafted from the
//    plugin's own tooltips.
//  - It ships for Windows as well as macOS (2026-09-29), where the brief had
//    macOS only. AU is a macOS format, so Windows gets VST3 and standalone.
//
// The hero is the panel (./panel.ts), so the "Inside fltr" intro is gone, the
// same as on shft and drft: what it said is in the hero and the first block.
// The pictures are all cut from the four screenshots the panel uses.
import type { PluginContent } from "@/components/plugin-page/types"
import { FLTR_PANEL } from "./panel"
import { PRICING } from "@/lib/products"

const img = (src: string, alt: string) => ({ kind: "image" as const, src, alt })

export const FLTR_CONTENT: PluginContent = {
  hero: {
    badge: "out now",
    description: "A filter that plays in key",
    // Was the hero's whole description. It says what the plugin is, so it
    // stays with the name, under a line short enough to read at a glance.
    body:
      "Nine characters and a Shape control that morphs each one. Tune it to your key and it stops being a filter you sweep and starts being one that plays.",
    caption: "One-time purchase · macOS & Windows · VST3 / AU / Standalone",
    panel: FLTR_PANEL,
  },
  blocks: [
    {
      title: "Nine characters, one Shape control",
      body:
        "Ladder, SEM, Fold, Comb, Formant, Phase, Chord, Harmony and Shift. Shape morphs each one's response rather than switching between presets of it, so a character is a place to start and not a fixed setting. They are level-matched, so moving between them changes the colour and not the volume.",
      media: img("/fltr/block-characters.webp", "fltr's shape, drive and filter modules with the fold character selected, the resonance folded into a row of teeth"),
    },
    {
      title: "Chord and Harmony play in key",
      body:
        "Chord snaps the input's partials to the notes of a chord. Harmony rings that chord through a resonator bank. Both follow a root and one of 14 scales, including one you edit from the keyboard, and a wheel picks the degree from I to VII and glides between them. Pull moves Chord from snapping notes onto the chord to bending them towards it, Wave swaps the bell-like sine partials for triangle, square or saw, and Arp plays the chord one note at a time in nine patterns, in time with your session.",
      media: img("/fltr/tour-harmony.webp", "fltr with harmony running: the notes of the scale drawn as lines down the display, and a ninth chord in the shape module"),
    },
    {
      title: "Two sounds, and a morph between them",
      body:
        "Every patch is two complete sounds, A and B, and a bar that moves between them. Blend crossfades the two. Morph glides every setting from one to the other. Follow lets the level of the input move it, Weave and Random switch sides on the beat, and Split puts A below a crossover and B above it. Each side has its own dice, and a third rolls the lot.",
      media: img("/fltr/block-morph.webp", "fltr's header and display: the morph bar between A and B set to split, above a response curve crossing the notes of the scale"),
    },
    {
      title: "Two cores, six ways to wire them",
      body:
        "Run the two filter cores as Single, Series, Parallel, Split L/R, Split M/S or Band, and give each ear its own filter with Width. Drive adds soft, transistor or fold saturation before or after the filter, oversampled at 1x, 2x or 4x, with auto-gain holding the output where it was.",
      media: img("/fltr/block-cores.webp", "fltr's shape, drive and filter modules with the comb character in series, drive pushed hard ahead of the filter"),
    },
    {
      title: "Modulation you drag where you want it",
      body:
        "Four sources run on every sample: Follow, an envelope follower on the input or the sidechain; Move, an LFO, free or in time; Draw, a 32-step sequencer that follows the playhead over one to eight bars; and Macro, one hand control. There is no matrix. Drag a source onto the pad, a display, a footer or the Mix control and a depth chip appears there; drag the chip sideways to set how far it goes. Cutoff modulation is measured in semitones, up to four octaves, so a given depth is the same musical distance wherever the filter is sitting.",
      media: img("/fltr/block-modulate.webp", "fltr's modulate and push modules: follow and move routed to spread, shown as two depth chips under the display"),
    },
    {
      title: "Push",
      body:
        "Eight things the filter can do past filtering, each on its own tab. Tune snaps the cutoff to the nearest note of the scale and can follow MIDI. Key moves it with the notes you play. Feedback sends the output back through a short delay and a saturator, where Comb rings, Spiral climbs or falls forever, and Bloom blurs into a wash. FM modulates the cutoff at audio rate. Space adds echo and reverb in three models. Comp is an opto compressor that catches a resonant peak without pumping the rest. Freeze holds the sound where it is, and Arp plays a chord one note at a time.",
      media: img("/fltr/block-push.webp", "fltr's modulate and push modules with the space tab open on its plate model"),
    },
    {
      title: "It draws what it is doing",
      body:
        "The interface redraws about thirty times a second from the processor itself, not from your settings. When modulation moves the filter, the curve you set is drawn as a ghost behind the curve you are hearing, so you can see the difference. Presets are plain files in a folder — move them, share them, keep them in version control.",
      media: img("/fltr/block-display.webp", "fltr's display with two resonant peaks in series, the curve as set drawn as a dashed ghost behind the curve being heard"),
    },
  ],
  caps: {
    title: "The rest of it",
    items: [
      { title: "Formats", body: "VST3, AU and a standalone app on macOS; VST3 and a standalone app on Windows." },
      { title: "Platform", body: "macOS, as a universal binary for Apple silicon and Intel, and Windows." },
      { title: "Quality", body: "Live, Studio, High and Ultra trade latency against resolution, so you can track on one setting and mix on another." },
      { title: "Scales", body: "14 scales plus one you edit yourself from the on-screen keyboard." },
      { title: "OTT", body: "A one-knob three-band compressor, in the box." },
      { title: "Licence", body: "One key covers three machines. Deactivate one here to free the slot." },
    ],
  },
  faq: [
    {
      q: "Is it a subscription?",
      a: `No. fltr is a one-time purchase with free updates — buy it once and keep it. $${PRICING.fltr.price}, off a $${PRICING.fltr.msrp} list price.`,
    },
    {
      q: "Which formats does it come in, and will it work in my DAW?",
      a: "fltr runs on macOS (Apple silicon and Intel) as VST3, AU and a standalone app, and on Windows as VST3 and a standalone app — so it works in DAWs like Ableton Live, Logic Pro, FL Studio, Bitwig, Studio One and more.",
    },
    {
      q: "Do I need to play the chords myself?",
      a: "No. Chord and Harmony build the chord from whatever you feed them — a pad, a vocal, a drum loop — following the root and scale you set. You can drive the degree by hand from the wheel, sequence it with Draw, or leave it where it is.",
    },
    {
      q: "Will it stay in time with my session?",
      a: "Yes. Move, Draw and the arp all sync to the host tempo, and Draw follows the playhead so the same bar sounds the same on every pass.",
    },
  ],
  buy: {
    title: "Get fltr",
    body: "One-time purchase, free updates, three machines per licence.",
  },
}
