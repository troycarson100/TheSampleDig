/**
 * Local storage for user-saved chop loops per video (youtubeId).
 * Each saved loop is a copy of the loop bar: sequence + loop range.
 */

import type { SavedLoopData } from "@/hooks/useChopMode"

const STORAGE_KEY = "thesampledig-saved-loops"

export interface SavedLoopEntry extends SavedLoopData {
  id: string
  /** Optional label, e.g. "Loop 1" or user name */
  label?: string
  /** When it was saved (ISO string) for ordering */
  savedAt: string
}

export type SavedLoopsByVideo = Record<string, SavedLoopEntry[]>

function readAll(): SavedLoopsByVideo {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SavedLoopsByVideo
    }
    return {}
  } catch {
    return {}
  }
}

function writeAll(data: SavedLoopsByVideo): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn("[SavedLoops] Failed to write:", e)
  }
}

/** Get all saved loops for a video. */
export function getSavedLoops(youtubeId: string): SavedLoopEntry[] {
  const all = readAll()
  const list = all[youtubeId]
  return Array.isArray(list) ? list : []
}

/** Save a new loop for a video. Returns the created entry. */
export function saveLoop(
  youtubeId: string,
  data: SavedLoopData,
  options?: { label?: string }
): SavedLoopEntry {
  const all = readAll()
  const list = Array.isArray(all[youtubeId]) ? all[youtubeId] : []
  const count = list.length + 1
  const entry: SavedLoopEntry = {
    id: `loop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label: options?.label ?? `Loop ${count}`,
    savedAt: new Date().toISOString(),
    sequence: data.sequence,
    loopStartMs: data.loopStartMs,
    loopEndMs: data.loopEndMs,
    fullLengthMs: data.fullLengthMs,
  }
  all[youtubeId] = [...list, entry]
  writeAll(all)
  return entry
}

/** Remove a saved loop by id. */
export function deleteSavedLoop(youtubeId: string, loopId: string): void {
  const all = readAll()
  const list = Array.isArray(all[youtubeId]) ? all[youtubeId] : []
  const next = list.filter((e) => e.id !== loopId)
  if (next.length === 0) {
    const { [youtubeId]: _, ...rest } = all
    writeAll(rest)
  } else {
    all[youtubeId] = next
    writeAll(all)
  }
}
