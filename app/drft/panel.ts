// The hero panel for drft: the four pages of the plugin, and what the help bar
// says about each control on them.
//
// drft has no help table of its own to copy from - its bottom strip is a
// caption, not a per-control readout - so these are drawn from the manual
// (CRTV/manual/drft-manual.html), in its words wherever a sentence of it fits
// the bar. They are a first draft of what the manual already says, and the
// manual is the thing to check them against.
//
// The screenshots are the manual's own figures, rendered headlessly from the
// real editor at v1.1.3 and all 1700x1316, so a spot can be read straight off
// any of them. The pages share one chassis: the header bridge, the tube, the
// level stack on the right and the page tabs sit in the same place on each,
// which is why they are one list. Only the left column and the knob row
// change.
//
// PAINT is the FIELD tab's second page, reached in the plugin by the round P
// key - and reached here the same way.
import type { Panel, PanelSpot } from "@/components/plugin-page/types"

type Text = { name: string; what: string; tip?: string }

const knob = (id: string, x: number, y: number, t: Text, size = 130): PanelSpot => ({
  id, at: { x, y, w: size, h: size }, round: true, ...t,
})
/** A box from its centre, which is how the header's keys are read off. */
const key = (id: string, x: number, y: number, w: number, h: number, t: Text, opens?: string): PanelSpot => ({
  id, at: { x, y, w, h }, ...t, ...(opens ? { opens } : {}),
})

const CHASSIS: PanelSpot[] = [
  // First, so everything else sits on top of it.
  key("tube", 850, 567, 1620, 935, {
    name: "THE TUBE",
    what: "a true 16:9 CRT - what you see on it is what gets recorded",
    tip: "drop an image or a video onto it to swap the source",
  }),
  key("power", 277, 49, 44, 46, {
    name: "POWER",
    what: "the TV switch - off bypasses drft, click-free and latency-matched",
    tip: "the tube collapses to a line, then an afterglow dot, like a real set",
  }),
  key("settings", 329, 49, 44, 46, {
    name: "SETTINGS",
    what: "opens the settings sheet",
    tip: "turn screen text off here before recording anything you mean to use as footage",
  }),
  key("rec", 402, 49, 54, 46, {
    name: "REC",
    what: "records what is on the tube together with the audio that made it, as an MP4",
    tip: "park the mouse off the panel first - the knob readouts are part of the picture",
  }),
  key("aspect", 466, 49, 54, 46, {
    name: "ASPECT",
    what: "cycles the frame: 16:9, vertical 9:16, or the 2.75:1 ultrawide strip",
    tip: "it changes what you see and what you export",
  }),
  key("presets", 741, 49, 320, 46, {
    name: "PRESETS",
    what: "the arrows step through the bank; clicking the name opens the menu",
    tip: "factory patches set the six character knobs only",
  }),
  key("speed", 951, 49, 48, 42, {
    name: "TAPE SPEED",
    what: "runs the transport slower - lp drops two semitones, ep five",
    tip: "the shift glides in, so throwing it sounds like a deck spinning down",
  }),
  key("feed", 1072, 49, 62, 42, {
    name: "FEED",
    what: "reverses the flow - whatever is on the tube starts bending the audio",
    tip: "saturated colour drives burn; dark footage pours on haze and hiss",
  }),
  key("load", 1162, 49, 68, 46, {
    name: "LOAD",
    what: "loads an image, an animated GIF or a video onto the tube",
    tip: "or drop the file straight onto the screen",
  }),
  key("src", 1247, 49, 80, 42, {
    name: "SRC",
    what: "cycles the picture source: field, media, live, or the field blended over either",
    tip: "in the blend sources, the BLEND fader on the FIELD page sets the key",
  }),
  key("ch", 1316, 49, 42, 42, {
    name: "CH",
    what: "brings up a VCR-style channel list of every camera your machine can see",
    tip: "click a channel to tune it; your choice is remembered",
  }),
  key("wave", 1377, 49, 60, 42, {
    name: "WAVE",
    what: "toggles the oscilloscope trace over the picture",
    tip: "off is usually what you want once you are recording footage for its own sake",
  }),
  key("meter", 1548, 50, 226, 78, {
    name: "METER",
    what: "26 segments a channel, reading the peaks after the master",
    tip: "unlit segments stay visible, the way a real deck's dead LEDs do",
  }),
  key("input", 1545, 1075, 186, 62, {
    name: "INPUT",
    what: "trims what goes into the machine",
    tip: "pull it down when a hot source is driving the shaper further than you want",
  }),
  key("output", 1545, 1145, 186, 62, {
    name: "OUTPUT",
    what: "the master trim",
    tip: "G, beside the faders, holds it at the level the input arrived at",
  }),
  key("mix", 1545, 1215, 186, 62, {
    name: "MIX",
    what: "dry against wet, with the dry copy delayed to match the wet path",
    tip: "halfway is a genuine blend rather than a phase-cancelled mess",
  }),
  key("gain-match", 1422, 1229, 38, 38, {
    name: "GAIN MATCH",
    what: "holds the output at the level the input arrived at",
    tip: "so bypassing compares the character and nothing else",
  }),
  key("dice", 59, 1250, 48, 42, {
    name: "DICE",
    what: "randomises the six character knobs within musical ranges",
    tip: "it lands somewhere usable rather than somewhere absurd",
  }),
  key("tab-sound", 128, 1250, 72, 40, {
    name: "SOUND",
    what: "the machine - six knobs, bass mono, mix and out",
    tip: "open the sound page",
  }, "sound"),
  key("tab-field", 204, 1250, 72, 40, {
    name: "FIELD",
    what: "the picture - style and six shaping knobs, across two pages",
    tip: "open the field page",
  }, "field"),
  key("tab-circuit", 299, 1250, 104, 40, {
    name: "CIRCUIT",
    what: "the other two pages make a picture - this one breaks the set that is showing it",
    tip: "open the circuit page",
  }, "circuit"),
]

const SOUND: PanelSpot[] = [
  key("bass-mono", 197, 1090, 214, 80, {
    name: "BASS MONO",
    what: "folds the low end to mono below the crossover, so the widening never hollows it out",
    tip: "the headphone key solos what is being folded",
  }),
  key("bloom", 197, 1172, 214, 64, {
    name: "BLOOM",
    what: "a wide, mono-safe ensemble with a driven air band, last in the wet chain",
    tip: "the picture blooms with it - each frame smears into the next",
  }),
  knob("burn", 431, 1148, {
    name: "BURN",
    what: "drive and heat - thickens, then compresses, then distorts",
    tip: "the tube follows it, from icy blue at zero to molten orange-red",
  }),
  knob("drift", 595, 1148, {
    name: "DRIFT",
    what: "wow and flutter - pitch instability from a slow wow to a seasick warble",
    tip: "the knob that makes something sound like tape rather than distortion",
  }),
  knob("bend", 782, 1148, {
    name: "BEND",
    what: "the macro - bit-starves the signal until it grinds, and tears the picture with it",
    tip: "reach for it first: low is a crunch, past halfway the machine starts failing",
  }, 178),
  knob("dropout", 968, 1148, {
    name: "DROPOUT",
    what: "tape failures - the signal ducks while a dull frozen slice smears underneath",
    tip: "the picture tears on the same events, at the same instant",
  }),
  knob("wash", 1131, 1148, {
    name: "WASH",
    what: "haze and width - pushes the signal back and out, like a generation-loss copy",
    tip: "static speckle on the tube, and a lift in the overall haze",
  }),
  knob("noise", 1295, 1148, {
    name: "NOISE",
    what: "the hiss bed - it breathes with the material, and goes silent when the track does",
    tip: "audio only: the one knob the picture does not follow",
  }),
]

const SHAPING = {
  hue: { name: "HUE", what: "rotates the palette", tip: "shapes recolour independently of one another - TINT turns them all as one" },
  glow: { name: "GLOW", what: "phosphor bloom on the field itself" },
  tint: {
    name: "TINT",
    what: "rotates every colour on the tube together, keeping their relationships",
    tip: "the only bipolar knob on the page, so it is centre-detented at 12 o'clock",
  },
  blend: {
    name: "BLEND",
    what: "the luma key in the blend sources - how far the field burns through your footage",
    tip: "it works from the shadows up; in the plain sources it is dimmed, as it is here",
  },
} satisfies Record<string, Text>

const FIELD: PanelSpot[] = [
  key("style", 197, 1104, 196, 66, {
    name: "STYLE",
    what: "picks the generator - 23 of them, genuinely different pieces of maths",
    tip: "flow, plasma, tunnel, kaleido, aurora, caustic, cells, mandala and more",
  }),
  key("blend", 197, 1176, 196, 62, SHAPING.blend),
  knob("hue", 432, 1148, SHAPING.hue),
  knob("flow", 596, 1148, {
    name: "FLOW",
    what: "how fast the field moves",
    tip: "tape speed drags it along - at ep the picture visibly runs slower",
  }),
  knob("zoom", 782, 1148, { name: "ZOOM", what: "scale - from wide and detailed to close and abstract" }, 178),
  knob("follow", 969, 1148, {
    name: "FOLLOW",
    what: "how hard the picture rides the music",
    tip: "bass breathes the zoom, mids swell the warp, and the palette leans with the material",
  }),
  knob("bands", 1133, 1148, { name: "BANDS", what: "density of the field's banding" }),
  knob("glow", 1297, 1148, SHAPING.glow),
  knob("tint", 1388, 1084, SHAPING.tint, 64),
  key("paint", 74, 1121, 38, 38, {
    name: "PAINT",
    what: "flips the FIELD tab over - from a texture you tune to a canvas you play",
    tip: "open the paint page",
  }, "paint"),
  key("endless", 326, 1121, 38, 38, {
    name: "ENDLESS ZOOM",
    what: "the field falls inward forever, with no seam and no restart",
  }),
]

const PAINT: PanelSpot[] = [
  key("style", 197, 1104, 196, 66, {
    name: "SET",
    what: "chooses what an onset stamps - rings, blobs, bars, glyphs, marble or silk",
    tip: "marble drops ink that pushes all the existing paint outward into nested contours",
  }),
  key("blend", 197, 1176, 196, 62, SHAPING.blend),
  knob("hue", 432, 1148, SHAPING.hue),
  knob("flow", 596, 1148, {
    name: "FLOW",
    what: "the rate of the whole feedback transform - how fast history turns and drifts away",
  }),
  knob("zoom", 782, 1148, {
    name: "ZOOM",
    what: "how far the buffer scales each frame - what makes marks travel inward or outward",
  }, 178),
  knob("follow", 969, 1148, {
    name: "FOLLOW",
    what: "trigger sensitivity - how much of the track counts as an onset",
    tip: "paint responds to transients, not to level: a dry drum loop draws constantly",
  }),
  knob("bands", 1133, 1148, {
    name: "BANDS",
    what: "kaleidoscope symmetry order - the picture folds into that many repeats",
    tip: "at the bottom of its travel symmetry is off and the canvas is free",
  }),
  knob("glow", 1297, 1148, SHAPING.glow),
  knob("tint", 1388, 1084, SHAPING.tint, 64),
  // Under the same id as the key that led here, so the bar stays on it.
  key("paint", 74, 1121, 38, 38, {
    name: "PAINT",
    what: "lit means paint - what you played a few seconds ago is still up there",
    tip: "back to the flow generators",
  }, "field"),
  key("endless", 326, 1121, 38, 38, {
    name: "FOLD",
    what: "on this page the E key is a kaleidoscope fold rather than the endless zoom",
  }),
]

const CIRCUIT: PanelSpot[] = [
  key("circuit-power", 125, 1122, 48, 48, {
    name: "POWER",
    what: "bypasses every effect on this page while keeping all your settings",
    tip: "see what the bank is doing without touching a knob",
  }),
  key("depth", 262, 1106, 196, 66, {
    name: "DEPTH",
    what: "a master amount over all six knobs at once",
    tip: "ride it to bring the whole bank in and out on one automation lane",
  }),
  key("ghost", 258, 1176, 196, 62, {
    name: "GHOST",
    what: "multipath - a weaker copy of the picture, offset to the right",
    tip: "it sits outside DEPTH: pull DEPTH to zero and the ghost is still there",
  }),
  knob("yoke", 432, 1148, {
    name: "YOKE",
    what: "a failing deflection coil - the raster pins and bows, breathing as it goes",
    tip: "at the top of its travel it collapses toward a single bright line",
  }),
  knob("inject", 596, 1148, {
    name: "INJECT",
    what: "audio getting into the video line - rows shift and brighten with the waveform",
    tip: "bass draws slow S-curves down the picture, hats comb it into ripples",
  }),
  knob("burst", 782, 1148, {
    name: "BURST",
    what: "the colour reference dying - the set reads brightness as hue instead",
    tip: "low settings cast the picture; high ones wrap it through the wheel several times",
  }, 178),
  knob("phos", 969, 1148, {
    name: "PHOS",
    what: "resolves the picture onto the tube's phosphor triads",
    tip: "made out of the picture's own light rather than laid over the top",
  }),
  knob("amp", 1133, 1148, {
    name: "AMP",
    what: "video amplifier overdrive - brights bleed into what is next to them, whites crush together",
  }),
  knob("fault", 1297, 1148, {
    name: "FAULT",
    what: "discrete failures rather than a continuous effect - the knob sets how often one happens",
    tip: "the frame freezes, or inverts, or loses colour",
  }),
]

const shot = (file: string, alt: string) => ({ src: `/drft/${file}`, alt, width: 1700, height: 1316 })

export const DRFT_PANEL: Panel = {
  // drft's chassis black, its cream legend and the ember of its lit tab
  // (CRTV/Source/ui/UiTokens.h, TrakLookAndFeel.h).
  theme: { ground: "#171512", ink: "#ece6d8", accent: "#e8641f" },
  idle: "hover any control to see what it does - click SOUND, FIELD or CIRCUIT to change page",
  idleTouch: "tap any control to see what it does",
  views: [
    {
      id: "sound",
      label: "Sound",
      shot: shot("tour-sound.webp", "drft's SOUND page: the CRT tube over six character knobs - burn, drift, bend, dropout, wash and noise"),
      spots: [...CHASSIS, ...SOUND],
    },
    {
      id: "field",
      label: "Field",
      shot: shot("tour-field.webp", "drft's FIELD page: a generator on the tube, over the style and blend faders and the hue, flow, zoom, follow, bands and glow knobs"),
      spots: [...CHASSIS, ...FIELD],
    },
    {
      id: "paint",
      label: "Paint",
      shot: shot("tour-paint.webp", "drft's PAINT page: marks stamped onto a feedback canvas on the tube"),
      // On this page the FIELD tab is the one that is lit.
      spots: [...CHASSIS, ...PAINT],
    },
    {
      id: "circuit",
      label: "Circuit",
      shot: shot("tour-circuit.webp", "drft's CIRCUIT page: the colour reference dying on the tube, over the yoke, inject, burst, phos, amp and fault knobs"),
      spots: [...CHASSIS, ...CIRCUIT],
    },
  ],
}
