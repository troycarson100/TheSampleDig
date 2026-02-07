/**
 * Score candidate videos for "sample quality" (static vinyl / album art, good for sampling).
 * Heuristic-based; optional OpenAI can be added via OPENAI_API_KEY.
 */

import { VINYL_RIP_KEYWORDS, HARD_FILTER_PATTERNS } from "./youtube-config"
import { extractMetadata } from "./youtube"

export interface ScoreResult {
  score: number // 0-100
  genre?: string
  era?: string
  rejectReason?: string
}

function toLower(s: string | undefined): string {
  return (s || "").toLowerCase()
}

/**
 * Heuristic score for "good for sampling" (static vinyl/album, not DJ/live/beatmaking).
 */
export function scoreCandidate(
  title: string,
  description?: string | null,
  tags?: string[] | null,
  channelTitle?: string | null
): ScoreResult {
  const titleLower = toLower(title)
  const descLower = toLower(description)
  const channelLower = toLower(channelTitle)
  const tagsArr = Array.isArray(tags) ? tags : []
  const tagsLower = tagsArr.join(" ").toLowerCase()
  const allText = `${titleLower} ${channelLower} ${descLower} ${tagsLower}`

  // Hard reject: any strong negative pattern
  for (const pattern of HARD_FILTER_PATTERNS.titleChannel) {
    if (titleLower.includes(pattern) || channelLower.includes(pattern)) {
      return { score: 0, rejectReason: `title/channel: ${pattern}` }
    }
  }
  for (const pattern of HARD_FILTER_PATTERNS.description) {
    if (descLower.includes(pattern) || tagsLower.includes(pattern)) {
      return { score: 0, rejectReason: `description/tags: ${pattern}` }
    }
  }

  let score = 50 // base

  // Positive: static visual / vinyl indicators (highest weight)
  const visualTerms = [...VINYL_RIP_KEYWORDS.visual]
  const hasStaticVisual = visualTerms.some(
    (t) => titleLower.includes(t) || descLower.includes(t) || tagsLower.includes(t)
  )
  if (hasStaticVisual) score += 25

  // Positive: format (full album, vinyl rip, needle drop)
  const formatTerms = [...VINYL_RIP_KEYWORDS.format]
  const formatCount = formatTerms.filter(
    (t) => titleLower.includes(t) || descLower.includes(t) || tagsLower.includes(t)
  ).length
  score += Math.min(formatCount * 5, 20)

  // Positive: library music / genre
  const libraryTerms = [...VINYL_RIP_KEYWORDS.libraryMusic, ...VINYL_RIP_KEYWORDS.genre]
  const libraryCount = libraryTerms.filter(
    (t) => titleLower.includes(t) || descLower.includes(t) || tagsLower.includes(t)
  ).length
  score += Math.min(libraryCount * 4, 15)

  // Negative: DJ/manipulation (even if not in hard filter)
  const djTerms = ["scratch", "dj ", "turntable", "spinning", "rotating", "mixing", "manipulation"]
  if (djTerms.some((t) => allText.includes(t))) score -= 40

  // Negative: live/cover/beatmaking
  const badTerms = ["live performance", "cover by", "type beat", "beat making", "lofi beat", "fl studio", "ableton", "mpc", "mpd"]
  const badCount = badTerms.filter((t) => allText.includes(t)).length
  score -= badCount * 15

  const finalScore = Math.max(0, Math.min(100, Math.round(score)))
  const metadata = extractMetadata("", title, description, tagsArr)
  return {
    score: finalScore,
    genre: metadata.genre,
    era: metadata.era,
  }
}

/**
 * Minimum score for a candidate to be promoted to Sample (configurable).
 */
export const MIN_SCORE_TO_PROMOTE = 55
