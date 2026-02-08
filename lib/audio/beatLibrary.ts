/**
 * Beat loop definitions. Add files under public/beats/ and entries here.
 */

export interface BeatDef {
  id: string
  name: string
  url: string
  originalBpm: number
  bars: number
  /** When set, load from custom storage (IndexedDB) instead of url. */
  customId?: string
}

/** Build a BeatDef for a custom (saved) loop for use in the engine and dropdown. */
export function customBeatToDef(meta: { id: string; name: string; originalBpm: number; bars: number }): BeatDef {
  return {
    id: meta.id,
    name: meta.name,
    url: "",
    originalBpm: meta.originalBpm,
    bars: meta.bars,
    customId: meta.id,
  }
}

export const BEATS: BeatDef[] = [
  { id: "hiphop1", name: "Hip-Hop 1", url: "/beats/hiphop1.mp3", originalBpm: 92, bars: 4 },
  { id: "boom1", name: "Boom Bap 1", url: "/beats/boom1.mp3", originalBpm: 88, bars: 4 },
]
