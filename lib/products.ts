// Paid products and their downloadable assets. The `key` is the object key in
// the storage bucket (see lib/spaces.ts). Bump the keys (or the env overrides)
// when you ship a new version, and upload the new file with scripts/upload-shft-release.mjs.

export type ProductAssetId = "installer" | "installer-win" | "manual"

// The object keys drft is served from. Named here rather than inline so the
// download filename can be DERIVED from the key: the key was env-overridable
// and the filename was not, so pointing at a new build used to hand buyers a
// file still labelled with the old version. Deriving it makes that class of
// mismatch impossible - whatever object is served, the name matches it.
const DRFT_INSTALLER_KEY     = process.env.DRFT_INSTALLER_KEY     || "drft/drft-1.1.3.pkg"
const DRFT_INSTALLER_WIN_KEY = process.env.DRFT_INSTALLER_WIN_KEY || "drft/drft-1.1.3-setup.exe"
// The manual tracks the MINOR line, not the patch - it only needs rebuilding
// when controls change. v1.1 is the manual for every 1.1.x build.
const DRFT_MANUAL_KEY        = process.env.DRFT_MANUAL_KEY        || "drft/drft-manual-v1.1.pdf"

const basename = (key: string) => key.slice(key.lastIndexOf("/") + 1)

// Display prices for the store pages. Stripe charges whatever the price IDs in
// the env are configured to — keep these in sync with the Stripe dashboard.
export const PRICING = {
  shft: { price: 19, msrp: 39 },
  drft: { price: 19, msrp: 39 },
  // Struck against the combined MSRP ($39 x 2), like every other price on the
  // site strikes list price - not against the two sale prices.
  bundle: { price: 34, compareAt: 78, msrp: 78 },
  // Own one plugin, buy the other: $19 + $15 = $34 — exactly the bundle deal.
  // compareAt is the MSRP, matching how every other price on the site is
  // struck ($19 against $39), so the saving reads off the real list price.
  crossgrade: { price: 15, compareAt: 39 },
} as const

export interface ProductAsset {
  id: ProductAssetId
  label: string
  key: string
  filename: string
}

export interface ProductRelease {
  version: string
  notes: string[]
}

export interface ProductDef {
  id: string
  name: string
  blurb: string
  version?: string
  /** Newest first. Rendered under the downloads on /products. */
  changelog?: ProductRelease[]
  assets: ProductAsset[]
}

export const PRODUCTS: Record<string, ProductDef> = {
  shft: {
    id: "shft",
    name: "shft",
    version: "1.2.1",
    blurb: "Tempo-synced trance-gate multi-FX — macOS (VST3 / AU / Standalone) & Windows (VST3 / Standalone).",
    changelog: [
      {
        version: "1.2.1",
        notes: [
          "Fixed: the LFO destination menu drove the wrong control. Choosing \"dly fb\" modulated the output volume — so it came out as tremolo rather than as delay feedback — and \"dly tone\", \"dly mix\", \"rv size\" and \"rv decay\" were each pointed one place away in the same manner. Choosing \"swing\" did nothing at all. Every destination now moves the control it names.",
          "Your existing sessions will sound exactly as they did. The LFO was always moving the control you could hear; only the label was wrong. Now that the menu names it correctly, an LFO you set up before this update may read as a different destination than you remember — that is the label catching up with the sound, not a change to it.",
          "Fixed: double-clicking a modulation badge to remove it looked like it did nothing until you started playback. It clears the moment you click now.",
          "shft is now filed under SampleRoll in your plugin list, alongside our other plugins, instead of sitting in a folder of its own. You may need to rescan your plugins for it to move.",
        ],
      },
      {
        version: "1.2.0",
        notes: [
          "shft now activates with a licence key. Yours is on this page, just below the download buttons - copy it, paste it into shft the first time you open it, and that's it. It checks once, then never needs the internet again.",
          "One key covers 3 machines. If you retire or rebuild a computer, deactivate it here to free the slot for another one. Swapping a network adapter or updating macOS won't cost you a slot.",
          "Already running shft? Nothing breaks. Your current install keeps working exactly as it is - you'll only be asked for the key once you install this update.",
          "Fixed: the pattern undo arrow came apart into two overlapping pieces when dimmed, showing a dark seam across the join. It fades as one shape now, and its arrowhead sits properly on the end of the arc.",
        ],
      },
      {
        version: "1.1.3",
        notes: [
          "Chaos, scoped. The little caret beside the CHAOS title opens a panel of chips that set exactly what the knob is allowed to roll: stutter density (x2 / x3 / x4), slice type (gate / repeat / reverse / granular), and pitch jumps by interval — octave, two octaves, fifth, fourth. Light any subset; all lit is the classic behaviour.",
          "Chaos can now throw steps into the FX, dub style — a step hurled into the delay, bloomed into the reverb, or the filter kicked one to three octaves (aimed where you'll hear it: open filters kick down, closed ones up). Each throw lasts one step and each is its own chip, off by default.",
          "You can see what chaos grabbed: a violet glow rides just outside a knob's value ring at the value chaos is holding it at — on cutoff for filter kicks, on the delay and reverb mix knobs for throws — swelling in and melting away rather than blinking.",
          "The gate chip is chaos's one new trick in the other direction: rolling it un-glitches an armed step back to a plain gate hit.",
          "Fixed: engaging a chaos delay throw from a dry mix no longer pops — the delay line stays fed while idle, so throws land on fresh audio.",
        ],
      },
      {
        version: "1.1.2",
        notes: [
          "Pattern length. A thin rail under the step strip sets where the pattern wraps — drag its caret and it snaps to step ends, with the sleeping steps greyed out above it. Anything under 16 phases against the bar: a 12-step pattern at 1/16 lands somewhere new every beat.",
          "It's per-lane, like rate and feel — so three bands badged to lanes of different lengths drift in and out of phase with each other, and can take whole phrases to realign.",
          "Modulation now travels with the lane: drop a lane on a knob and that route belongs to the lane you're on, switching with it like everything else. Band badges stay global, and with G on the filter's modulation stays global too.",
          "Undo for pattern edits. The small back arrow above the strip steps back through steps, ratchets, lengths, shapes, repeats and pattern length — one press per edit, and a dice roll counts as one edit.",
          "Turning the delay's mix up no longer dips the track: the blend was sagging 4.8 dB at 50% mix, and now holds level. Same fix the reverb got in 1.1.0.",
        ],
      },
      {
        version: "1.1.0",
        notes: [
          "The band mixer. A new bar on the seq page splits your sound into up to three frequency bands, with crossovers you drag by hand. Each band can sit at its own wet amount, skip the FX chain, or solo — so you can chop the top end and leave the low end alone.",
          "Give every band its own rhythm. Drop one of the eight lane keys onto a band and that band plays that lane's whole patch: its own step pattern, its own rate and feel, its own filter and drive. A rolling hi-hat on top, a half-time chop underneath, something else again in the middle — all from one input.",
          "Factory and User tabs in the preset browser. Everything shft ships with lives in Factory; everything you save lives in User, in its own place on disk. An update can rewrite the factory bank without ever touching a preset of yours.",
          "Sixteen new factory presets, most of them built around the band mixer, with patterns that actually use accents, ratchets, tied steps and per-step shape.",
          "Make your own folders. Use + folder in the preset browser, or right-click a folder to rename it. Deleting a folder never deletes what's in it — those presets move to Unsorted.",
          "A new G beside cutoff ties the filter to one global setting instead of letting each band keep its own. It's non-destructive both ways: turn it off and every lane still has the filter it had.",
          "The OTT sounds like an OTT again. Both stages now work on the same material instead of each nibbling at one end, so it squashes and lifts at once — everything from -34 dBFS up lands within a couple of dB of the same level. It also holds the stereo image where you put it (a hard-panned sound used to drift toward the centre), and no longer winds itself up during a gate's silence and slam the next note.",
          "Turning the reverb's mix up no longer turns your track down. It was losing 4.5 dB at half mix and 6.3 dB at full; the blend now holds level across the whole sweep.",
          "Legibility: several controls had light text on a light background depending on the skin — the Factory/User tabs, the preset rename field, the + save pill and the popup-menu highlight. Every one of them is now measured for contrast on all five skins.",
        ],
      },
      {
        version: "1.0.18",
        notes: [
          "Hover help. The strip along the bottom of the plugin now explains whatever you point at — what the control does, and one thing worth trying with it. It covers every knob on all three pages, the step strip, the lane keys and the modulation badges.",
          "Point at a modulation badge and it spells out the gestures: drag it up or down for range, double-click to remove it, cmd-click for uni or bi-polar.",
          "Prefer the quiet? Turn the tips off in the settings gear — the choice is remembered between sessions.",
          "The pattern dice moved up beside the eight lane keys it rolls.",
        ],
      },
    ],
    assets: [
      {
        id: "installer",
        label: "shft installer — macOS",
        key: process.env.SHFT_INSTALLER_KEY || "shft/shft-1.2.1.pkg",
        filename: "shft-1.2.1.pkg",
      },
      {
        id: "installer-win",
        label: "shft installer — Windows",
        key: process.env.SHFT_INSTALLER_WIN_KEY || "shft/shft-1.2.1-setup.exe",
        filename: "shft-1.2.1-setup.exe",
      },
      {
        id: "manual",
        label: "User manual (PDF)",
        key: process.env.SHFT_MANUAL_KEY || "shft/shft-manual-v1.4.pdf",
        filename: "shft-manual-v1.4.pdf",
      },
    ],
  },
  drft: {
    id: "drft",
    name: "drft",
    version: "1.1.3",
    blurb: "VHS / CRT circuit-bend video-sound effect — macOS (VST3 / AU / Standalone) & Windows (VST3 / Standalone).",
    changelog: [
      // 1.1.0 and 1.1.2 were never published here - the store went straight
      // from 1.0.1 to 1.1.3 - so this entry covers everything since 1.0.1
      // rather than making a 1.0.1 owner read three sets of notes.
      {
        version: "1.1.3",
        notes: [
          "A whole new page: CIRCUIT. Six knobs that break the television rather than the tape - the deflection coil bending the raster, the colour reference dying so brightness turns into hue, the video amp overdriving, the picture resolving onto the tube's phosphor triads, and discrete failures that freeze, invert, colour-kill or bury the frame in snow. INJECT rides your waveform down the picture as rows that shift and brighten, so the bass draws slow curves and the hats comb it into ripples.",
          "One DEPTH fader rides the whole circuit bank at once, so you can automate all of it on a single lane, and a power key bypasses the bank while keeping your settings. None of it touches your audio - it is the picture, completely.",
          "A second FIELD page: PAINT. Instead of a generator you tune, it is a canvas with a memory - the transients in your track stamp marks onto it, and a feedback loop turns, drifts and decays what is already there. Six kinds of mark, including suminagashi ink marbling that pushes the whole picture outward into nested contours, and an attractor plotter that snaps to a new shape on every hit.",
          "Three more generators - mandala, warp and dots - taking the FIELD page to 23. All three posterise into flat plateaus of colour rather than smooth gradients, so they read like print instead of light.",
          "TINT, next to HUE on the FIELD page: it turns every colour on the tube round the wheel together, keeping their relationships, the way the TINT knob on a real set did. HUE still spins the palette so shapes recolour independently - now you have both.",
          "Fullscreen. A key in the header throws the picture onto its own borderless window filling the display, for when you want to watch it rather than drive it. Escape brings it back.",
          "A gain match key beside OUTPUT holds the output at the level the input arrived at, so bypassing compares character instead of loudness.",
          "Presets now show you when you have unsaved changes, and the manual has been rewritten to cover all of it - two new chapters and a full parameter reference.",
        ],
      },
      {
        version: "1.0.1",
        notes: [
          "Live camera now works on Windows - any webcam, capture card or virtual camera the system exposes shows up in the channel list.",
          "BEND's bit reduction no longer swamps quiet material: it backs off as the signal falls, so decays and silences stay clean instead of turning to crackle. Loud material is unchanged.",
          "New E key on the FIELD page - an endless zoom that falls inward forever with no seam.",
        ],
      },
      {
        version: "1.0.0",
        notes: [
          "First release. Six character knobs — burn, drift, bend, dropout, wash, noise — over a true-16:9 CRT that plays your video, a GIF, or your live camera through the effect.",
          "Dropouts tear the picture and the sound in the same instant, feed lets the picture drive the sound, and REC exports what you see and hear as a real MP4.",
          "Your licence key is on this page, just below the download buttons — paste it into drft the first time you open it. One key covers 3 machines.",
        ],
      },
    ],
    assets: [
      {
        id: "installer",
        label: "drft installer — macOS",
        key: DRFT_INSTALLER_KEY,
        filename: basename(DRFT_INSTALLER_KEY),
      },
      {
        id: "installer-win",
        label: "drft installer — Windows",
        key: DRFT_INSTALLER_WIN_KEY,
        filename: basename(DRFT_INSTALLER_WIN_KEY),
      },
      {
        id: "manual",
        label: "User manual (PDF)",
        key: DRFT_MANUAL_KEY,
        filename: basename(DRFT_MANUAL_KEY),
      },
    ],
  },
}

export function getProduct(id: string): ProductDef | null {
  return PRODUCTS[id] ?? null
}
