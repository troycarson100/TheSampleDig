import type { ConsentRegion } from "./consent"

export type UtmParams = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
}

/** Cap stored values so a hostile query string can't bloat a row. */
const MAX_LEN = 255

function pick(params: URLSearchParams, key: string): string | null {
  const v = params.get(key)
  if (!v) return null
  return v.slice(0, MAX_LEN)
}

export function parseUtm(search: string): UtmParams {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  return {
    utmSource: pick(params, "utm_source"),
    utmMedium: pick(params, "utm_medium"),
    utmCampaign: pick(params, "utm_campaign"),
    utmContent: pick(params, "utm_content"),
    utmTerm: pick(params, "utm_term"),
  }
}

/**
 * Host of an external referrer. Same-origin referrers return null so internal
 * navigation never registers as a traffic source.
 */
export function referrerHost(
  referrer: string | null | undefined,
  selfHost?: string | null
): string | null {
  if (!referrer) return null
  let host: string
  try {
    host = new URL(referrer).host
  } catch {
    return null
  }
  if (!host) return null
  if (selfHost && host.toLowerCase() === selfHost.toLowerCase()) return null
  return host.slice(0, MAX_LEN)
}

/** EU 27 + EEA (IS, LI, NO) + UK + Switzerland. */
const STRICT_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  "IS", "LI", "NO",
  "GB", "CH",
])

/**
 * Countries we affirmatively recognize as non-strict. A code in neither set is
 * unknown, and unknown means strict — so adding a country here is the only way
 * to opt it out of the consent gate.
 */
const RELAXED_COUNTRIES = new Set([
  "US", "CA", "MX", "BR", "AR", "CL", "CO", "PE",
  "AU", "NZ", "JP", "KR", "CN", "TW", "HK", "SG", "MY", "TH", "PH", "ID", "VN", "IN", "PK", "BD",
  "ZA", "NG", "KE", "EG", "MA", "GH",
  "RU", "UA", "TR", "IL", "AE", "SA", "QA", "KW",
  "RS", "AL", "BA", "MK", "ME", "MD", "GE", "AM", "AZ", "KZ",
])

/** Unknown or missing country errs strict — never load the pixel on a guess. */
export function isStrictConsentRegion(country: string | null | undefined): boolean {
  if (!country) return true
  const code = country.trim().toUpperCase()
  if (code.length !== 2) return true
  if (STRICT_COUNTRIES.has(code)) return true
  return !RELAXED_COUNTRIES.has(code)
}

export function consentRegionFor(country: string | null | undefined): ConsentRegion {
  return isStrictConsentRegion(country) ? "strict" : "notice"
}
