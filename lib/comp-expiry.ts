// The expiry an admin sets on a comp code or a gift link, from the form.
// Shared by the comps and gifts admin routes so they can never drift.

export type ExpiresAtResult = { ok: true; value: Date | null } | { ok: false; error: string }

// The admin form sends a date-only string (e.g. "2026-08-20") from an
// <input type="date">, which Date parses as UTC MIDNIGHT — the evening
// before in US timezones, and compCodeStatus treats <= now as expired.
// Bump a date-only value to the END of that day (UTC) so "expires Aug 20"
// actually covers Aug 20 everywhere. This codebase doesn't track an admin's
// timezone anywhere, so end-of-day-UTC is simple and sufficient rather than
// true per-timezone handling. Shared by POST (set on create) and PATCH (bulk
// edit) so the two can never drift apart on this.
export function parseExpiresAt(input: unknown): ExpiresAtResult {
  if (typeof input !== "string" || !input.trim()) return { ok: true, value: null }

  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return { ok: false, error: "Invalid expiration date." }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(input.trim())
  if (dateOnly) parsed.setUTCHours(23, 59, 59, 999)

  if (parsed.getTime() <= Date.now()) return { ok: false, error: "Expiration date is already in the past." }

  return { ok: true, value: parsed }
}
