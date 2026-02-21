/**
 * Loader for the "1000 Sampling Songs" JSON list.
 * Each entry has: id, artist_name, track_title, genre, year.
 * Used by populate-1000-sampling-songs.ts to build YouTube search queries and output lines.
 */

export interface SamplingSongEntry {
  id: number
  artist_name: string
  track_title: string
  genre: string
  year: number
}

/**
 * Build a YouTube search query from an entry (Artist + Track).
 */
export function buildSearchQuery(entry: SamplingSongEntry): string {
  return `${entry.artist_name} ${entry.track_title}`.trim().replace(/\s+/g, " ")
}

/**
 * Load and parse the 1000 sampling songs JSON from a file path.
 */
export async function load1000SamplingSongs(jsonPath: string): Promise<SamplingSongEntry[]> {
  const { readFile } = await import("fs/promises")
  const raw = await readFile(jsonPath, "utf-8")
  const data = JSON.parse(raw) as unknown
  if (!Array.isArray(data)) {
    throw new Error("JSON root must be an array")
  }
  const entries: SamplingSongEntry[] = []
  for (const item of data) {
    if (item && typeof item === "object" && "artist_name" in item && "track_title" in item) {
      entries.push({
        id: typeof (item as any).id === "number" ? (item as any).id : 0,
        artist_name: String((item as any).artist_name ?? "").trim(),
        track_title: String((item as any).track_title ?? "").trim(),
        genre: String((item as any).genre ?? "").trim(),
        year: typeof (item as any).year === "number" ? (item as any).year : 0,
      })
    }
  }
  return entries
}
