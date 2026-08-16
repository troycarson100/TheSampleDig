import { randomInt } from "node:crypto"

// Crockford base32: no I, L, O or U. I/L/O are the characters people mistype for
// 1/1/0, so normalizeLicenseKey folds them back rather than rejecting the key;
// U is excluded outright so a random key can never spell something unfortunate.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const BODY_LEN = 11 // + 1 checksum character = 12, printed as three groups of four

function checkChar(body: string): string {
  let sum = 0
  for (const c of body) sum += ALPHABET.indexOf(c)
  return ALPHABET[sum % 32]
}

function group(full: string): string {
  return `SHFT-${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8, 12)}`
}

/** `pick` is injectable so tests can be deterministic; it defaults to a CSPRNG. */
export function generateLicenseKey(pick: (max: number) => number = randomInt): string {
  let body = ""
  for (let i = 0; i < BODY_LEN; i++) body += ALPHABET[pick(32)]
  return group(body + checkChar(body))
}

/**
 * Canonicalises anything a human might paste. Returns null when the key is the
 * wrong shape or the checksum fails — which is the point: a typo is caught here,
 * client-side, instead of after a round trip that just says "invalid key".
 *
 * The checksum catches every single-character substitution: swapping one symbol
 * shifts the sum by 1..31, which can never be a multiple of 32.
 */
export function normalizeLicenseKey(input: string): string | null {
  if (typeof input !== "string") return null

  let s = input.toUpperCase().replace(/[^0-9A-Z]/g, "")
  if (s.length === BODY_LEN + 5 && s.startsWith("SHFT")) s = s.slice(4)
  s = s.replace(/[ILO]/g, (c) => (c === "O" ? "0" : "1"))

  if (s.length !== BODY_LEN + 1) return null
  for (const c of s) if (!ALPHABET.includes(c)) return null
  if (checkChar(s.slice(0, BODY_LEN)) !== s[BODY_LEN]) return null

  return group(s)
}
