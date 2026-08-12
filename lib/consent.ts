// Cookie + session-storage plumbing for consent. Pure and browser-safe: the
// document/sessionStorage reads happen inside functions, never at module load,
// so this file is importable from server routes for the constants alone.

export const VISITOR_COOKIE = "sr_vid"
export const VISITOR_MAX_AGE = 60 * 60 * 24 * 60 // 60 days, matches shft_ref

export const CONSENT_COOKIE = "sr_consent"
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180 // 180 days

/** Per-tab caches so the landing ping fires at most once per session. */
export const POSTED_KEY = "sr_attr_posted"
export const REGION_KEY = "sr_region"

export type ConsentState = "granted" | "denied" | "unset"
export type ConsentRegion = "strict" | "notice"

export function parseConsentCookie(raw: string | null | undefined): ConsentState {
  if (!raw) return "unset"
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name !== CONSENT_COOKIE) continue
    const value = rest.join("=")
    if (value === "granted" || value === "denied") return value
    return "unset"
  }
  return "unset"
}

/** Client only. Returns "unset" during SSR. */
export function readConsent(): ConsentState {
  if (typeof document === "undefined") return "unset"
  return parseConsentCookie(document.cookie)
}

/**
 * Client only. Not httpOnly by design — the pixel gate is a client-side
 * decision, so JS must be able to read this back on the next visit.
 */
export function writeConsent(state: "granted" | "denied"): void {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${CONSENT_COOKIE}=${state}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`
}

export function clearConsent(): void {
  if (typeof document === "undefined") return
  document.cookie = `${CONSENT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}

export function readCachedRegion(): ConsentRegion | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const v = sessionStorage.getItem(REGION_KEY)
    return v === "strict" || v === "notice" ? v : null
  } catch {
    return null
  }
}

export function cacheRegion(r: ConsentRegion): void {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(REGION_KEY, r)
  } catch {
    /* private mode — region simply re-resolves next navigation */
  }
}
