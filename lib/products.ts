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
    version: "1.0.18",
    blurb: "Tempo-synced trance-gate multi-FX — macOS (VST3 / AU / Standalone) & Windows (VST3 / Standalone).",
    changelog: [
      {
        version: "1.0.18",
        notes: [
          "Hover help. The strip along the bottom of the plugin now explains whatever you point at — what the control does, and one thing worth trying with it. It covers every knob on all three pages, the step strip, the lane keys and the modulation badges.",
          "Point at a modulation badge and it spells out the gestures: drag it up or down for range, double-click to remove it, cmd-click for uni or bi-polar.",
          "Prefer the quiet? Turn the tips off in the settings gear — the choice is remembered between sessions.",
          "The pattern dice moved up beside the eight lane keys it rolls.",
        ],
      },
      {
        version: "1.0.17",
        notes: [
          "New skin — Matte. A charcoal console: near-black chassis with a fine tooth to it, one electric blue for every label, and four vivid ring colours doing all the work. It sits second in the picker, right after Default.",
          "Tokyo is now called Cassette. Same skin, clearer name — your selection carries over, nothing to redo.",
          "Cassette: the preset name and the lane preview shapes were dark-on-dark against the deck's smoked-glass windows. Both are legible now.",
        ],
      },
      {
        version: "1.0.16",
        notes: [
          "Skins. A gear button in the header opens a picker with four looks for the whole plugin, and your choice is remembered between sessions.",
          "Cyber — neon on deep navy, lit panels and spun-metal knob caps.",
          "Soviet — olive chassis, hammered brass control plate, bakelite knobs and moulded keys with lamps that read out the value.",
          "Tokyo — an early-'80s Japanese cassette deck: brushed champagne aluminium, smoked-glass displays, amber lamps and knurled aluminium dials.",
          "The original look is still there as Default, unchanged and selected by default.",
        ],
      },
      {
        version: "1.0.15",
        notes: [
          "New master dry/wet bar in the bottom-left, on every page — blends the whole plugin, FX included, against your untouched input. At 0% it's a true bypass, so you can A/B the processed and unprocessed sound.",
          "The mix knob moved into the blue GATE section, where it acts as the gate's own dry/wet, before the effects.",
          "chaos moved to the bottom-right of the knob grid.",
        ],
      },
      {
        version: "1.0.14",
        notes: [
          "The export button now appears on the seq page only, instead of on the fx and lfo pages too.",
        ],
      },
      {
        version: "1.0.13",
        notes: [
          "Export: drag patterns straight into your DAW. The drag handle at the top-right of the step strip drops a MIDI file carrying both the notes and the CC1 shape automation in one clip.",
          "Export popup with separate MIDI and audio drag pads — audio renders bar-snapped with ACID tempo tags, so Live and Bitwig warp it to your session.",
        ],
      },
    ],
    assets: [
      {
        id: "installer",
        label: "shft installer — macOS",
        key: process.env.SHFT_INSTALLER_KEY || "shft/shft-1.0.18.pkg",
        filename: "shft-1.0.18.pkg",
      },
      {
        id: "installer-win",
        label: "shft installer — Windows",
        key: process.env.SHFT_INSTALLER_WIN_KEY || "shft/shft-1.0.18-setup.exe",
        filename: "shft-1.0.18-setup.exe",
      },
      {
        id: "manual",
        label: "User manual (PDF)",
        key: process.env.SHFT_MANUAL_KEY || "shft/shft-manual-v1.3.pdf",
        filename: "shft-manual-v1.3.pdf",
      },
    ],
  },
}

export function getProduct(id: string): ProductDef | null {
  return PRODUCTS[id] ?? null
}
