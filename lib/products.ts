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

export interface ProductDef {
  id: string
  name: string
  blurb: string
  assets: ProductAsset[]
}

export const PRODUCTS: Record<string, ProductDef> = {
  shft: {
    id: "shft",
    name: "shft",
    blurb: "Tempo-synced trance-gate multi-FX — macOS (VST3 / AU / Standalone) & Windows (VST3 / Standalone).",
    assets: [
      {
        id: "installer",
        label: "shft installer — macOS",
        key: process.env.SHFT_INSTALLER_KEY || "shft/shft-1.0.13.pkg",
        filename: "shft-1.0.13.pkg",
      },
      {
        id: "installer-win",
        label: "shft installer — Windows",
        key: process.env.SHFT_INSTALLER_WIN_KEY || "shft/shft-1.0.13-setup.exe",
        filename: "shft-1.0.13-setup.exe",
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
