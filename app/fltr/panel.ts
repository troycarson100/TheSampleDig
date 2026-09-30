// The hero panel for fltr: the plugin with each of its nine characters
// running, and what the help bar says about each control on it.
//
// fltr is one page, not several, so there are no page tabs to click through.
// What changes the whole panel is the character - the nine cells in the FILTER
// module - so those are the doors: each opens a screenshot of the plugin with
// that character running, in the colour the plugin turns for it.
//
// Positions are measured, not read off by eye. The interface is a web page
// (design/sift-ui.html in the plugin's repo), so every box below is that
// page's own getBoundingClientRect at the editor's 1280x748, with the same
// character, routing and Push tab selected as in the screenshot. `at` turns
// one into the screenshot's pixels.
//
// The screenshots came in at slightly different crops and scales (within half
// a percent). Each was lined up with the editor's frame before it was saved,
// which is why all nine are 1986x1150 and one set of numbers fits them.
//
// The words are the plugin's own wherever it has them: the tooltips on the
// Push tabs, the morph types, and the notes beside each field in the design
// file. One thing is newer in the screenshots than in the source they were
// checked against: FM's RATIO, on the sem and comb views, is described from
// what the panel shows. They are a first draft, and the plugin is the thing to
// check them against.
import type { Panel, PanelSpot, PanelView } from "@/components/plugin-page/types"

type Text = { name: string; what: string; tip?: string }
/** left, top, width, height - in the editor's own pixels, at 1280x748. */
type Box = readonly [number, number, number, number]

const SHOT = { width: 1986, height: 1150 }
/** The screenshots are the editor at 2000 wide, less a 6px trim all round. */
const SCALE = 2000 / 1280
const TRIM = 6

const at = ([l, t, w, h]: Box): PanelSpot["at"] => ({
  x: Math.round(((l + w / 2) * SCALE - TRIM) * 10) / 10,
  y: Math.round(((t + h / 2) * SCALE - TRIM) * 10) / 10,
  w: Math.round(w * SCALE * 10) / 10,
  h: Math.round(h * SCALE * 10) / 10,
})

const spot = (id: string, box: Box, text: Text, opens?: string): PanelSpot => ({
  id, at: at(box), ...text, ...(opens ? { opens } : {}),
})

/* ---- the header --------------------------------------------------------- */

const HEADER: PanelSpot[] = [
  spot("preset-prev", [138.4, 18.5, 30, 28], {
    name: "PREVIOUS PRESET",
    what: "steps back to the preset before this one",
  }),
  spot("preset", [174.4, 34.5, 129, 18], {
    name: "PRESET",
    what: "the name opens the browser - search, folders, save and save as",
    tip: "presets are plain files in a folder, so they can be moved and shared",
  }),
  spot("preset-save", [258.5, 12.5, 18, 18], {
    name: "SAVE",
    what: "saves the sound as it stands",
  }),
  spot("preset-next", [314.6, 18.5, 30, 28], {
    name: "NEXT PRESET",
    what: "steps on to the next preset",
  }),
  spot("roll-all", [589.4, 2.5, 20, 18], {
    name: "ROLL",
    what: "randomises both sides and the morph type at once",
    tip: "the dice beside A and B roll one side and leave the other",
  }),
  spot("morph-type", [617.4, 2.5, 60.3, 18], {
    name: "MORPH TYPE",
    what: "how A becomes B - blend, morph, follow, weave, random or split",
    tip: "split puts A below a crossover and B above it",
  }),
  spot("roll-a", [460, 29.5, 22, 22], {
    name: "ROLL A",
    what: "randomises side A and leaves B as it is",
  }),
  spot("slot-a", [489, 28.5, 24, 24], {
    name: "A",
    what: "one of two complete sounds - click to edit this one",
    tip: "right-click the bar to copy one side to the other, or swap them",
  }),
  spot("morph", [520, 25.5, 240, 30], {
    name: "MORPH",
    what: "slides from sound A to sound B",
    tip: "drop a modulation tab on it and the morph moves by itself",
  }),
  spot("slot-b", [767, 28.5, 24, 24], {
    name: "B",
    what: "the second sound, with its own character and settings",
  }),
  spot("roll-b", [798, 29.5, 22, 22], {
    name: "ROLL B",
    what: "randomises side B and leaves A as it is",
  }),
  spot("mix", [968.4, 22.5, 166.6, 20], {
    name: "MIX",
    what: "the dry signal against the filtered one",
    tip: "a modulation tab can be dropped here too",
  }),
  spot("mix-global", [1144, 24.5, 16, 16], {
    name: "GLOBAL MIX",
    what: "one mix for A and B - off, each side keeps its own",
  }),
  spot("undo", [1177, 19, 27, 27], { name: "UNDO", what: "takes back the last change" }),
  spot("redo", [1207, 19, 27, 27], { name: "REDO", what: "puts it back" }),
  spot("settings", [1237, 19, 27, 27], {
    name: "SETTINGS",
    what: "quality, output trim and auto-gain - the housekeeping, kept off the panel",
  }),
]

/* ---- the display -------------------------------------------------------- */

const CUTOFF: Text = {
  name: "CUTOFF",
  what: "where the filter sits",
  tip: "modulation on it is measured in semitones, so a depth is the same distance anywhere",
}
const RESONANCE: Text = {
  name: "RESONANCE",
  what: "how hard the filter rings at the cutoff",
  tip: "past half, with tune on, the ring is a note in your scale",
}

const display = (cutoff: Text = CUTOFF, resonance: Text = RESONANCE, pad?: Text): PanelSpot[] => [
  // Below the readouts, so the two never overlap: the dot lives down here.
  spot("pad", [16, 135, 1248, 217.7], pad ?? {
    name: "THE PAD",
    what: "drag the dot - across for cutoff, up for resonance",
    tip: "the bright curve is what you hear; the ghost behind it is what you set",
  }),
  spot("cutoff", [34, 93, 104, 35], cutoff),
  spot("key", [152, 93, 56, 35], {
    name: "KEY",
    what: "the note the filter is ringing on - free until tune is on and resonance is past half",
  }),
  spot("resonance", [222, 93, 74, 35], resonance),
  spot("routing", [310, 93, 96, 35], {
    name: "ROUTING",
    what: "how the cores are wired, and how many are running",
  }),
  spot("tune", [1197.2, 93, 48.8, 24], {
    name: "TUNE",
    what: "snaps the cutoff to the nearest note of the scale",
    tip: "sweep the filter and it plays in key",
  }),
]

/* ---- shape, per character ----------------------------------------------- */

const SHAPE_BOX: Box = [25, 398.7, 206.7, 268]
/** The strip of marks under the curve: three, four or five of them, always
    across the same span. */
const MARKS_BOX: Box = [33, 672, 190.7, 17]
const shape = (screen: Text, strip: Text): PanelSpot[] => [
  spot("shape-on", [27, 375.2, 13, 13], { name: "SHAPE ON", what: "takes shape out of the path and puts it back" }),
  spot("shape", SHAPE_BOX, screen),
  spot("shape-marks", MARKS_BOX, strip),
  spot("shape-name", [16, 696, 224.7, 36], {
    name: "SHAPE NAME",
    what: "where shape is sitting, in words",
  }),
]

/* ---- drive -------------------------------------------------------------- */

const DRIVE: PanelSpot[] = [
  spot("drive-on", [263.7, 375.2, 13, 13], { name: "DRIVE ON", what: "takes drive out of the path and puts it back" }),
  spot("drive", [261.7, 398.7, 198.9, 297.3], {
    name: "DRIVE",
    what: "the saturation curve - what comes out, against what went in",
    tip: "auto-gain holds the level, so more drive is more colour and not more volume",
  }),
  spot("drive-vu", [467.7, 398.7, 22, 297.3], {
    name: "DRIVE LEVEL",
    what: "a meter you can drag - it sets the amount",
  }),
  spot("drive-type", [252.7, 706, 80, 17], {
    name: "TYPE",
    what: "soft, transistor or fold",
  }),
  spot("drive-pos", [335.7, 706, 80, 17], {
    name: "POSITION",
    what: "drive before the filter, or after it",
    tip: "before, the filter smooths the grit; after, the grit is what you hear",
  }),
  spot("drive-amount", [418.7, 706, 80, 17], {
    name: "AMOUNT",
    what: "how hard the signal is pushed into the curve",
  }),
]

/* ---- filter ------------------------------------------------------------- */

/** The nine characters, each a door to the screenshot of itself. */
const CHARACTERS: PanelSpot[] = [
  spot("char-ladder", [519.7, 506.7, 66.9, 51.8], {
    name: "LADDER",
    what: "a Moog-style ladder",
    tip: "see the panel with a ladder running",
  }, "ladder"),
  spot("char-sem", [589.6, 506.7, 66.9, 51.8], {
    name: "SEM",
    what: "two poles throughout, so the slope never changes",
    tip: "see the panel with the sem running",
  }, "sem"),
  spot("char-fold", [659.5, 506.7, 66.9, 51.8], {
    name: "FOLD",
    what: "a filter whose resonance folds back on itself",
    tip: "see the panel with fold running",
  }, "fold"),
  spot("char-comb", [519.7, 561.4, 66.9, 51.8], {
    name: "COMB",
    what: "a tuned comb - it rings at the cutoff's pitch",
    tip: "see the panel with the comb running",
  }, "comb"),
  spot("char-formant", [589.6, 561.4, 66.9, 51.8], {
    name: "FORMANT",
    what: "a filter that speaks in vowels",
    tip: "see the panel with formant running",
  }, "formant"),
  spot("char-phase", [659.5, 561.4, 66.9, 51.8], {
    name: "PHASE",
    what: "a phaser, from four sections to twelve",
    tip: "see the panel with the phaser running",
  }, "phase"),
  spot("char-chord", [519.7, 616.2, 66.9, 51.8], {
    name: "CHORD",
    what: "snaps what passes through onto the notes of a chord in your key",
    tip: "see the panel with chord running",
  }, "chord"),
  spot("char-harmony", [589.6, 616.2, 66.9, 51.8], {
    name: "HARMONY",
    what: "rings a chord in your key through a bank of resonators",
    tip: "see the panel with harmony running",
  }, "harmony"),
  spot("char-shift", [659.5, 616.2, 66.9, 51.8], {
    name: "SHIFT",
    what: "a frequency shifter",
    tip: "see the panel with the shifter running",
  }, "shift"),
]

const SPREAD: Text = {
  name: "SPREAD",
  what: "sets the second core apart from the first, up to two octaves either way",
}
const RES_COMP: Text = {
  name: "RES COMP",
  what: "gives back the bass that resonance takes away",
  tip: "most of what reads as a thin resonance is the low end going missing",
}
const WIDTH: Text = {
  name: "WIDTH",
  what: "pulls the left ear's filter up and the right one's down, so each hears its own peak",
}

const ROUTES = "single, series, parallel, split left and right, split mid and side, or three band"
const routing = (tip: string): PanelSpot[] => [
  spot("topology", [519.7, 469.7, 206.8, 30], { name: "ROUTING", what: ROUTES, tip }),
]
const ONE_CORE = "single runs one core, which is why spread is struck through below"
const TWO_CORES = "two cores are running here, so spread has something to pull apart"

/** `row` is what sits between the stages and the characters: the routing
    buttons, or for chord its mode and window. */
const filter = (row: PanelSpot[], footer: PanelSpot[]): PanelSpot[] => [
  spot("filter-on", [521.7, 375.2, 13, 13], { name: "FILTER ON", what: "takes the filter out of the path and puts it back" }),
  spot("stages", [519.7, 398.7, 206.8, 64], {
    name: "STAGES",
    what: "the curve of each core on its own, before they are combined",
  }),
  ...row,
  ...CHARACTERS,
  ...footer,
]

/** The footer most characters share, on one line: spread, res comp, width. */
const threeFields = (spreadTip?: string): PanelSpot[] => [
  spot("core-spread", [510.7, 697, 72.9, 17], spreadTip ? { ...SPREAD, tip: spreadTip } : SPREAD),
  spot("core-rescomp", [586.6, 697, 72.9, 17], RES_COMP),
  spot("core-width", [662.5, 697, 72.9, 17], WIDTH),
]
/** The same with a field of the character's own, which takes width's place on
    the first line and sends it to a second. */
const fourFields = (own: PanelSpot, spreadTip?: string): PanelSpot[] => [
  spot("core-spread", [510.7, 688, 72.9, 17], spreadTip ? { ...SPREAD, tip: spreadTip } : SPREAD),
  spot("core-rescomp", [586.6, 688, 72.9, 17], RES_COMP),
  own,
  spot("core-width", [510.7, 706, 224.8, 17], WIDTH),
]
const NO_SECOND_CORE = "struck through here - single routing has no second core"

/* ---- modulate ----------------------------------------------------------- */

const MODULATE: PanelSpot[] = [
  spot("mod-on", [758.4, 375.2, 13, 13], { name: "MODULATE ON", what: "stops all four sources and starts them again" }),
  spot("tab-follow", [758.4, 400.7, 60.8, 22], {
    name: "FOLLOW",
    what: "an envelope follower - the level of the sound moves the control",
    tip: "drag the tab onto anything; a chip appears there with the depth",
  }),
  spot("tab-move", [821.3, 400.7, 60.8, 22], {
    name: "MOVE",
    what: "an LFO, free or in time - sine, triangle, saw, square, random or sample and hold",
  }),
  spot("tab-draw", [884.1, 400.7, 60.8, 22], {
    name: "DRAW",
    what: "a sequence you draw, 32 steps, that follows the playhead",
    tip: "the same bar sounds the same on every pass",
  }),
  spot("tab-macro", [946.9, 400.7, 60.8, 22], {
    name: "MACRO",
    what: "one hand control, routed to as many places as you like",
  }),
  spot("follow-input", [756.4, 431.7, 189.5, 20], {
    name: "LISTEN TO",
    what: "what follow hears - the input, the sidechain, or the sidechain with its low end taken out",
  }),
  spot("follow-invert", [947.9, 431.7, 61.8, 20], {
    name: "INVERT",
    what: "loud closes what it used to open",
  }),
  spot("mod-screen", [756.4, 458.7, 253.4, 203.3], {
    name: "SOURCE",
    what: "what the source is doing right now, not what it is set to",
  }),
  spot("routes", [756.4, 676, 253.4, 20], {
    name: "ROUTES",
    what: "every place this source is going, and how far",
    tip: "drag a chip sideways to change its depth",
  }),
  spot("follow-atk", [747.4, 697, 88.5, 17], {
    name: "ATTACK",
    what: "how fast follow rises with the sound",
  }),
  spot("follow-rel", [838.9, 697, 88.5, 17], {
    name: "RELEASE",
    what: "how slowly it falls back",
    tip: "a fast attack with a long release is what a follower is for",
  }),
  spot("follow-amt", [930.3, 697, 88.5, 17], {
    name: "AMOUNT",
    what: "gain into the follower, 24 dB either way",
  }),
  spot("follow-curve", [747.4, 715, 271.4, 17], {
    name: "CURVE",
    what: "the shape of its response - linear, log or gate",
  }),
]

/* ---- push --------------------------------------------------------------- */

const PUSH_TABS: PanelSpot[] = [
  spot("push-on", [1041.8, 375.2, 13, 13], { name: "PUSH ON", what: "switches the whole push layer off and on" }),
  spot("push-comp", [1039.8, 398.7, 33, 22], {
    name: "COMP",
    what: "an opto compressor after the filter - it catches a resonant peak without pumping the rest",
  }),
  spot("push-fm", [1074.8, 398.7, 20.5, 22], {
    name: "FM",
    what: "the cutoff modulated at audio rate",
    tip: "focus low for musical sidebands, high for the metallic version",
  }),
  spot("push-feedback", [1097.2, 398.7, 57.9, 22], {
    name: "FEEDBACK",
    what: "the output back into the filter, through a short delay and a saturator",
    tip: "comb rings, spiral climbs or falls for ever, bloom blurs into a wash",
  }),
  spot("push-space", [1157.2, 398.7, 39.2, 22], {
    name: "SPACE",
    what: "echo and reverb on top of the sound, in three models",
  }),
  spot("push-freeze", [1039.8, 422.7, 45.5, 22], {
    name: "FREEZE",
    what: "holds the spectrum and plays it back as a drone",
    tip: "chop gates it in time, each step a different slice of what was caught",
  }),
  spot("push-tune", [1087.2, 422.7, 33, 22], {
    name: "TUNE",
    what: "snaps the cutoff to a scale, and can follow MIDI",
  }),
  spot("push-key", [1122.2, 422.7, 26.7, 22], {
    name: "KEY",
    what: "held MIDI notes become the cutoff's pitch - two voices where a core is free",
  }),
  spot("push-arp", [1150.9, 422.7, 26.7, 22], {
    name: "ARP",
    what: "chord and harmony play the chord one note at a time, in time with the track",
  }),
]

const PUSH_FOOT: PanelSpot[] = [
  spot("foot-scale", [1030.8, 706, 115.1, 17], {
    name: "SCALE",
    what: "one of 14, or one you edit yourself from the keyboard",
  }),
  spot("foot-root", [1148.9, 706, 115.1, 17], {
    name: "ROOT",
    what: "the key - tune, chord and harmony all follow it",
  }),
]

const PUSH_FM: PanelSpot[] = [
  spot("fm-amount", [1044.8, 480.7, 67, 39], { name: "AMOUNT", what: "how far the source swings the cutoff" }),
  spot("fm-focus", [1112.2, 480.7, 67, 39], {
    name: "FOCUS",
    what: "which band of the source drives it",
    tip: "low for the fundamental, high for cymbals",
  }),
  spot("fm-source", [1179.6, 480.7, 70.4, 39], {
    name: "SOURCE",
    what: "the input, the sidechain, or an oscillator of its own",
  }),
  spot("fm-scope", [1044.8, 526, 205.4, 166], {
    name: "FM",
    what: "the modulation, drawn as it happens",
    tip: "drag the dot - up for amount, across for focus",
  }),
]

/** FM as the later screenshots have it: a ratio where focus was, and a fourth
    source. */
const PUSH_FM_RATIO: PanelSpot[] = [
  spot("fm-amount", [1044.8, 480.7, 56, 39], { name: "AMOUNT", what: "how far the modulator swings the cutoff" }),
  spot("fm-ratio", [1102.8, 480.7, 56, 39], {
    name: "RATIO",
    what: "the modulator's pitch against the filter's own note",
    tip: "whole ratios stay in tune with it",
  }),
  spot("fm-source", [1160.8, 480.7, 89.4, 39], {
    name: "SOURCE",
    what: "the input, the sidechain, a free oscillator, or one held to the ratio",
  }),
  spot("fm-scope", [1044.8, 526, 205.4, 166], {
    name: "FM",
    what: "the modulation, drawn as it happens",
    tip: "drag the dot - up for amount, across for ratio",
  }),
]

const PUSH_TUNE: PanelSpot[] = [
  spot("tune-strength", [1044.8, 480.7, 100.5, 39], {
    name: "STRENGTH",
    what: "how firmly the cutoff is pulled to the note",
    tip: "short of full, it leans in key without locking",
  }),
  spot("tune-glide", [1145.9, 480.7, 104.1, 39], { name: "GLIDE", what: "how long it takes to slide from one note to the next" }),
  spot("tune-root", [1044.8, 520.7, 100.5, 39], { name: "ROOT", what: "the key the scale is built on" }),
  spot("tune-lo", [1145.9, 520.7, 104.1, 39], { name: "LIMIT LO", what: "a floor under where the cutoff can sit" }),
  spot("tune-hi", [1044.8, 560.7, 100.5, 39], { name: "LIMIT HI", what: "a ceiling over it" }),
  spot("tune-midi", [1145.9, 560.7, 104.1, 39], {
    name: "MIDI",
    what: "on, tune follows the notes you play",
  }),
  spot("tune-keys", [1044.8, 601, 205.4, 91], {
    name: "KEYBOARD",
    what: "the notes in the scale, lit - click one to take it out or put it in",
  }),
]

const space = (model: string, time: Text, feedback: string, diffuse: string): PanelSpot[] => [
  spot("space-model", [1068, 458, 159, 20], {
    name: "MODEL",
    what: `space, plate or kaleidoscope - this is ${model}`,
    tip: "kaleidoscope is a cascade of echoes that speeds up, each a different colour",
  }),
  spot("space-amount", [1044.8, 488.7, 100.5, 43], { name: "AMOUNT", what: "how much of it is added on top" }),
  spot("space-time", [1145.9, 488.7, 104.1, 43], time),
  spot("space-feedback", [1044.8, 532.7, 100.5, 39], { name: "FEEDBACK", what: feedback }),
  spot("space-diffuse", [1145.9, 532.7, 104.1, 39], { name: "DIFFUSE", what: diffuse }),
  spot("space-scope", [1044.8, 576, 205.4, 116], {
    name: "SPACE",
    what: "the tail as it rings",
    tip: "drag the dot - up for amount, across for time",
  }),
]
const PLATE = space("the plate", { name: "TIME", what: "the plate's size", tip: "S locks it to the track's tempo" }, "how long it carries on", "the plate's tone")
const KALEIDOSCOPE = space("kaleidoscope", { name: "TIME", what: "the first echo - here a dotted quarter, locked to the track by S" }, "how many times it cascades again", "from crisp to a wash")

/* ---- the nine views ------------------------------------------------------ */

type View = {
  id: string
  label: string
  /** The colour the plugin turns with this character; the ring takes it. */
  tone: string
  alt: string
  display?: PanelSpot[]
  shape: [Text, Text]
  row: PanelSpot[]
  footer: PanelSpot[]
  push: PanelSpot[]
}

const view = (v: View): PanelView => ({
  id: v.id,
  label: v.label,
  shot: { src: `/fltr/tour-${v.id}.webp`, alt: v.alt, ...SHOT },
  spots: [
    ...(v.display ?? display()),
    ...HEADER,
    ...shape(...v.shape),
    ...DRIVE,
    ...filter(v.row, v.footer),
    ...MODULATE,
    ...PUSH_TABS,
    ...v.push,
    ...PUSH_FOOT,
  ].map((s) => ({ ...s, tone: v.tone })),
})

const LADDER = view({
  id: "ladder",
  label: "Ladder",
  tone: "#ffb547",
  alt: "fltr with the ladder character running: two resonant peaks in series on the display, above the shape, drive, filter, modulate and push modules",
  shape: [{
    name: "SHAPE",
    what: "morphs the filter from low-pass through band and high to notch, and round again",
    tip: "it slides between them, so halfway is a sound too",
  }, {
    name: "LOW, BAND, HIGH, NOTCH",
    what: "jumps shape straight to one of the four",
  }],
  row: routing(TWO_CORES),
  footer: threeFields(),
  push: PUSH_FM,
})

const SEM = view({
  id: "sem",
  label: "Sem",
  tone: "#3fe0b0",
  alt: "fltr with the sem character running, in green: a single notch on the display and in the shape module",
  shape: [{
    name: "SHAPE",
    what: "the SEM's own mode control - low to notch to high, with band closing the circle",
    tip: "two poles all the way round, so the slope never changes",
  }, {
    name: "LOW, NOTCH, HIGH, BAND",
    what: "jumps shape straight to one of the four",
  }],
  row: routing(ONE_CORE),
  footer: threeFields(NO_SECOND_CORE),
  push: PUSH_FM_RATIO,
})

const FOLD = view({
  id: "fold",
  label: "Fold",
  tone: "#ff6a4d",
  alt: "fltr with the fold character running: a single low-pass rolling off on the display, the shape module showing the resonance folded into a row of teeth",
  shape: [{
    name: "FOLD",
    what: "how many times the resonance folds back on itself",
    tip: "the harmonics grow out of the peak, not out of the signal",
  }, {
    name: "CLEAN, FOLD, RIP, TEAR",
    what: "the four places where the sound changes character",
  }],
  row: routing(ONE_CORE),
  footer: fourFields(spot("core-sym", [662.5, 688, 72.9, 17], {
    name: "SYMMETRY",
    what: "the folder's bias, which is where the even harmonics come from",
  }), NO_SECOND_CORE),
  push: PUSH_TUNE,
})

const COMB = view({
  id: "comb",
  label: "Comb",
  tone: "#3fd8e6",
  alt: "fltr with the comb character running, in cyan: one resonant peak on the display, drive pushed hard, and move routed to shape",
  shape: [{
    name: "TONE",
    what: "the comb's tone, from dark through warm and bright to air",
  }, {
    name: "DARK, WARM, BRIGHT, AIR",
    what: "jumps tone straight to one of the four",
  }],
  row: routing(ONE_CORE),
  footer: fourFields(spot("core-polarity", [662.5, 688, 72.9, 17], {
    name: "POLARITY",
    what: "the sign of the comb's feedback",
    tip: "minus cancels the even harmonics - an octave down, and hollow",
  }), NO_SECOND_CORE),
  push: PUSH_FM_RATIO,
})

const FORMANT = view({
  id: "formant",
  label: "Formant",
  tone: "#ffc94d",
  alt: "fltr with the formant character running, in amber: a vowel peak on the display with the notes of the scale as lines behind it",
  shape: [{
    name: "VOWEL",
    what: "walks the vowels - oo, oh, ah, eh, ee",
    tip: "back of the mouth to the front, with no cliff on the way",
  }, {
    name: "U, O, A, E",
    what: "jumps straight to a vowel",
  }],
  row: routing("single runs one core"),
  footer: threeFields(),
  push: KALEIDOSCOPE,
})

const PHASE = view({
  id: "phase",
  label: "Phase",
  tone: "#9d7bff",
  alt: "fltr with the phase character running, in violet: two pairs of peaks across the display, six sections in the shape module",
  shape: [{
    name: "NOTCHES",
    what: "how many all-pass sections are in the chain, from 4 to 12",
    tip: "it is the density of the notches, not a filter mode",
  }, {
    name: "4 POLE, 6, 8, 10",
    what: "jumps straight to a number of sections",
  }],
  row: routing("single runs one core"),
  footer: threeFields(),
  push: KALEIDOSCOPE,
})

const CHORD = view({
  id: "chord",
  label: "Chord",
  tone: "#8d8bff",
  alt: "fltr with the chord character running: a triad drawn as a stack of partials in the shape module, with chord's snap and window buttons in the filter module",
  shape: [{
    name: "VOICING",
    what: "how many notes the chord has - fifths, a triad, a seventh, or the whole scale",
  }, {
    name: "5THS, TRIAD, 7TH, SCALE",
    what: "jumps straight to a voicing",
  }],
  row: [
    spot("chord-mode", [519.7, 469.7, 63.9, 30], {
      name: "SNAP, CONFORM",
      what: "snap puts every partial on the scale's own chord; conform roots the chord on the note it hears",
      tip: "conform follows the part",
    }),
    spot("chord-window", [595.6, 469.7, 130.8, 30], {
      name: "WINDOW",
      what: "512 to 4096 points - a longer one resolves pitch better and time worse",
      tip: "4k resolves a bass harmonic series; 512 keeps the transients",
    }),
  ],
  footer: [
    spot("core-chord", [510.7, 679, 72.9, 17], {
      name: "CHORD",
      what: "which chord of the key, I to VII",
      tip: "a chord progression is this one field, automated",
    }),
    spot("core-decay", [586.6, 679, 72.9, 17], { name: "DECAY", what: "how long the chord rings on" }),
    spot("core-pull", [662.5, 679, 72.9, 17], {
      name: "PULL",
      what: "from snapping notes onto the chord to bending them towards it",
      tip: "anything short of full is most of what stops it sounding mechanical",
    }),
    spot("core-gate", [510.7, 697, 72.9, 17], {
      name: "GATE",
      what: "how loud a partial has to be before it is let through to ring",
    }),
    spot("core-wave", [586.6, 697, 72.9, 17], {
      name: "WAVE",
      what: "the notes as oscillators - sine, triangle, square or saw",
    }),
    spot("core-power", [662.5, 697, 72.9, 17], {
      name: "POWER",
      what: "lifts each note's ring against its own peak",
    }),
    spot("core-ott", [510.7, 715, 224.8, 17], {
      name: "OTT",
      what: "squashes the chord forward in three bands",
    }),
  ],
  push: KALEIDOSCOPE,
})

const HARMONY = view({
  id: "harmony",
  label: "Harmony",
  tone: "#ff6b7d",
  alt: "fltr with the harmony character running: the notes of the scale as lines down the display, a ninth chord in the shape module, and a plate reverb in push",
  shape: [{
    name: "VOICING",
    what: "how many notes the chord has, from bare fifths to an eleventh",
  }, {
    name: "5THS, TRIAD, 7TH, 9TH, 11TH",
    what: "jumps straight to a voicing",
  }],
  row: routing("split mid and side here - the middle and the edges each get a filter"),
  footer: [
    spot("core-chord", [510.7, 679, 72.9, 17], {
      name: "CHORD",
      what: "which chord of the key, I to VII",
      tip: "a chord progression is this one field, automated",
    }),
    spot("core-decay", [586.6, 679, 72.9, 17], { name: "DECAY", what: "how long the chord rings on" }),
    spot("core-warp", [662.5, 679, 72.9, 17], {
      name: "WARP",
      what: "stretches the chord's notes apart, further with each octave",
    }),
    spot("core-tone", [510.7, 697, 72.9, 17], { name: "TONE", what: "tilts the chord dark or bright" }),
    spot("core-detune", [586.6, 697, 72.9, 17], { name: "DETUNE", what: "sets the voices slightly off each other" }),
    spot("core-wave", [662.5, 697, 72.9, 17], {
      name: "WAVE",
      what: "the notes as oscillators - sine, triangle, square or saw",
    }),
    spot("core-power", [510.7, 715, 110.9, 17], {
      name: "POWER",
      what: "lifts each note's ring against its own peak",
    }),
    spot("core-ott", [624.5, 715, 110.9, 17], {
      name: "OTT",
      what: "squashes the chord forward in three bands",
    }),
  ],
  push: PLATE,
})

const SHIFT = view({
  id: "shift",
  label: "Shift",
  tone: "#ff5a8c",
  alt: "fltr with the shift character running, in pink: every frequency moved down by 12 Hz, the left and right sides split",
  // A shifter has no cutoff and no resonance, and the readouts say so.
  display: display({
    name: "SHIFT",
    what: "how far every frequency is moved, in Hz",
    tip: "a few Hz beats like a slow phaser; hundreds turn a chord into a bell",
  }, {
    name: "REGEN",
    what: "feedback round the shifter, which is what makes it spiral",
  }, {
    name: "THE PAD",
    what: "drag the dot - across for the shift, up for regen",
  }),
  shape: [{
    name: "DIRECTION",
    what: "which way it shifts - down, both sidebands at once, or up",
  }, {
    name: "DOWN, BOTH, UP",
    what: "the three settings that are exactly one thing",
  }],
  row: routing("the shifter is one path - spread is what pulls its two ears apart"),
  footer: [
    spot("core-regen", [510.7, 697, 72.9, 17], {
      name: "REGEN",
      what: "feedback round the shifter - the same control as the pad's up and down",
    }),
    spot("core-spread", [586.6, 697, 72.9, 17], {
      name: "SPREAD",
      what: "pulls the two ears apart, left up and right down, so they beat",
    }),
    spot("core-rescomp", [662.5, 697, 72.9, 17], RES_COMP),
  ],
  push: PLATE,
})

export const FLTR_PANEL: Panel = {
  theme: { ground: "#0b0c13", ink: "#eef0f6", accent: "#4ade9b" },
  idle: "hover any control to see what it does - click a character in FILTER to see it running",
  idleTouch: "tap any control to see what it does",
  // In the grid's own order, which is the order the page buttons take.
  views: [LADDER, SEM, FOLD, COMB, FORMANT, PHASE, CHORD, HARMONY, SHIFT],
}
