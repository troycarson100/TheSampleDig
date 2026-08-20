import { test } from "node:test"
import assert from "node:assert/strict"
import { generateLicenseKey, normalizeLicenseKey } from "./license-key"

// A deterministic "random" so the expected key is a literal, not a regex.
const seq = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

test("generateLicenseKey returns the grouped SHFT- form", () => {
  const key = generateLicenseKey("shft", seq([0]))
  assert.equal(key, "SHFT-0000-0000-0000")
})

test("generateLicenseKey returns the grouped DRFT- form", () => {
  const key = generateLicenseKey("drft", seq([0]))
  assert.equal(key, "DRFT-0000-0000-0000")
})

test("generateLicenseKey output always survives normalize", () => {
  for (const product of ["shft", "drft"] as const) {
    for (let i = 0; i < 200; i++) {
      const key = generateLicenseKey(product)
      assert.equal(normalizeLicenseKey(key), key, `round trip failed for ${key}`)
    }
  }
})

test("normalizeLicenseKey accepts lowercase, missing dashes and stray spaces", () => {
  const key = generateLicenseKey()
  const mangled = key.toLowerCase().replace(/-/g, " ")
  assert.equal(normalizeLicenseKey(mangled), key)
})

test("normalizeLicenseKey maps the Crockford confusables I, L and O", () => {
  // 1 and 0 are the real characters; I/L/O are what people type instead.
  const real = normalizeLicenseKey("SHFT-1111-1111-100" + normalizeCheck("11111111100"))
  assert.ok(real, "precondition: the all-ones body is a valid key")
  assert.equal(normalizeLicenseKey(real!.replace(/1/g, "I").replace(/0/g, "O")), real)
})

test("normalizeLicenseKey rejects a single mistyped character", () => {
  const key = generateLicenseKey()
  // Bump the first body character to a different one; the checksum must catch it.
  const body = key.replace(/^SHFT-/, "").replace(/-/g, "")
  const swapped = body[0] === "0" ? "1" + body.slice(1) : "0" + body.slice(1)
  assert.equal(normalizeLicenseKey("SHFT-" + swapped), null)
})

test("normalizeLicenseKey rejects wrong length, U, and junk", () => {
  assert.equal(normalizeLicenseKey("SHFT-0000-0000"), null)
  assert.equal(normalizeLicenseKey("SHFT-UUUU-UUUU-UUUU"), null)
  assert.equal(normalizeLicenseKey(""), null)
  assert.equal(normalizeLicenseKey("hello there"), null)
})

// Local mirror of the checksum, used only to build a fixture above.
function normalizeCheck(body: string): string {
  const A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
  let sum = 0
  for (const c of body) sum += A.indexOf(c)
  return A[sum % 32]
}
