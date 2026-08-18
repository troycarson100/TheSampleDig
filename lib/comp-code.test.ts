import { test } from "node:test"
import assert from "node:assert/strict"
import { generateCompCode, normalizeCompCode } from "./comp-code"

const seq = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

test("generateCompCode returns the grouped GIFT- form", () => {
  const code = generateCompCode(seq([0]))
  assert.equal(code, "GIFT-0000-0000-0000")
})

test("generateCompCode output always survives normalize", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateCompCode()
    assert.equal(normalizeCompCode(code), code, `round trip failed for ${code}`)
  }
})

test("normalizeCompCode accepts lowercase, missing dashes and stray spaces", () => {
  const code = generateCompCode()
  const mangled = code.toLowerCase().replace(/-/g, " ")
  assert.equal(normalizeCompCode(mangled), code)
})

test("normalizeCompCode rejects a single mistyped character", () => {
  const code = generateCompCode()
  const body = code.replace(/^GIFT-/, "").replace(/-/g, "")
  const swapped = body[0] === "0" ? "1" + body.slice(1) : "0" + body.slice(1)
  assert.equal(normalizeCompCode("GIFT-" + swapped), null)
})

test("normalizeCompCode does not accept a SHFT- license key", () => {
  const code = generateCompCode()
  const swapped = code.replace(/^GIFT-/, "SHFT-")
  assert.equal(normalizeCompCode(swapped), null)
})

test("normalizeCompCode rejects wrong length, U, and junk", () => {
  assert.equal(normalizeCompCode("GIFT-0000-0000"), null)
  assert.equal(normalizeCompCode("GIFT-UUUU-UUUU-UUUU"), null)
  assert.equal(normalizeCompCode(""), null)
  assert.equal(normalizeCompCode("hello there"), null)
})
