import { randomInt } from "node:crypto"
import { generateKeycode, normalizeKeycode } from "./keycode"

const KEY_PREFIX: Record<string, string> = { shft: "SHFT", drft: "DRFT" }

export function generateLicenseKey(
  product: "shft" | "drft" = "shft",
  pick: (max: number) => number = randomInt
): string {
  return generateKeycode(KEY_PREFIX[product], pick)
}

/** Accepts keys of either product — the caller resolves which product via the
    Purchase row the key belongs to. */
export function normalizeLicenseKey(input: string): string | null {
  return normalizeKeycode("SHFT", input) ?? normalizeKeycode("DRFT", input)
}
