/**
 * Discogs API helpers: search releases and map genres/styles to app genre strings
 * (lowercase, aligned with extractMetadata in lib/youtube.ts).
 *
 * Env (either):
 *   DISCOGS_PERSONAL_TOKEN — from https://www.discogs.com/settings/developers
 *   DISCOGS_CONSUMER_KEY + DISCOGS_CONSUMER_SECRET — app credentials
 *
 * All requests must send a descriptive User-Agent (Discogs requirement).
 *
 * Important: Discogs `release_title` is the *album* name, not the song. For songs use
 * `artist` + `track`, or a broad `q` query.
 */

const DEFAULT_UA = "SampleRoll/1.0 +https://sampleroll.com (genre backfill)"

const DEBUG = process.env.DISCOGS_DEBUG === "1" || process.env.DISCOGS_DEBUG === "true"

function dlog(...args: unknown[]) {
  if (DEBUG) console.error("[discogs]", ...args)
}

export function getDiscogsCredentials():
  | { kind: "token"; token: string }
  | { kind: "consumer"; key: string; secret: string }
  | null {
  const token =
    process.env.DISCOGS_PERSONAL_TOKEN?.trim() ||
    process.env.DISCOGS_TOKEN?.trim() ||
    process.env.DISCOGS_USER_TOKEN?.trim()
  if (token) return { kind: "token", token }
  const key = process.env.DISCOGS_CONSUMER_KEY?.trim()
  const secret = process.env.DISCOGS_CONSUMER_SECRET?.trim()
  if (key && secret) return { kind: "consumer", key, secret }
  return null
}

function discogsAuthHeader(creds: NonNullable<ReturnType<typeof getDiscogsCredentials>>): string {
  if (creds.kind === "token") return `Discogs token=${creds.token}`
  return `Discogs key=${creds.key}, secret=${creds.secret}`
}

export interface DiscogsReleaseMeta {
  id: number
  genres: string[]
  styles: string[]
}

/** Strip junk from YouTube video titles before searching. */
export function cleanYoutubeTitleForDiscogs(title: string): string {
  return title
    .replace(/\s*[\[(](?:official|remastered?|remaster|audio|video|hd|4k|full album|visualizer)[^\])]*[\])]/gi, "")
    .replace(/\s*-\s*Official\b.*$/i, "")
    .trim()
}

/**
 * Build candidate (artist, track) pairs.
 * Order matters: "Artist - Title" in the video title is usually reliable; channel is often a random uploader.
 */
export function discogsSearchPairs(channel: string, videoTitle: string): Array<{ artist: string; track: string }> {
  const cleanChannel = channel.replace(/\s*-\s*Topic\s*$/i, "").trim()
  const cleanTitle = cleanYoutubeTitleForDiscogs(videoTitle)
  const out: Array<{ artist: string; track: string }> = []
  const add = (artist: string, track: string) => {
    const a = artist.trim()
    const t = track.trim()
    if (a.length > 0 && t.length > 0) out.push({ artist: a, track: t })
  }

  const dash = cleanTitle.match(/^([\s\S]+?)\s*[-–—|]\s+([\s\S]+)$/)
  if (dash) {
    const left = dash[1].trim()
    const right = dash[2].trim()
    add(left, right)
    if (left !== cleanChannel) add(cleanChannel, right)
  }

  add(cleanChannel, cleanTitle)

  const seen = new Set<string>()
  return out.filter((p) => {
    const k = `${p.artist.toLowerCase()}\0${p.track.toLowerCase()}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Map Discogs genre + style lists to a single app genre (lowercase), or null.
 */
export function mapDiscogsToAppGenre(genres: string[], styles: string[]): string | null {
  const blob = [...styles, ...genres].join(" ").toLowerCase()

  if (/\bjapanese\b|city pop|j-pop|kayōkyoku|kayokyoku|enka|visual kei/i.test(blob)) return "japanese"
  if (/\bbossa\b|brazilian/i.test(blob)) return "bossa nova"
  if (/\bhip[\s-]?hop\b|boom bap/i.test(blob)) return "hip hop"
  if (/\br&b|rhythm and blues|neo soul|northern soul/i.test(blob)) return "r&b"
  if (/\bfunk\b/i.test(blob)) return "funk"
  if (/\bsoul\b/i.test(blob)) return "soul"
  if (/\bjazz\b/i.test(blob)) return "jazz"
  if (/\bdisco\b/i.test(blob)) return "disco"
  if (/\breggae\b|dub\b|ska\b|rocksteady/i.test(blob)) return "reggae"
  if (/\blatin\b|salsa|merengue|cumbia|tango|mpb\b/i.test(blob)) return "latin"
  if (/\bblues\b/i.test(blob)) return "blues"
  if (/\bprog(?:ressive)?\b|art rock/i.test(blob)) return "prog"
  if (/\bpsych|psychedelic/i.test(blob)) return "psychedelic"
  if (/\bfolk\b|country\b|bluegrass/i.test(blob)) return "folk"
  if (/\belectronic\b|house\b|techno\b|ambient\b|downtempo|idm\b|breakbeat/i.test(blob)) return "electronic"
  if (/\bclassical\b|baroque|opera\b|romantic\b/i.test(blob)) return "classical"
  if (/\bfilm|soundtrack|score|stage\b|musical/i.test(blob)) return "soundtrack"
  if (/\bpop\b|power pop|indie pop|synth-pop|synthpop/i.test(blob)) return "pop"
  if (/\brock\b|glam|hard rock|arena rock|garage rock|punk/i.test(blob)) return "rock"
  if (/\bmetal\b|heavy metal/i.test(blob)) return "metal"

  const g0 = genres[0]?.trim()
  if (g0) {
    const simple = g0.split("/")[0].trim().toLowerCase()
    if (simple.includes("funk") || simple.includes("soul")) return simple.includes("soul") && !simple.includes("funk") ? "soul" : "funk"
    if (simple.includes("jazz")) return "jazz"
    if (simple.includes("rock")) return "rock"
    if (simple.includes("electronic")) return "electronic"
    if (simple.includes("hip hop")) return "hip hop"
    if (simple.includes("latin")) return "latin"
    if (simple.includes("reggae")) return "reggae"
    if (simple.includes("blues")) return "blues"
    if (simple.includes("stage") || simple.includes("soundtrack")) return "soundtrack"
    if (simple.includes("folk")) return "folk"
    if (simple.includes("pop")) return "pop"
    return simple.length <= 32 ? simple : simple.slice(0, 32)
  }

  const s0 = styles[0]?.trim()
  if (s0) {
    const simple = s0.split(/[\/,]/)[0].trim().toLowerCase()
    if (simple.length <= 40) return simple
  }

  return null
}

async function discogsFetchJson<T>(url: string, creds: NonNullable<ReturnType<typeof getDiscogsCredentials>>, userAgent: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": userAgent,
      Authorization: discogsAuthHeader(creds),
    },
    signal: AbortSignal.timeout(25_000),
  })
  if (res.status === 429) {
    const err = new Error("Discogs rate limit (429)")
    ;(err as Error & { status?: number }).status = 429
    throw err
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Discogs HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

type SearchResponse = {
  results?: Array<{
    type: string
    id: number
    resource_url: string
    title?: string
  }>
}

type ReleaseOrMasterResponse = {
  id: number
  genres?: string[]
  styles?: string[]
}

function pickReleaseOrMasterResults(s: SearchResponse): NonNullable<SearchResponse["results"]> {
  const rows = s.results ?? []
  const picked = rows.filter((row) => {
    const t = (row.type || "").toLowerCase()
    return (t === "release" || t === "master") && Boolean(row.resource_url)
  })
  if (picked.length === 0 && rows.length > 0 && DEBUG) {
    dlog("search returned rows but no release/master:", rows.slice(0, 5).map((r) => `${r.type}:${r.title ?? r.id}`))
  }
  return picked
}

/** Ordered search URLs for one (artist, track) pair — track = song name, not album. */
function searchUrlsForPair(artist: string, track: string): string[] {
  const a = artist.slice(0, 100)
  const tr = track.slice(0, 100)
  const q = `${a} ${tr}`.slice(0, 170).trim()
  return [
    // Broad text search first — Discogs' combined index matches real-world metadata best
    `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&per_page=25`,
    `https://api.discogs.com/database/search?artist=${encodeURIComponent(a)}&track=${encodeURIComponent(tr)}&per_page=15`,
    `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=15`,
    `https://api.discogs.com/database/search?q=${encodeURIComponent(tr)}&artist=${encodeURIComponent(a)}&per_page=15`,
  ]
}

/** When we only have a title string (or channel is useless), try track-only / title-only queries. */
function searchUrlsTitleFallbacks(cleanTitle: string): string[] {
  const t = cleanTitle.slice(0, 120).trim()
  if (t.length < 2) return []
  return [
    `https://api.discogs.com/database/search?track=${encodeURIComponent(t)}&per_page=25`,
    `https://api.discogs.com/database/search?q=${encodeURIComponent(t)}&per_page=25`,
    `https://api.discogs.com/database/search?q=${encodeURIComponent(t)}&type=release&per_page=25`,
  ]
}

/**
 * Search for a release and return genres/styles from the best matching release or master.
 */
export async function fetchDiscogsGenreForTrack(
  channel: string,
  videoTitle: string,
  options?: { userAgent?: string }
): Promise<{ genre: string | null; releaseId?: number; genres: string[]; styles: string[] } | null> {
  const creds = getDiscogsCredentials()
  if (!creds) return null
  const auth = creds

  const ua = options?.userAgent?.trim() || process.env.DISCOGS_USER_AGENT?.trim() || DEFAULT_UA
  const cleanTitle = cleanYoutubeTitleForDiscogs(videoTitle)
  const pairs = discogsSearchPairs(channel, videoTitle)

  async function runSearchList(urls: string[], label: string): Promise<NonNullable<SearchResponse["results"]>> {
    for (const searchUrl of urls) {
      try {
        const s = await discogsFetchJson<SearchResponse>(searchUrl, auth, ua)
        const n = s.results?.length ?? 0
        if (DEBUG) dlog(label, n, "results", searchUrl.slice(0, 120))
        const r = pickReleaseOrMasterResults(s)
        if (r.length > 0) return r
      } catch (e) {
        dlog(label, "fail", searchUrl.slice(0, 100), e instanceof Error ? e.message : e)
      }
    }
    return []
  }

  let results: NonNullable<SearchResponse["results"]> = []

  for (const { artist, track } of pairs) {
    results = await runSearchList(searchUrlsForPair(artist, track), "pair")
    if (results.length > 0) break
  }

  if (results.length === 0 && cleanTitle.length > 0) {
    results = await runSearchList(searchUrlsTitleFallbacks(cleanTitle), "title-fallback")
  }

  if (results.length === 0) return null

  const first = results[0]
  let detail: ReleaseOrMasterResponse
  try {
    detail = await discogsFetchJson<ReleaseOrMasterResponse>(first.resource_url, auth, ua)
  } catch (e) {
    dlog("release fetch failed", first.resource_url, e instanceof Error ? e.message : e)
    return null
  }

  const genres = detail.genres ?? []
  const styles = detail.styles ?? []
  const genre = mapDiscogsToAppGenre(genres, styles)

  return {
    genre,
    releaseId: detail.id,
    genres,
    styles,
  }
}
