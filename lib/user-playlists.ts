/**
 * Client-side user playlists (Pro feature). Persisted in localStorage until
 * server-backed playlists exist. Keyed by user id.
 */

export type UserPlaylist = {
  id: string
  name: string
  createdAt: number
  /** YouTube video ids in this playlist (order = display order, newest additions append). */
  youtubeIds: string[]
}

const STORAGE_PREFIX = "sampleroll_user_playlists_v1"

function keyForUser(userId: string) {
  return `${STORAGE_PREFIX}_${userId}`
}

function emit() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("userPlaylistsUpdated"))
}

export function getPlaylists(userId: string): UserPlaylist[] {
  if (typeof window === "undefined" || !userId) return []
  try {
    const raw = localStorage.getItem(keyForUser(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as UserPlaylist[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAll(userId: string, playlists: UserPlaylist[]) {
  localStorage.setItem(keyForUser(userId), JSON.stringify(playlists))
  emit()
}

export function createPlaylist(userId: string, name: string): UserPlaylist | null {
  const trimmed = name.trim()
  if (!trimmed || typeof window === "undefined" || !userId) return null
  const pl: UserPlaylist = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: trimmed,
    createdAt: Date.now(),
    youtubeIds: [],
  }
  const list = getPlaylists(userId)
  saveAll(userId, [pl, ...list])
  return pl
}

export function deletePlaylist(userId: string, playlistId: string) {
  const list = getPlaylists(userId).filter((p) => p.id !== playlistId)
  saveAll(userId, list)
}

export function addYoutubeToPlaylist(userId: string, playlistId: string, youtubeId: string) {
  if (!youtubeId) return
  const list = getPlaylists(userId)
  const i = list.findIndex((p) => p.id === playlistId)
  if (i < 0) return
  const pl = { ...list[i]! }
  const set = new Set(pl.youtubeIds)
  set.delete(youtubeId)
  pl.youtubeIds = [youtubeId, ...Array.from(set)]
  const next = [...list]
  next[i] = pl
  saveAll(userId, next)
}

export function removeYoutubeFromPlaylist(userId: string, playlistId: string, youtubeId: string) {
  const list = getPlaylists(userId)
  const i = list.findIndex((p) => p.id === playlistId)
  if (i < 0) return
  const pl = { ...list[i]! }
  pl.youtubeIds = pl.youtubeIds.filter((id) => id !== youtubeId)
  const next = [...list]
  next[i] = pl
  saveAll(userId, next)
}

/** When user unsaves a sample, drop it from every playlist. */
export function pruneYoutubeFromAllPlaylists(userId: string, youtubeId: string) {
  const list = getPlaylists(userId)
  let changed = false
  const next = list.map((pl) => {
    const filtered = pl.youtubeIds.filter((id) => id !== youtubeId)
    if (filtered.length !== pl.youtubeIds.length) changed = true
    return { ...pl, youtubeIds: filtered }
  })
  if (changed) saveAll(userId, next)
}
