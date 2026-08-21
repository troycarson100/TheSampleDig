// Paid products and their downloadable assets. The `key` is the object key in
// the storage bucket (see lib/spaces.ts). Bump the keys (or the env overrides)
// when you ship a new version, and upload the new file with scripts/upload-shft-release.mjs.

export type ProductAssetId = "installer" | "installer-win" | "manual"

// Display prices for the store pages. Stripe charges whatever the price IDs in
// the env are configured to — keep these in sync with the Stripe dashboard.
export const PRICING = {
  shft: { price: 19, msrp: 39 },
  drft: { price: 19, msrp: 39 },
  // struck $38 = the two sale prices; "$78 MSRP" is secondary context only.
  bundle: { price: 34, compareAt: 38, msrp: 78 },
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
    version: "1.2.0",
    blurb: "Tempo-synced trance-gate multi-FX — macOS (VST3 / AU / Standalone) & Windows (VST3 / Standalone).",
    changelog: [
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
        key: process.env.SHFT_INSTALLER_KEY || "shft/shft-1.2.0.pkg",
        filename: "shft-1.2.0.pkg",
      },
      {
        id: "installer-win",
        label: "shft installer — Windows",
        key: process.env.SHFT_INSTALLER_WIN_KEY || "shft/shft-1.2.0-setup.exe",
        filename: "shft-1.2.0-setup.exe",
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
    version: "1.0.0",
    blurb: "VHS / CRT circuit-bend video-sound effect — macOS (VST3 / AU / Standalone) & Windows (VST3 / Standalone).",
    changelog: [
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
        key: process.env.DRFT_INSTALLER_KEY || "drft/drft-1.0.0.pkg",
        filename: "drft-1.0.0.pkg",
      },
      {
        id: "installer-win",
        label: "drft installer — Windows",
        key: process.env.DRFT_INSTALLER_WIN_KEY || "drft/drft-1.0.0-setup.exe",
        filename: "drft-1.0.0-setup.exe",
      },
      {
        id: "manual",
        label: "User manual (PDF)",
        key: process.env.DRFT_MANUAL_KEY || "drft/drft-manual-v1.0.pdf",
        filename: "drft-manual-v1.0.pdf",
      },
    ],
  },
}

export function getProduct(id: string): ProductDef | null {
  return PRODUCTS[id] ?? null
}
