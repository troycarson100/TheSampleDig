import { test } from "node:test"
import assert from "node:assert/strict"
import { decideSeat, validMachineIds, SEAT_LIMIT, type ActivationRow } from "./license-activation"

const row = (id: string, machineIds: string[], dead = false): ActivationRow => ({
  id,
  machineIds,
  deactivatedAt: dead ? new Date("2026-01-01") : null,
})

test("no rows at all means create", () => {
  assert.deepEqual(decideSeat([], ["MAAA", "MBBB"]), { action: "create" })
})

test("a partially rotated machine reuses its row and costs no seat", () => {
  // The common case: one adapter swapped, the filesystem id unchanged.
  const rows = [row("r1", ["MOLD1", "MSHARED", "MOLD2"])]
  assert.deepEqual(decideSeat(rows, ["MNEW1", "MSHARED"]), { action: "reuse", id: "r1" })
})

test("a totally rotated machine is indistinguishable from a new one", () => {
  const rows = [row("r1", ["MOLD1", "MOLD2"])]
  assert.deepEqual(decideSeat(rows, ["MNEW1", "MNEW2"]), { action: "create" })
})

test("refuses once the limit is reached", () => {
  const rows = [row("r1", ["M1"]), row("r2", ["M2"]), row("r3", ["M3"])]
  assert.deepEqual(decideSeat(rows, ["M9"]), {
    action: "refuse",
    reason: "seat_limit",
    liveCount: SEAT_LIMIT,
  })
})

test("a known machine still activates when the limit is already reached", () => {
  // Reuse must be checked BEFORE the cap, or a user at 3/3 could not re-activate
  // a machine they already own after reinstalling.
  const rows = [row("r1", ["M1"]), row("r2", ["M2"]), row("r3", ["M3"])]
  assert.deepEqual(decideSeat(rows, ["M2"]), { action: "reuse", id: "r2" })
})

test("deactivated rows free their seat and are revived rather than duplicated", () => {
  const rows = [row("r1", ["M1"]), row("r2", ["M2"], true)]
  assert.deepEqual(decideSeat(rows, ["M2"]), { action: "revive", id: "r2" })
})

test("a deactivated row does not count towards the limit", () => {
  const rows = [row("r1", ["M1"]), row("r2", ["M2"]), row("r3", ["M3"], true)]
  assert.deepEqual(decideSeat(rows, ["M9"]), { action: "create" })
})

test("validMachineIds accepts a plausible JUCE set and rejects junk", () => {
  assert.equal(validMachineIds(["M1A2B3C4D", "W9F8E7D6C"]), true)
  assert.equal(validMachineIds([]), false)
  assert.equal(validMachineIds("M1A2B3C4D"), false)
  assert.equal(validMachineIds([""]), false)
  assert.equal(validMachineIds(["ok", 42]), false)
  assert.equal(validMachineIds(["M1A2B3C4D".repeat(10)]), false)
  assert.equal(validMachineIds(new Array(20).fill("M1A2B3C4D")), false)
})
