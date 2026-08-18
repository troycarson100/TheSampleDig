import { randomInt } from "node:crypto"
import { generateKeycode, normalizeKeycode } from "./keycode"

// GIFT- prefix, deliberately different from license keys' SHFT- prefix: a
// comp code is pasted on the WEBSITE to claim a purchase, a license key is
// pasted in the PLUGIN to activate one. Same shape (and typo tolerance) would
// invite someone to try one where the other belongs.
export function generateCompCode(pick: (max: number) => number = randomInt): string {
  return generateKeycode("GIFT", pick)
}

export function normalizeCompCode(input: string): string | null {
  return normalizeKeycode("GIFT", input)
}
