// The hero panel for shft: the two pages of the plugin, and what the help bar
// says about each control on them.
//
// The words are the plugin's own. Every name, sentence and tip below is copied
// from shft's help table (GateFun/Source/HelpText.cpp), which is what the strip
// along the bottom of the real plugin shows when you hover a control - so the
// page and the plugin never describe the same knob two different ways. One
// edit was made throughout: "- remembered per lane" is dropped from the end of
// the sentences that carry it. It matters once you own the plugin and not
// before. PATTERN LENGTH's tip loses its first clause ("an odd length phases
// against the bar:") for room: the bar is two lines, and it was the one control
// that needed a third. The three page tabs are the exception: the plugin has no help entry
// for them, so those three are written for this page.
//
// Positions are in the screenshots' own pixels - both are 1758x1454 - so a
// spot can be read straight off the image. The header strip and the DRY / WET
// bar are in the same place on both pages, which is why they are one list.
import type { Panel, PanelSpot } from "@/components/plugin-page/types"

/** The colour each section of the panel is printed in. */
const TONE = {
  gate: "#38d6f5",
  gran: "#5fe08a",
  filt: "#f6a445",
  time: "#e8eaee",
  chaos: "#c58bf7",
  comp: "#f5966a",
  heat: "#38d6f5",
  delay: "#5b9cff",
  verb: "#3fe0a0",
} as const

type Text = { name: string; what: string; tip?: string }

const knob = (id: string, x: number, y: number, tone: string, t: Text, size = 160): PanelSpot => ({
  id, at: { x, y, w: size, h: size }, round: true, tone, ...t,
})
/** A box from its top-left corner, the way it is read off the screenshot. */
const box = (id: string, left: number, top: number, w: number, h: number, tone: string, t: Text, opens?: string): PanelSpot => ({
  id, at: { x: left + w / 2, y: top + h / 2, w, h }, tone, ...t, ...(opens ? { opens } : {}),
})

const HEADER: PanelSpot[] = [
  box("lanes", 48, 38, 418, 56, TONE.time, {
    name: "LANES",
    what: "eight pattern slots - click an empty one to save, a filled one to recall",
    tip: "drag a filled lane onto any knob to modulate it from that pattern",
  }),
  knob("dice", 528, 64, TONE.gate, {
    name: "RANDOM PATTERN",
    what: "rolls a new step pattern - states, ratchets, shapes and lengths",
    tip: "the knobs are left alone, so the sound you dialled in survives",
  }, 72),
  box("tab-seq", 588, 40, 54, 50, TONE.time, {
    name: "SEQ",
    what: "the sequencer page - the 16-step strip and the gate, granular and filter knobs",
    tip: "open the sequencer page",
  }, "seq"),
  box("tab-fx", 648, 40, 54, 50, TONE.time, {
    name: "FX",
    what: "the effects page - compressor, heat, delay and reverb, straight after the gate",
    tip: "open the fx page",
  }, "fx"),
  box("tab-lfo", 706, 40, 54, 50, TONE.time, {
    name: "LFO",
    what: "the modulation page - four tempo-synced LFOs that route to almost any knob",
  }),
  box("rate", 780, 34, 228, 62, TONE.time, {
    name: "RATE",
    what: "note value of one step",
    tip: "1/16 is the trance-gate default; 1/8 leaves room for swing",
  }),
  box("feel", 1030, 34, 160, 62, TONE.time, {
    name: "FEEL",
    what: "straight, triplet or dotted timing",
    tip: "triplet against a straight drum loop is instant polyrhythm",
  }),
  box("fmode", 1214, 32, 244, 64, TONE.filt, {
    name: "FILTER",
    what: "low-pass, band-emphasis or high-pass shape for the cutoff knob",
    tip: "the middle mode keeps the body and pokes the band out with reso",
  }),
  box("drywet", 40, 1366, 316, 84, TONE.time, {
    name: "DRY / WET",
    what: "master blend of the whole plugin, effects included",
    tip: "the one control that always bypasses everything at zero",
  }),
]

const SEQ: PanelSpot[] = [
  box("bands", 784, 126, 906, 130, TONE.filt, {
    name: "BANDS",
    what: "how many bands the bar splits into - one, two or three",
    tip: "the + adds a band back, the x on a band merges it away",
  }),
  box("undo", 68, 500, 44, 44, TONE.time, {
    name: "UNDO",
    what: "steps back through your pattern edits - steps, ratchets, lengths, shapes, repeats",
    tip: "the dice counts as one edit, so a bad roll is one click away from undone",
  }),
  box("export", 1598, 500, 46, 44, TONE.time, {
    name: "EXPORT",
    what: "opens the drag pads - MIDI notes or CC, and audio of what just played",
    tip: "the wav pad stays greyed until you have played enough to capture",
  }),
  box("dragout", 1648, 500, 44, 44, TONE.time, {
    name: "DRAG OUT",
    what: "drags the pattern into your DAW as MIDI - notes and CC1 shape in one file",
    tip: "click it instead to open the export pads for audio or CC-only midi",
  }),
  box("step", 70, 548, 1620, 138, TONE.gate, {
    name: "STEP",
    what: "click toggles it on or off - drag up/down to morph its shape, sideways for ratchets",
    tip: "right-click or scroll cycles ratchets; option-drag copies a step onto another",
  }),
  box("repeat", 70, 688, 1620, 28, TONE.gran, {
    name: "BEAT REPEAT",
    what: "click the bar under a step to cycle it: forward, reversed, granular, off",
    tip: "the GRANULAR knobs - pitch, scatter and grain - shape what the repeat does",
  }),
  box("patlen", 70, 724, 1620, 30, TONE.gate, {
    name: "PATTERN LENGTH",
    what: "drag the caret to set where the pattern wraps - snaps to step ends, greyed steps sit out",
    tip: "12 steps of 1/16 lands somewhere new every beat",
  }),
  knob("shape", 166, 907, TONE.gate, {
    name: "SHAPE",
    what: "morphs the gate's curve from a soft swell to a hard square",
    tip: "sharp shapes chop, soft shapes pump - try soft against a slow rate",
  }),
  knob("edges", 402, 907, TONE.gate, {
    name: "EDGES",
    what: "rounds or sharpens the attack and release of every gate",
    tip: "back it off when fast patterns start to click",
  }),
  knob("depth", 638, 907, TONE.gate, {
    name: "DEPTH",
    what: "how far the gate closes - the difference between ducking and silence",
    tip: "stop short of full and the groove still breathes underneath",
  }),
  knob("mix", 874, 907, TONE.gate, {
    name: "MIX",
    what: "blends the gated signal back against the dry input",
    tip: "pull it down for a gate that flutters under the original",
  }),
  knob("pitch", 1110, 907, TONE.gran, {
    name: "PITCH",
    what: "transposes the repeated grains in semitones",
    tip: "+12 on short repeats turns a snare into a chirp",
  }),
  knob("scatter", 1346, 907, TONE.gran, {
    name: "SCATTER",
    what: "randomises where in the buffer each grain is read from",
    tip: "raise it in granular mode for smeared, cloudy stutters",
  }),
  knob("grain", 1582, 907, TONE.gran, {
    name: "GRAIN",
    what: "length of each granular grain",
    tip: "tiny grains buzz, long grains sound like a stutter edit",
  }),
  knob("cutoff", 166, 1175, TONE.filt, {
    name: "CUTOFF",
    what: "opens and closes the filter over the gated signal",
    tip: "park it low and let a lane open it on the accents",
  }),
  knob("reso", 402, 1175, TONE.filt, {
    name: "RESO",
    what: "emphasis right at the cutoff point, adding a vocal whistling edge",
    tip: "high reso plus a lane on cutoff is the classic acid sweep",
  }),
  knob("grit", 638, 1175, TONE.filt, {
    name: "GRIT",
    what: "dirt in the filter path - hair at low settings, teeth high up",
    tip: "a little under a fast gate makes the chops bite",
  }),
  knob("swing", 874, 1175, TONE.time, {
    name: "SWING",
    what: "pushes every off-beat step later, like a shuffled drum machine",
    tip: "55-60% locks to most house and garage grooves",
  }),
  knob("pan", 1110, 1175, TONE.time, {
    name: "PAN",
    what: "places the output in the stereo field",
    tip: "drop a lane on it for step-locked auto-pan",
  }),
  knob("out", 1346, 1175, TONE.time, {
    name: "OUT",
    what: "output level after everything, before the master dry/wet",
    tip: "trim here if heat or the comp pushed the meter into the red",
  }),
  knob("chaos", 1582, 1175, TONE.chaos, {
    name: "CHAOS",
    what: "randomly reshuffles steps, ratchets and repeats as the pattern plays",
    tip: "a touch stops a looped bar from repeating identically",
  }),
  // After the knobs, so they sit on top of the ones they overlap.
  box("lane-route", 430, 830, 44, 44, TONE.filt, {
    name: "LANE ROUTE",
    what: "the lane driving this knob - its ring shows how far the value sweeps",
    tip: "drag up/down for range, double-click to remove, cmd-click for uni/bi-polar",
  }),
  box("filter-global", 212, 1242, 40, 34, TONE.filt, {
    name: "GLOBAL FILTER",
    what: "one filter for every lane instead of one per lane",
    tip: "turn it on to sweep the cutoff across a whole multiband patch at once",
  }),
  box("chaos-scope", 1474, 1030, 130, 40, TONE.chaos, {
    name: "CHAOS SCOPE",
    what: "choose what chaos may roll: stutters, types, pitch, FX throws",
    tip: "click to open the panel; lit chips are in the dice's pool",
  }),
]

const FX: PanelSpot[] = [
  // comp, shown in its 3-band mode
  box("cmp-auto", 598, 160, 100, 40, TONE.comp, {
    name: "AUTO",
    what: "derives attack and release from the signal itself",
    tip: "leave it on until you specifically want the pumping",
  }),
  box("cmp-ott", 714, 160, 100, 40, TONE.comp, {
    name: "OTT",
    what: "swaps the single-band comp for a 3-band up and down compressor",
    tip: "the loud, forward sound on modern bass and lead patches",
  }),
  box("ott-bands", 60, 222, 756, 310, TONE.comp, {
    name: "BANDS",
    what: "upward and downward compression for the low, mid and high bands",
    tip: "drag a band up or down in the display to set it",
  }),
  knob("ott-depth", 185, 592, TONE.comp, {
    name: "DEPTH",
    what: "how far the multiband compression is pushed",
    tip: "past halfway it stops flattering and starts squashing",
  }, 130),
  knob("ott-time", 437, 592, TONE.comp, {
    name: "TIME",
    what: "scales attack and release across all three bands at once",
    tip: "fast times breathe and pump, slow times simply level",
  }, 130),
  knob("ott-out", 689, 592, TONE.comp, {
    name: "OUT",
    what: "output trim after the multiband stage",
    tip: "OTT adds a lot of level - pull this down to compare fairly",
  }, 130),

  // heat
  box("heat-on", 1554, 160, 100, 40, TONE.heat, {
    name: "HEAT",
    what: "engages the saturation stage",
    tip: "A/B it - saturation flatters almost anything at a low mix",
  }),
  knob("heat-mode", 993, 592, TONE.heat, {
    name: "MODE",
    what: "picks the saturation model, from a clean tube to a hard fuzz",
    tip: "tape and xformer thicken; diode and fuzz destroy",
  }, 130),
  knob("heat-drive", 1181, 592, TONE.heat, {
    name: "DRIVE",
    what: "how hard the signal is pushed into the model",
    tip: "drive high with mix low adds weight without the noise",
  }, 130),
  knob("heat-bias", 1369, 592, TONE.heat, {
    name: "BIAS",
    what: "shifts the signal off-centre for asymmetric, even-order warmth",
    tip: "small amounts add valve character, large amounts start to gate",
  }, 130),
  knob("heat-mix", 1557, 592, TONE.heat, {
    name: "HEAT MIX",
    what: "blends the saturated signal back against the clean one",
    tip: "parallel saturation keeps transients that full-wet would eat",
  }, 130),

  // delay, shown in its frequency-shifter mode
  box("dly-ping", 598, 750, 100, 40, TONE.delay, {
    name: "PING",
    what: "bounces alternate repeats to the left and right",
    tip: "widens a mono source without moving the dry centre",
  }),
  box("dly-freq", 714, 750, 100, 40, TONE.delay, {
    name: "FREQ",
    what: "swaps the echo for a frequency shifter inside the feedback loop",
    tip: "small shifts build metallic, inharmonic tails",
  }),
  box("dly-time", 60, 1154, 164, 48, TONE.delay, {
    name: "TIME",
    what: "echo spacing, locked to the host tempo",
    tip: "1/8 under a 1/16 gate drops the repeats between the chops",
  }),
  box("dly-mode", 60, 1210, 164, 44, TONE.delay, {
    name: "DELAY FEEL",
    what: "straight, triplet or dotted spacing for the echoes",
    tip: "dotted 1/8 is the stadium delay everyone knows",
  }),
  knob("dly-fb", 311, 1182, TONE.delay, {
    name: "FEEDBACK",
    what: "how much of each echo is fed back in to make the next one",
    tip: "past 80% it runs away - ride the tone knob to tame it",
  }, 130),
  knob("dly-tone", 455, 1182, TONE.delay, {
    name: "TONE",
    what: "darkens or brightens each successive repeat",
    tip: "roll it dark so long tails sit behind the dry signal",
  }, 130),
  knob("dly-mix", 599, 1182, TONE.delay, {
    name: "DELAY MIX",
    what: "level of the echoes against the input",
    tip: "keep it low and let feedback do the work",
  }, 130),
  knob("dly-shift", 743, 1182, TONE.delay, {
    name: "SHIFT",
    what: "how far each repeat is frequency-shifted, in hertz",
    tip: "a couple of hertz drifts the tail slowly out of tune",
  }, 130),

  // reverb
  box("rv-shimmer", 1554, 750, 100, 40, TONE.verb, {
    name: "SHIMMER",
    what: "feeds a pitch-shifted copy of the tail back into the reverb",
    tip: "the sound of a choir appearing out of a held pad",
  }),
  knob("rv-size", 962, 1183, TONE.verb, {
    name: "SIZE",
    what: "size of the space, from a booth to a canyon",
    tip: "small sizes at high mix read as ambience rather than reverb",
  }, 118),
  knob("rv-decay", 1088, 1183, TONE.verb, {
    name: "DECAY",
    what: "how long the tail takes to fade away",
    tip: "long decay under a fast gate turns pads into rhythm",
  }, 118),
  knob("rv-damp", 1214, 1183, TONE.verb, {
    name: "DAMP",
    what: "how quickly the highs disappear from the tail",
    tip: "damp hard to sit a big reverb behind a busy mix",
  }, 118),
  knob("rv-pre", 1340, 1183, TONE.verb, {
    name: "PRE",
    what: "delay before the reverb blooms",
    tip: "raise it to keep the tail off the transient",
  }, 118),
  knob("rv-mix", 1466, 1183, TONE.verb, {
    name: "REVERB MIX",
    what: "level of the reverb against the dry signal",
    tip: "put a lane on it for stutter-fed reverb throws",
  }, 118),
  knob("rv-pitch", 1592, 1183, TONE.verb, {
    name: "SHIMMER PITCH",
    what: "interval the shimmer voice is transposed by",
    tip: "+12 is the classic; -12 gets a dark, subterranean tail",
  }, 118),
]

export const SHFT_PANEL: Panel = {
  idle: "hover any control to see what it does - click fx to open the effects page",
  idleTouch: "tap any control to see what it does",
  views: [
    {
      id: "seq",
      label: "Seq",
      shot: {
        src: "/shft/tour-seq.webp",
        alt: "shft's sequencer page: eight lanes, the 16-step strip, and the gate, granular, filter, timing and chaos knobs",
        width: 1758,
        height: 1454,
      },
      spots: [...HEADER, ...SEQ],
    },
    {
      id: "fx",
      label: "FX",
      shot: {
        src: "/shft/tour-fx.webp",
        alt: "shft's FX page: compressor in 3-band OTT mode, heat, delay in frequency-shifter mode, and reverb",
        width: 1758,
        height: 1454,
      },
      spots: [...HEADER, ...FX],
    },
  ],
}
