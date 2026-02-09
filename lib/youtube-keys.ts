/**
 * Multi-key support for YouTube Data API.
 * Set YOUTUBE_API_KEYS=key1,key2,key3 in .env (or YOUTUBE_API_KEY for a single key).
 * When a request returns 403 quota exceeded, the next key is tried automatically.
 */

function getKeys(): string[] {
  const multi = process.env.YOUTUBE_API_KEYS
  if (multi?.trim()) {
    return multi.split(",").map((k) => k.trim()).filter(Boolean)
  }
  const single = process.env.YOUTUBE_API_KEY?.trim()
  if (single) return [single]
  return []
}

/** Get all configured API keys (for checks). */
export function getYouTubeApiKeys(): string[] {
  return getKeys()
}

/** Get the first key (for backward compatibility / simple checks). */
export function getFirstYouTubeApiKey(): string | undefined {
  return getKeys()[0]
}

let roundRobinIndex = 0

/**
 * Execute a YouTube API request with automatic key rotation on 403 quota exceeded.
 * Your fetchFn receives an API key and returns the Response. We try keys in order;
 * on 403 with "quota" in the body we try the next key. Returns the first successful
 * response, or throws if all keys fail or a non-quota error occurs.
 */
export async function fetchWithKeyRotation(
  fetchFn: (apiKey: string) => Promise<Response>
): Promise<Response> {
  const keys = getKeys()
  if (keys.length === 0) {
    throw new Error("No YouTube API keys configured. Set YOUTUBE_API_KEY or YOUTUBE_API_KEYS in .env")
  }
  let lastError: Error | null = null
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const res = await fetchFn(key)
    if (res.ok) return res
    const text = await res.text().catch(() => "")
    const isQuota = res.status === 403 && /quota|exceeded/i.test(text)
    if (isQuota && i < keys.length - 1) {
      console.warn(`[YouTube] Key ${i + 1}/${keys.length} quota exceeded, trying next key...`)
      lastError = new Error(`Quota exceeded: ${text.slice(0, 150)}`)
      continue
    }
    if (res.status === 403) throw new Error(`YouTube API 403: ${text.slice(0, 200)}`)
    if (res.status === 401) throw new Error(`YouTube API 401 invalid key: ${text.slice(0, 200)}`)
    throw new Error(`YouTube API ${res.status}: ${text.slice(0, 200)}`)
  }
  throw lastError ?? new Error("All YouTube API keys have exceeded quota")
}

/**
 * Same as fetchWithKeyRotation but starts with the next key in round-robin order.
 * Use for pipeline (enrich, discover) so load is spread across projects; still tries next key on 403.
 */
export async function fetchWithKeyRoundRobin(
  fetchFn: (apiKey: string) => Promise<Response>
): Promise<Response> {
  const keys = getKeys()
  if (keys.length === 0) {
    throw new Error("No YouTube API keys configured. Set YOUTUBE_API_KEY or YOUTUBE_API_KEYS in .env")
  }
  const start = (roundRobinIndex++ % keys.length + keys.length) % keys.length
  let lastError: Error | null = null
  for (let j = 0; j < keys.length; j++) {
    const i = (start + j) % keys.length
    const key = keys[i]
    const res = await fetchFn(key)
    if (res.ok) return res
    const text = await res.text().catch(() => "")
    const isQuota = res.status === 403 && /quota|exceeded/i.test(text)
    if (isQuota && j < keys.length - 1) {
      console.warn(`[YouTube] Key ${i + 1}/${keys.length} quota exceeded, trying next key...`)
      lastError = new Error(`Quota exceeded: ${text.slice(0, 150)}`)
      continue
    }
    if (res.status === 403) throw new Error(`YouTube API 403: ${text.slice(0, 200)}`)
    if (res.status === 401) throw new Error(`YouTube API 401 invalid key: ${text.slice(0, 200)}`)
    throw new Error(`YouTube API ${res.status}: ${text.slice(0, 200)}`)
  }
  throw lastError ?? new Error("All YouTube API keys have exceeded quota")
}
