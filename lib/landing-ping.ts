"use client"

import { POSTED_KEY, cacheRegion, readCachedRegion, type ConsentRegion } from "./consent"

/** Dedupes concurrent callers within a single page render. */
let inFlight: Promise<ConsentRegion> | null = null

function alreadyPosted(): boolean {
  if (typeof sessionStorage === "undefined") return false
  try {
    return sessionStorage.getItem(POSTED_KEY) === "1"
  } catch {
    return false
  }
}

function markPosted(): void {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(POSTED_KEY, "1")
  } catch {
    /* private mode — worst case we ping again next navigation, server dedupes */
  }
}

/**
 * Reports this landing to the server (at most once per tab) and resolves the
 * visitor's consent region.
 *
 * The server sets sr_vid on first contact and skips the insert afterwards, so
 * a duplicate ping is harmless — but the sessionStorage guard means a returning
 * visitor's region must come from cache, since the request won't repeat.
 * Falls back to "strict": losing pixel data is acceptable, loading the pixel
 * without consent is not.
 */
export function ensureLandingPing(): Promise<ConsentRegion> {
  if (inFlight) return inFlight

  const cached = readCachedRegion()
  if (cached && alreadyPosted()) return Promise.resolve(cached)

  inFlight = (async (): Promise<ConsentRegion> => {
    try {
      const res = await fetch("/api/attribution/landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrer: document.referrer || null,
          search: window.location.search,
          path: window.location.pathname,
        }),
      })
      markPosted()
      const data = (await res.json()) as { region?: unknown }
      const region: ConsentRegion = data.region === "notice" ? "notice" : "strict"
      cacheRegion(region)
      return region
    } catch {
      return cached ?? "strict"
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
