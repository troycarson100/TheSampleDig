import { test } from "node:test"
import assert from "node:assert/strict"
import { SlidingWindowLimiter } from "./resend-rate-limit"

function clock(start = 0) {
  let t = start
  return { now: () => t, tick: (ms: number) => { t += ms } }
}

test("allows up to the limit, then refuses", () => {
  const c = clock()
  const l = new SlidingWindowLimiter(3, 1000, c.now)
  assert.equal(l.allow("a@b.c"), true)
  assert.equal(l.allow("a@b.c"), true)
  assert.equal(l.allow("a@b.c"), true)
  assert.equal(l.allow("a@b.c"), false)
})

test("a refused hit does not extend the window", () => {
  const c = clock()
  const l = new SlidingWindowLimiter(1, 1000, c.now)
  assert.equal(l.allow("k"), true)
  c.tick(900)
  assert.equal(l.allow("k"), false)
  c.tick(150) // 1050ms after the only counted hit
  assert.equal(l.allow("k"), true)
})

test("frees a slot once the oldest hit leaves the window", () => {
  const c = clock()
  const l = new SlidingWindowLimiter(2, 1000, c.now)
  l.allow("k")
  c.tick(500)
  l.allow("k")
  assert.equal(l.allow("k"), false)
  c.tick(501) // first hit is now 1001ms old
  assert.equal(l.allow("k"), true)
})

test("keys are independent", () => {
  const l = new SlidingWindowLimiter(1, 1000, () => 0)
  assert.equal(l.allow("one"), true)
  assert.equal(l.allow("two"), true)
  assert.equal(l.allow("one"), false)
})
