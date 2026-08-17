/** Laptop + studio desktop + one spare. */
export const SEAT_LIMIT = 3

export interface ActivationRow {
  id: string
  machineIds: string[]
  deactivatedAt: Date | null
}

export type SeatDecision =
  | { action: "reuse"; id: string }
  | { action: "revive"; id: string }
  | { action: "create" }
  | { action: "refuse"; reason: "seat_limit"; liveCount: number }

/**
 * The machine ids the plugin sends are already hashed on its side (JUCE's
 * getEncodedIDString: a platform letter plus 9 hex characters). The server
 * treats them as opaque and only checks the shape, so a malformed or padded
 * request cannot bloat the row.
 */
/** Sanity ceiling on the set size. NOT a guess: the first real machine tested
 *  reported 14 identifiers (one per network interface, plus the filesystem and
 *  unique-device ids), and an 8 cap rejected it outright with "Missing machine
 *  identifiers". Machines with VPN, VM or container adapters have more still,
 *  so this is set well clear of anything plausible while still bounding the row. */
const MAX_MACHINE_IDS = 40

export function validMachineIds(ids: unknown): ids is string[] {
  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= MAX_MACHINE_IDS &&
    ids.every((id) => typeof id === "string" && /^[0-9A-Za-z*]{1,32}$/.test(id))
  )
}

/**
 * Decides what an incoming activation does to the seat count.
 *
 * The ordering is the policy: an INTERSECTING live row is reused before the cap
 * is consulted, so someone at 3/3 can always re-activate a machine they already
 * own. Only a machine whose identifiers have ALL rotated is indistinguishable
 * from a new computer, and only that case costs a seat.
 */
export function decideSeat(
  rows: ActivationRow[],
  incoming: string[],
  limit: number = SEAT_LIMIT,
): SeatDecision {
  const intersects = (r: ActivationRow) => r.machineIds.some((id) => incoming.includes(id))

  const live = rows.filter((r) => r.deactivatedAt === null)

  const known = live.find(intersects)
  if (known) return { action: "reuse", id: known.id }

  if (live.length >= limit) return { action: "refuse", reason: "seat_limit", liveCount: live.length }

  const dead = rows.find((r) => r.deactivatedAt !== null && intersects(r))
  if (dead) return { action: "revive", id: dead.id }

  return { action: "create" }
}
