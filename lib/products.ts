// Paid products and their downloadable assets. The `key` is the object key in
// the storage bucket (see lib/spaces.ts). Bump the keys (or the env overrides)
// when you ship a new version, and upload the new file with scripts/upload-shft-release.mjs.

export type ProductAssetId = "installer" | "installer-win" | "manual"

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
    version: "1.1.1",
    blurb: "Tempo-synced trance-gate multi-FX — macOS (VST3 / AU / Standalone) & Windows (VST3 / Standalone).",
    changelog: [
      {
        version: "1.1.1",
        notes: [
          "Pattern length. A thin rail under the step strip sets where the pattern wraps — drag its caret and it snaps to step ends, with the sleeping steps greyed out above it. Anything under 16 phases against the bar: a 12-step pattern at 1/16 lands somewhere new every beat.",
          "It's per-lane, like rate and feel — so three bands badged to lanes of different lengths drift in and out of phase with each other, and can take whole phrases to realign.",
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
        key: process.env.SHFT_INSTALLER_KEY || "shft/shft-1.1.1.pkg",
        filename: "shft-1.1.1.pkg",
      },
      {
        id: "installer-win",
        label: "shft installer — Windows",
        key: process.env.SHFT_INSTALLER_WIN_KEY || "shft/shft-1.1.1-setup.exe",
        filename: "shft-1.1.1-setup.exe",
      },
      {
        id: "manual",
        label: "User manual (PDF)",
        key: process.env.SHFT_MANUAL_KEY || "shft/shft-manual-v1.4.pdf",
        filename: "shft-manual-v1.4.pdf",
      },
    ],
  },
}

export function getProduct(id: string): ProductDef | null {
  return PRODUCTS[id] ?? null
}
