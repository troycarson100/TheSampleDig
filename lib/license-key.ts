import { randomInt } from "node:crypto"
import { generateKeycode, normalizeKeycode } from "./keycode"
import type { PluginProduct } from "./plugin-products"

const KEY_PREFIX: Record<PluginProduct, string> = { shft: "SHFT", drft: "DRFT", fltr: "FLTR" }

export function generateLicenseKey(
  product: PluginProduct = "shft",
  pick: (max: number) => number = randomInt
): string {
  return generateKeycode(KEY_PREFIX[product], pick)
}

/** Accepts keys of any plugin — the caller resolves which product via the
    Purchase row the key belongs to. */
export function normalizeLicenseKey(input: string): string | null {
  return normalizeKeycode("SHFT", input) ?? normalizeKeycode("DRFT", input) ?? normalizeKeycode("FLTR", input)
}
