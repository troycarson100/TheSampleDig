/** In `samples.tags`; rows with this token match Dig "drum break" filter even if title has no break keywords. */
export const DRUM_BREAK_CURATED_TAG = "drum-break-curated"

/**
 * Pro-only drum-break uploads: title labels like `(Drum Break)` or `[DRUM BREAK]`.
 * These are excluded from the general Dig pool and only appear when the Drum Break toggle is on.
 */
const EXCLUSIVE_DRUM_BREAK_LABEL = /[\[(]\s*drum\s+break\s*[\])]/i

export function titleIsExclusiveDrumBreakUpload(title: string | null | undefined): boolean {
  if (!title || typeof title !== "string") return false
  return EXCLUSIVE_DRUM_BREAK_LABEL.test(title)
}

/** Title phrases that suggest a drum-break or breakbeat video (matches Dig / DB drum-break filter). */
export const DRUM_BREAK_TITLE_PHRASES = [
  "drum break",
  "breakbeat",
  "break beat",
  "break loop",
  "drum solo",
  "break sample",
  "drum sample",
] as const

/** Case-insensitive: true if the title contains any drum-break phrase (same semantics as dig drum-break mode). */
export function titleLooksLikeDrumBreak(title: string | null | undefined): boolean {
  if (!title || typeof title !== "string") return false
  const t = title.toLowerCase()
  return DRUM_BREAK_TITLE_PHRASES.some((phrase) => t.includes(phrase))
}

/** Dig / crate: curated PDF list or title phrases (includes exclusive parenthetical uploads). */
export function sampleMatchesDrumBreakFilter(
  title: string | null | undefined,
  tags: string | null | undefined
): boolean {
  if (tags && tags.toLowerCase().includes(DRUM_BREAK_CURATED_TAG)) return true
  return titleLooksLikeDrumBreak(title)
}
