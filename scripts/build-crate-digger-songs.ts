/**
 * Build crate-digger-songs.json from crate-digger-list.json by fetching track lists
 * from MusicBrainz for each album. Target: 2000 songs. Rate limit: 1 req/s.
 *
 * Usage:
 *   npx tsx scripts/build-crate-digger-songs.ts [--limit=N] [--start-fresh] [--dry-run]
 *
 * - limit: max albums to process this run (default: all).
 * - start-fresh: clear resume state and start from album index 0.
 * - dry-run: don't write output file, only log.
 *
 * Output: data/crate-digger-songs.json (array of { artist, album, song, year? }).
 * Resume state: .build-crate-digger-songs-state.json
 */

import "dotenv/config"
import { readFile, writeFile, unlink, mkdir } from "fs/promises"
import path from "path"

const MB_BASE = "https://musicbrainz.org/ws/2"
const USER_AGENT = "TheSampleDig/1.0 (https://github.com/thesampledig; crate-digger track list builder)"
const TARGET_SONGS = 2000
const MAX_TRACKS_PER_ALBUM = 10
const RATE_LIMIT_MS = 1100

const ALBUMS_PATH = path.join(process.cwd(), "data", "crate-digger-list.json")
const OUT_PATH = path.join(process.cwd(), "data", "crate-digger-songs.json")
const STATE_PATH = path.join(process.cwd(), ".build-crate-digger-songs-state.json")

interface CrateDiggerEntry {
  artist: string
  album: string
  year?: number
  category?: string
}

export interface CrateDiggerSongEntry {
  artist: string
  album: string
  song: string
  year?: number
}

interface State {
  albumIndex: number
  songs: CrateDiggerSongEntry[]
}

function escapeLucene(s: string): string {
  return s.replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, "\\$&").trim()
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  let res = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
  for (let r = 0; r < retries && (res.status === 503 || res.status === 429); r++) {
    await sleep(RATE_LIMIT_MS * (r + 2))
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
  }
  return res
}

async function searchRelease(artist: string, album: string): Promise<string | null> {
  const artistQ = escapeLucene(artist)
  const releaseQ = escapeLucene(album)
  const query = `artistname:"${artistQ}" AND release:"${releaseQ}"`
  const url = `${MB_BASE}/release?query=${encodeURIComponent(query)}&fmt=json&limit=5`
  const res = await fetchWithRetry(url)
  if (!res.ok) {
    console.warn(`[MusicBrainz] Search failed ${res.status}: ${url}`)
    return null
  }
  const data = (await res.json()) as { releases?: { id: string }[] }
  const releases = data.releases
  if (!releases || releases.length === 0) return null
  return releases[0].id
}

async function getReleaseTracks(releaseId: string): Promise<string[]> {
  const url = `${MB_BASE}/release/${releaseId}?inc=recordings&fmt=json`
  const res = await fetchWithRetry(url)
  if (!res.ok) {
    console.warn(`[MusicBrainz] Release lookup failed ${res.status}: ${releaseId}`)
    return []
  }
  const data = (await res.json()) as {
    media?: { track?: { title?: string; recording?: { title?: string } }[]; tracks?: { title?: string; recording?: { title?: string } }[] }[]
  }
  const tracks: string[] = []
  const media = data.media ?? []
  for (const m of media) {
    const list = m.track ?? m.tracks ?? []
    for (const t of list) {
      const title = (t as { title?: string; recording?: { title?: string } }).recording?.title ?? (t as { title?: string }).title
      if (title && typeof title === "string" && title.trim()) {
        tracks.push(title.trim())
      }
    }
  }
  return tracks
}

async function loadState(): Promise<State | null> {
  try {
    const raw = await readFile(STATE_PATH, "utf-8")
    const data = JSON.parse(raw) as State
    if (typeof data.albumIndex !== "number" || !Array.isArray(data.songs)) return null
    return data
  } catch {
    return null
  }
}

async function saveState(state: State): Promise<void> {
  await writeFile(STATE_PATH, JSON.stringify(state), "utf-8")
}

async function clearState(): Promise<void> {
  try {
    await unlink(STATE_PATH)
  } catch {
    // ignore
  }
}

async function main() {
  const args = process.argv.slice(2)
  const limitArg = args.find((a) => a.startsWith("--limit="))
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1], 10)) : 9999
  const startFresh = args.includes("--start-fresh")
  const dryRun = args.includes("--dry-run")

  const rawAlbums = await readFile(ALBUMS_PATH, "utf-8")
  const albums = JSON.parse(rawAlbums) as CrateDiggerEntry[]
  const totalAlbums = albums.length

  let state: State
  if (startFresh) {
    await clearState()
    state = { albumIndex: 0, songs: [] }
    console.log("[BuildSongs] Start fresh: cleared resume state.")
  } else {
    const existing = await loadState()
    if (existing && existing.albumIndex < totalAlbums) {
      state = existing
      console.log(`[BuildSongs] Resuming from album index ${state.albumIndex} (${state.songs.length} songs so far).`)
    } else {
      state = { albumIndex: 0, songs: [] }
    }
  }

  const startAlbumIndex = state.albumIndex
  const endAlbumIndex = Math.min(startAlbumIndex + limit, totalAlbums)
  let fetched = 0
  let noMatch = 0
  let errors = 0

  for (let i = startAlbumIndex; i < endAlbumIndex; i++) {
    const entry = albums[i]
    if (state.songs.length >= TARGET_SONGS) {
      console.log(`[BuildSongs] Reached target ${TARGET_SONGS} songs, stopping.`)
      state.albumIndex = i + 1
      if (!dryRun) {
        await mkdir(path.dirname(OUT_PATH), { recursive: true })
        await writeFile(OUT_PATH, JSON.stringify(state.songs, null, 2), "utf-8")
        console.log(`[BuildSongs] Wrote ${state.songs.length} songs to ${OUT_PATH}`)
      }
      break
    }

    try {
      await sleep(RATE_LIMIT_MS)
      const releaseId = await searchRelease(entry.artist, entry.album)
      if (!releaseId) {
        noMatch++
        if (noMatch <= 3 || noMatch % 50 === 0) {
          console.log(`[BuildSongs] No match: ${entry.artist} — ${entry.album}`)
        }
        state.albumIndex = i + 1
        continue
      }

      await sleep(RATE_LIMIT_MS)
      const tracks = await getReleaseTracks(releaseId)
      if (tracks.length === 0) {
        state.albumIndex = i + 1
        continue
      }

      const toTake = Math.min(MAX_TRACKS_PER_ALBUM, tracks.length)
      for (let t = 0; t < toTake && state.songs.length < TARGET_SONGS; t++) {
        state.songs.push({
          artist: entry.artist,
          album: entry.album,
          song: tracks[t],
          year: entry.year,
        })
      }
      fetched++
      state.albumIndex = i + 1
      if (fetched % 20 === 0 || state.songs.length >= TARGET_SONGS) {
        console.log(`[BuildSongs] ${i + 1}/${totalAlbums} albums, ${state.songs.length} songs (last: ${entry.artist} — ${entry.album})`)
      }
    } catch (err) {
      errors++
      console.error(`[BuildSongs] Error at album ${i + 1} (${entry.artist} — ${entry.album}):`, (err as Error).message)
      state.albumIndex = i + 1
    }

    if (!dryRun) await saveState(state)
  }

  if (!dryRun) await saveState(state)

  if (!dryRun && state.songs.length > 0) {
    await mkdir(path.dirname(OUT_PATH), { recursive: true })
    await writeFile(OUT_PATH, JSON.stringify(state.songs, null, 2), "utf-8")
    console.log(`[BuildSongs] Wrote ${state.songs.length} songs to ${OUT_PATH}`)
  } else if (dryRun) {
    console.log(`[BuildSongs] Dry run: would write ${state.songs.length} songs.`)
  }

  const processed = state.albumIndex - startAlbumIndex
  console.log(
    `[BuildSongs] Done. Albums processed this run: ${processed}; no match: ${noMatch}; errors: ${errors}. Next resume from album index ${state.albumIndex}.`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
