/**
 * Discogs API helpers: search releases and map genres/styles to app genre strings
 * (lowercase, aligned with extractMetadata in lib/youtube.ts).
 *
 * Env (either):
 *   DISCOGS_PERSONAL_TOKEN — from https://www.discogs.com/settings/developers
 *   DISCOGS_CONSUMER_KEY + DISCOGS_CONSUMER_SECRET — app credentials
 *
 * All requests must send a descriptive User-Agent (Discogs requirement).
 */

const DEFAULT_UA = "SampleRoll/1.0 +https://sampleroll.com (genre backfill)"

export function getDiscogsCredentials():
  | { kind: "token"; token: string }
  | { kind: "consumer"; key: string; secret: string }
  | null {
  const token = process.env.DISCOGS_PERSONAL_TOKEN?.trim()
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

type ReleaseResponse = {
  id: number
  genres?: string[]
  styles?: string[]
}

/**
 * Search for a release and return genres/styles from the best matching release.
 */
export async function fetchDiscogsGenreForTrack(
  artist: string,
  trackTitle: string,
  options?: { userAgent?: string }
): Promise<{ genre: string | null; releaseId?: number; genres: string[]; styles: string[] } | null> {
  const creds = getDiscogsCredentials()
  if (!creds) return null

  const ua = options?.userAgent?.trim() || process.env.DISCOGS_USER_AGENT?.trim() || DEFAULT_UA
  const cleanArtist = artist.replace(/\s*-\s*Topic\s*$/i, "").trim()
  const cleanTitle = trackTitle
    .replace(/\s*[\[(](?:official|remastered?|remaster|audio|video|hd|4k|full album|visualizer)[^\])]*[\])]/gi, "")
    .replace(/\s*-\s*Official\b.*$/i, "")
    .trim()

  if (!cleanArtist || !cleanTitle) return null

  const q = `${cleanArtist} ${cleanTitle}`.slice(0, 170).trim()
  const searchUrls = [
    `https://api.discogs.com/database/search?type=release&artist=${encodeURIComponent(cleanArtist)}&release_title=${encodeURIComponent(cleanTitle)}&per_page=5`,
    `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`,
  ]

  type ResultRow = NonNullable<SearchResponse["results"]>[number]
  let results: ResultRow[] = []
  for (const searchUrl of searchUrls) {
    try {
      const s = await discogsFetchJson<SearchResponse>(searchUrl, creds, ua)
      const r = s.results?.filter((row) => row.type === "release" && row.resource_url) ?? []
      if (r.length > 0) {
        results = r
        break
      }
    } catch {
      continue
    }
  }
  if (results.length === 0) return null

  const first = results[0]
  let release: ReleaseResponse
  try {
    release = await discogsFetchJson<ReleaseResponse>(first.resource_url, creds, ua)
  } catch {
    return null
  }

  const genres = release.genres ?? []
  const styles = release.styles ?? []
  const genre = mapDiscogsToAppGenre(genres, styles)

  return {
    genre,
    releaseId: release.id,
    genres,
    styles,
  }
}
