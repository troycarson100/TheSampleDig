export type GridDivision =
  | "1/1"
  | "1/1t"
  | "1/1d"
  | "1/2"
  | "1/2t"
  | "1/2d"
  | "1/4"
  | "1/4t"
  | "1/4d"
  | "1/8"
  | "1/8t"
  | "1/8d"
  | "1/16"
  | "1/16t"
  | "1/16d"

export interface SnapOptions {
  /**
   * Origin in ms for grid; for loop events use loopStartMs so grid is relative to loop.
   * For global chops on the main timeline, this can be 0.
   */
  originMs?: number
}

/** Length of one 4/4 bar in milliseconds for a given BPM. */
export function barMs(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return (60000 / 60) * 4 // Fallback 60 BPM
  return (60000 / bpm) * 4
}

function stepMsForDivision(bpm: number, division: GridDivision): number {
  const bar = barMs(bpm)
  // Parse "1/N", optional suffix "t" (triplet) or "d" (dotted)
  const match = division.match(/^1\/(\d+)([td])?$/)
  if (!match) return bar / 16
  const denom = Number(match[1])
  if (!Number.isFinite(denom) || denom <= 0) return bar / 16
  const suffix = match[2] as "t" | "d" | undefined
  const base = bar / denom
  if (suffix === "t") {
    // Triplet: 2/3 of the base note length
    return base * (2 / 3)
  }
  if (suffix === "d") {
    // Dotted: 3/2 of the base note length
    return base * 1.5
  }
  return base
}

/**
 * Apply swing to a grid step index.
 * swingPct: 50 = straight, >50 pushes even steps later toward the next grid.
 */
function applySwingToStepTime(
  baseTimeMs: number,
  stepIndex: number,
  stepLengthMs: number,
  swingPct: number
): number {
  // Only apply swing for even 1/8 or 1/16 style divisions; for triplets/dotted we keep straight.
  if (swingPct === 50) return baseTimeMs
  const swingAmount = (swingPct - 50) / 50 // -? to +1 range; 0 at center
  if (swingAmount === 0) return baseTimeMs
  // Shift every second step (odd index) later by up to ~50% of step length.
  if (stepIndex % 2 === 1) {
    const maxShift = stepLengthMs * 0.5
    return baseTimeMs + swingAmount * maxShift
  }
  return baseTimeMs
}

/**
 * Snap an absolute time (ms) to the nearest grid position based on BPM, division, swing, and origin.
 */
export function snapToGrid(
  timeMs: number,
  bpm: number,
  division: GridDivision,
  swingPct: number,
  options: SnapOptions = {}
): number {
  if (!Number.isFinite(timeMs)) return timeMs
  const origin = options.originMs ?? 0
  const rel = timeMs - origin
  if (rel <= 0) return origin

  const stepMs = stepMsForDivision(bpm, division)
  if (!Number.isFinite(stepMs) || stepMs <= 0) return timeMs

  const rawIndex = rel / stepMs
  const baseIndex = Math.round(rawIndex)
  // Evaluate around the nearest indices to account for swing shifting the effective position.
  const candidateIndices = [baseIndex - 1, baseIndex, baseIndex + 1]

  let bestTime = timeMs
  let bestDist = Number.POSITIVE_INFINITY

  for (const idx of candidateIndices) {
    if (idx < 0) continue
    const base = origin + idx * stepMs
    const swung = applySwingToStepTime(base, idx, stepMs, swingPct)
    const dist = Math.abs(swung - timeMs)
    if (dist < bestDist) {
      bestDist = dist
      bestTime = swung
    }
  }

  return bestTime
}

export interface GridLinePosition {
  positionMs: number
  isBar: boolean
}

/**
 * Get grid line positions in ms from 0 up to lengthMs (for drawing grid on timeline).
 * isBar is true for the first of every N clicks (e.g. 1/8 → first of every 8 lines is bar).
 */
export function getGridLinePositionsMs(
  lengthMs: number,
  bpm: number,
  division: GridDivision
): GridLinePosition[] {
  if (!Number.isFinite(lengthMs) || lengthMs <= 0) return []
  const stepMs = stepMsForDivision(bpm, division)
  if (!Number.isFinite(stepMs) || stepMs <= 0) return []
  const bar = barMs(bpm)
  const stepsPerBar = bar > 0 && stepMs > 0 ? Math.round(bar / stepMs) : 0
  const positions: GridLinePosition[] = []
  let pos = 0
  let stepIndex = 0
  while (pos < lengthMs) {
    const isBar =
      stepsPerBar > 0
        ? stepIndex % stepsPerBar === 0
        : bar > 0 && Math.abs(pos / bar - Math.round(pos / bar)) < 0.02
    positions.push({ positionMs: pos, isBar })
    pos += stepMs
    stepIndex += 1
  }
  return positions
}

/**
 * Snap loop end so that loop length is an integer number of bars.
 */
export function snapLoopEndToBar(
  loopEndMs: number,
  loopStartMs: number,
  bpm: number
): number {
  const bar = barMs(bpm)
  if (!Number.isFinite(bar) || bar <= 0) return loopEndMs
  const span = Math.max(0, loopEndMs - loopStartMs)
  if (span === 0) return loopStartMs
  const barsFloat = span / bar
  const bars = Math.max(1, Math.round(barsFloat))
  return loopStartMs + bars * bar
}

