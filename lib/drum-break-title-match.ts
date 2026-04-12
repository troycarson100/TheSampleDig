/** In `samples.tags`; rows with this token match Dig "drum break" filter even if title has no break keywords. */
export const DRUM_BREAK_CURATED_TAG = "drum-break-curated"

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

/** Dig / crate: curated PDF list or title phrases. */
export function sampleMatchesDrumBreakFilter(
  title: string | null | undefined,
  tags: string | null | undefined
): boolean {
  if (tags && tags.toLowerCase().includes(DRUM_BREAK_CURATED_TAG)) return true
  return titleLooksLikeDrumBreak(title)
}
