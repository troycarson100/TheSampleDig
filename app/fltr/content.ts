// fltr's copy, transcribed from the FLTR product brief into the shared
// PluginContent shape. `hero.caption` and `intro.eyebrow` were added after the
// brief was written — see components/plugin-page/types.ts — so they're not in
// the brief's block; caption calls out macOS-only rather than reusing shft's
// "macOS & Windows" line, and eyebrow follows shft's "Inside <name>" case
// rather than drft's all-caps "INSIDE DRFT". Everything else is the brief's
// prose, unchanged.
import type { PluginContent } from "@/components/plugin-page/types"
import { PRICING } from "@/lib/products"

const img = (src: string, alt: string) => ({ kind: "image" as const, src, alt })

export const FLTR_CONTENT: PluginContent = {
  hero: {
    badge: "out now",
    description:
      "A filter with twelve characters and a Shape control that morphs each one. Tune it to your key and it stops being a filter you sweep and starts being one that plays.",
    caption: "One-time purchase · macOS · VST3 / AU / Standalone",
    media: img("/fltr/hero.png", "fltr's interface, showing the live filter curve and its five modules"),
  },
  intro: {
    eyebrow: "Inside fltr",
    title: "A filter that knows what key you are in",
    body:
      "Twelve characters set what the filter is, from a Moog-style ladder to an SEM, a phaser, a frequency shifter, a tuned comb, vowels. They are level-matched, so moving between them changes the colour and not the volume. Two of them go further: Chord and Harmony turn whatever passes through into a chord in the key you chose.",
  },
  blocks: [
    {
      title: "Twelve characters, one Shape control",
      body:
        "Ladder, SEM, Disperse, Phase, Shift, Comb, Formant, Fold, Liquid, Shatter, Chord and Harmony. Shape morphs each one's response rather than switching between presets of it, so a character is a place to start and not a fixed setting.",
    },
    {
      title: "Chord and Harmony play in key",
      body:
        "Chord snaps the input's partials to the notes of a chord. Harmony rings that chord through a resonator bank. Both follow a root and one of 14 scales, including one you edit from the keyboard, and a wheel picks the degree from I to VII and glides between them. Pull moves Chord from snapping notes onto the chord to bending them towards it, Wave swaps the bell-like sine partials for triangle, square or saw, and Arp plays the chord one note at a time in nine patterns, in time with your session.",
    },
    {
      title: "Two cores, six ways to wire them",
      body:
        "Run the two filter cores as Single, Series, Parallel, Split L/R, Split M/S or Band, and give each ear its own filter with Width. Drive adds soft, transistor or fold saturation before or after the filter, oversampled at 1x, 2x or 4x, with auto-gain holding the output where it was.",
    },
    {
      title: "Modulation you drag where you want it",
      body:
        "Four sources run on every sample: Follow, an envelope follower on the input or the sidechain; Move, an LFO, free or in time; Draw, a 32-step sequencer that follows the playhead over one to eight bars; and Macro, one hand control. There is no matrix. Drag a source onto the pad, a display, a footer or the Mix control and a depth chip appears there; drag the chip sideways to set how far it goes. Cutoff modulation is measured in semitones, up to four octaves, so a given depth is the same musical distance wherever the filter is sitting.",
    },
    {
      title: "Push",
      body:
        "Six things the filter can do past filtering, each on its own tab. Tune snaps the cutoff to the nearest note of the scale and can follow MIDI. Keytrack moves it with the notes you play. Feedback sends the output back through a short delay and a saturator, where Comb rings, Spiral climbs or falls forever, and Bloom blurs into a wash. FM modulates the cutoff at audio rate. Smear blurs transients. Freeze holds the sound where it is.",
    },
    {
      title: "It draws what it is doing",
      body:
        "The interface redraws about thirty times a second from the processor itself, not from your settings. When modulation moves the filter, the curve you set is drawn as a ghost behind the curve you are hearing, so you can see the difference. Presets are plain files in a folder — move them, share them, keep them in version control.",
    },
  ],
  caps: {
    title: "The rest of it",
    items: [
      { title: "Formats", body: "VST3, AU and a standalone app." },
      { title: "Platform", body: "macOS, as a universal binary for Apple silicon and Intel." },
      { title: "Quality", body: "Live, Studio, High and Ultra trade latency against resolution, so you can track on one setting and mix on another." },
      { title: "Scales", body: "14 scales plus one you edit yourself from the on-screen keyboard." },
      { title: "OTT", body: "A one-knob three-band compressor, in the box." },
      { title: "Licence", body: "One key covers three machines. Deactivate one here to free the slot." },
    ],
  },
  faq: [
    {
      q: "Is it a subscription?",
      a: `No. fltr is a one-time purchase with free updates — buy it once and keep it. $${PRICING.fltr.price} is its introductory price, off a list price of $${PRICING.fltr.msrp}.`,
    },
    {
      q: "Does it run on Windows?",
      a: "Not yet. fltr ships for macOS at launch, as a universal binary for Apple silicon and Intel Macs.",
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
