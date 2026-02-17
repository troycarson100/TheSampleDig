/**
 * Fetch BPM and key for a track using external metadata APIs (no YouTube audio / yt-dlp).
 * Used to backfill Sample.bpm and Sample.key without violating YouTube ToS.
 *
 * Primary: Spotify Web API (search by title + artist, then get audio features).
 * Fallback: Google Custom Search API – search "artist title BPM key" and parse snippets.
 * Requires SPOTIFY_* for Spotify; GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID for Google fallback.
 */

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

export interface BpmKeyResult {
  bpm: number | null
  key: string | null
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env")
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Spotify token failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return cachedToken.token
}

/**
 * Search Spotify for a track by title and artist, then get audio features (BPM, key).
 * Returns nulls if not found or if Audio Features are restricted (403).
 */
export async function getBpmKeyFromSpotify(title: string, artist: string): Promise<BpmKeyResult> {
  const token = await getSpotifyToken()
  const query = [title.trim(), artist.trim()].filter(Boolean).join(" ")
  if (!query) return { bpm: null, key: null }

  const searchRes = await fetch(
    "https://api.spotify.com/v1/search?" +
      new URLSearchParams({
        q: `track:${title.trim()} artist:${artist.trim()}`.slice(0, 200),
        type: "track",
        limit: "1",
      }),
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!searchRes.ok) {
    if (searchRes.status === 429) throw new Error("Spotify rate limited (429)")
    return { bpm: null, key: null }
  }

  const searchData = (await searchRes.json()) as {
    tracks?: { items?: Array<{ id: string }> }
  }
  const trackId = searchData.tracks?.items?.[0]?.id
  if (!trackId) return { bpm: null, key: null }

  const featuresRes = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!featuresRes.ok) {
    if (featuresRes.status === 403) {
      console.warn("[metadata-bpm-key] Spotify Audio Features 403 – app may not have access (new apps after Nov 2024)")
    }
    if (featuresRes.status === 429) throw new Error("Spotify rate limited (429)")
    return { bpm: null, key: null }
  }

  const features = (await featuresRes.json()) as {
    tempo?: number
    key?: number
    mode?: number
  }
  const bpm =
    typeof features.tempo === "number" && features.tempo > 0 && features.tempo < 300
      ? Math.round(features.tempo)
      : null
  let key: string | null = null
  if (typeof features.key === "number" && features.key >= 0 && features.key <= 11) {
    const pitch = PITCH_NAMES[features.key]
    const mode = features.mode === 0 ? "m" : ""
    key = pitch ? `${pitch}${mode}` : null
  }
  return { bpm, key }
}

/**
 * Fetch BPM and key via Google Custom Search: search "artist title BPM key", parse snippets.
 * Free tier: 100 queries/day. Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID in .env.
 */
export async function getBpmKeyFromGoogleSearch(title: string, artist: string): Promise<BpmKeyResult> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY?.trim()
  const cx = process.env.GOOGLE_CSE_ID?.trim()
  if (!apiKey || !cx) return { bpm: null, key: null }

  const query = [artist.trim(), title.trim(), "BPM", "key"].filter(Boolean).join(" ").slice(0, 200)
  if (!query) return { bpm: null, key: null }

  const url =
    "https://www.googleapis.com/customsearch/v1?" +
    new URLSearchParams({
      key: apiKey,
      cx,
      q: query,
      num: "10",
    })
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return { bpm: null, key: null }
  }
  if (!res.ok) {
    if (res.status === 429) throw new Error("Google Custom Search rate limited (429)")
    return { bpm: null, key: null }
  }

  const data = (await res.json()) as {
    items?: Array<{ title?: string; snippet?: string }>
  }
  const items = data.items || []
  const text = items
    .map((i) => [i.title, i.snippet].filter(Boolean).join(" "))
    .join(" ")
    .toLowerCase()

  let bpm: number | null = null
  let key: string | null = null

  const bpmMatch = text.match(/\b(5\d|6\d|7\d|8\d|9\d|1[0-4]\d|150)\s*bpm\b/i)
  if (bpmMatch) bpm = parseInt(bpmMatch[1], 10)
  const bpmAlt = text.match(/\bbpm[:\s]*(\d{2,3})\b/i)
  if (bpm == null && bpmAlt) {
    const n = parseInt(bpmAlt[1], 10)
    if (n >= 50 && n <= 200) bpm = n
  }

  const keyPattern =
    /\b([A-G](?:#|b)?m?)\b|key[:\s]*([A-G](?:#|b)?m?)\b|(?:in\s+)?([A-G](?:#|b)?)\s*(?:major|minor|maj|min)?\b/gi
  const keyNames = new Set(["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B", "Am", "Bm", "Cm", "Dm", "Em", "Fm", "Gm", "F#m", "C#m", "Bbm", "Ebm", "Abm", "G#m", "D#m"])
  let keyMatch: RegExpExecArray | null
  while ((keyMatch = keyPattern.exec(text)) !== null) {
    const k = (keyMatch[1] || keyMatch[2] || keyMatch[3] || keyMatch[4] || "").trim()
    const normalized = k.charAt(0).toUpperCase() + k.slice(1).replace(/db/gi, "C#").replace(/eb/gi, "D#").replace(/gb/gi, "F#").replace(/ab/gi, "G#").replace(/bb/gi, "A#")
    if (normalized && keyNames.has(normalized)) {
      key = normalized
      break
    }
  }

  return { bpm, key }
}

/**
 * Get BPM and key: uses Google Custom Search only (Spotify not used).
 */
export async function getBpmKey(title: string, artist: string): Promise<BpmKeyResult> {
  return getBpmKeyFromGoogleSearch(title, artist)
}
