import { randomInt } from "node:crypto"
import { generateKeycode, normalizeKeycode } from "./keycode"

export function generateLicenseKey(pick: (max: number) => number = randomInt): string {
  return generateKeycode("SHFT", pick)
}

export function normalizeLicenseKey(input: string): string | null {
  return normalizeKeycode("SHFT", input)
}
