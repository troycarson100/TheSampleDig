import { YouTubeVideo } from "@/types/sample"
import {
  VINYL_RIP_KEYWORDS,
  NEGATIVE_KEYWORDS,
  HARD_FILTER_PATTERNS,
  HARD_FILTER_WORD_BOUNDARY_TITLE_CHANNEL,
  SCORING_WEIGHTS,
  DURATION_PATTERNS
} from "./youtube-config"
import { getCachedSearchResult, cacheSearchResult, getCachedVideoDetailsBatch, cacheVideoDetailsBatch } from "./cache"
import { getRandomSampleFromDatabase, getDatabaseSampleCount } from "./database-samples"
import { fetchWithKeyRotation, fetchWithKeyRoundRobin, getFirstYouTubeApiKey } from "./youtube-keys"
import { getRandomCrateDiggerQuery } from "./crate-digger-list"

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/search"

/**
 * Generate high-signal query templates
 * Rotates through templates that strongly correlate with record-rip uploads
 */
export function generateQueryTemplates(): string[] {
  const templates: string[] = []
  const negativeKw = NEGATIVE_KEYWORDS.join(" ")
  
  // Template 1: Rare groove + vinyl rip + full album + 1970s
  templates.push(`"rare groove" "vinyl rip" "full album" "1970s" ${negativeKw}`)
  
  // Template 2: Library music + needle drop + 1960s
  templates.push(`"library music" "needle drop" "1960s" ${negativeKw}`)
  
  // Template 3: 45 rpm + from vinyl + 1970s
  templates.push(`"45 rpm" "from vinyl" "1970s" ${negativeKw}`)
  
  // Template 4: Full LP + vinyl rip + pre-1980
  templates.push(`"full LP" "vinyl rip" "pre-1980" ${negativeKw}`)
  
  // Template 5: Private press + needle drop + 1960s
  templates.push(`"private press" "needle drop" "1960s" ${negativeKw}`)
  
  // Template 6: Obscure + vinyl rip + instrumental + 1970s
  templates.push(`"obscure" "vinyl rip" "instrumental" "1970s" ${negativeKw}`)
  
  // Template 7: Rare soul + from vinyl + 1960s
  templates.push(`"rare soul" "from vinyl" "1960s" ${negativeKw}`)
  
  // Template 8: B-side + 45 rpm + 1970s
  templates.push(`"b-side" "45 rpm" "1970s" ${negativeKw}`)
  
  // Template 9: Library music + KPM/Bruton + 1960s
  templates.push(`"library music" "KPM" "1960s" ${negativeKw}`)
  templates.push(`"library music" "Bruton" "1970s" ${negativeKw}`)
  
  // Template 10: Full EP + vinyl rip + pre-1980
  templates.push(`"full EP" "vinyl rip" "pre-1980" ${negativeKw}`)
  
  // Template 11: 7 inch + from vinyl + 1970s
  templates.push(`"7 inch" "from vinyl" "1970s" ${negativeKw}`)
  
  // Template 12: Promo + vinyl rip + 1960s
  templates.push(`"promo" "vinyl rip" "1960s" ${negativeKw}`)
  
  // Template 13: Crate digger + needle drop + 1970s
  templates.push(`"crate digger" "needle drop" "1970s" ${negativeKw}`)
  
  // Template 14: Deep funk + vinyl rip + 1960s
  templates.push(`"deep funk" "vinyl rip" "1960s" ${negativeKw}`)
  
  // Template 15: Psych + full album + vinyl + 1970s
  templates.push(`"psych" "full album" "vinyl" "1970s" ${negativeKw}`)
  
  // Template 16: Bossa nova + vinyl rip + 1960s
  templates.push(`"bossa nova" "vinyl rip" "1960s" ${negativeKw}`)
  
  // Template 17: Jazz + vinyl rip + 1970s
  templates.push(`"jazz" "vinyl rip" "1970s" ${negativeKw}`)
  
  // Template 18: Funk + vinyl rip + 1960s
  templates.push(`"funk" "vinyl rip" "1960s" ${negativeKw}`)
  
  // Template 19-25: Static album cover specific queries (HIGH PRIORITY)
  // NO spinning terms - only static images
  templates.push(`"album cover" "vinyl rip" "full album" ${negativeKw}`)
  templates.push(`"record cover" "vinyl" "1960s" ${negativeKw}`)
  templates.push(`"LP cover" "vinyl rip" "1970s" ${negativeKw}`)
  templates.push(`"static image" "vinyl rip" "album" ${negativeKw}`)
  templates.push(`"album sleeve" "vinyl" "1960s" ${negativeKw}`)
  templates.push(`"record image" "vinyl rip" "1970s" ${negativeKw}`)
  templates.push(`"album artwork" "vinyl" "full album" ${negativeKw}`)
  templates.push(`"cover art" "vinyl rip" "1960s" ${negativeKw}`)
  templates.push(`"static cover" "vinyl" "1970s" ${negativeKw}`)

  // New templates (fresh result sets; no needledrop, album art, album image)
  templates.push(`"production music" "vinyl rip" "full album" "1970s" ${negativeKw}`)
  templates.push(`"record rip" "from vinyl" "1960s" ${negativeKw}`)
  templates.push(`"vinyl transfer" "full album" "1970s" ${negativeKw}`)
  templates.push(`"complete album" "vinyl rip" "pre-1980" ${negativeKw}`)
  templates.push(`"70s" "vinyl rip" "album" ${negativeKw}`)
  templates.push(`"60s" "from vinyl" "full album" ${negativeKw}`)
  templates.push(`"private pressing" "vinyl rip" "1960s" ${negativeKw}`)
  templates.push(`"obscure record" "needle drop" "1970s" ${negativeKw}`)
  templates.push(`"obscure soul" "vinyl rip" "1960s" ${negativeKw}`)
  templates.push(`"flip side" "45 rpm" "1970s" ${negativeKw}`)
  templates.push(`"De Wolfe" "library music" "vinyl" ${negativeKw}`)
  templates.push(`"Chappell" "library music" "1960s" ${negativeKw}`)
  templates.push(`"crate digging" "vinyl rip" "full album" ${negativeKw}`)
  templates.push(`"heavy funk" "from vinyl" "1970s" ${negativeKw}`)
  templates.push(`"psychedelic" "vinyl rip" "full album" "1960s" ${negativeKw}`)
  templates.push(`"bossa" "vinyl rip" "LP" ${negativeKw}`)
  templates.push(`"record sleeve" "vinyl rip" "album" ${negativeKw}`)
  templates.push(`"album artwork" "vinyl" "full album" ${negativeKw}`)
  templates.push(`"cover art" "vinyl rip" "1970s" ${negativeKw}`)
  templates.push(`"album cover" "record rip" "1960s" ${negativeKw}`)
  templates.push(`"static image" "from vinyl" "full album" ${negativeKw}`)
  templates.push(`"record cover" "vinyl transfer" "1970s" ${negativeKw}`)
  templates.push(`"library music" "needle drop" "60s" ${negativeKw}`)
  templates.push(`"rare groove" "record sleeve" "vinyl" ${negativeKw}`)
  templates.push(`"full LP" "album artwork" "1970s" ${negativeKw}`)
  templates.push(`"7 inch" "cover art" "vinyl rip" ${negativeKw}`)
  templates.push(`"promo" "static image" "from vinyl" ${negativeKw}`)
  templates.push(`"b-side" "record sleeve" "vinyl" ${negativeKw}`)

  // Broader 2-3 phrase templates (less-mined territory, more results)
  templates.push(`"vinyl rip" "1970s" ${negativeKw}`)
  templates.push(`"vinyl rip" "1960s" ${negativeKw}`)
  templates.push(`"from vinyl" "jazz" ${negativeKw}`)
  templates.push(`"from vinyl" "funk" ${negativeKw}`)
  templates.push(`"from vinyl" "soul" ${negativeKw}`)
  templates.push(`"needle drop" "funk" ${negativeKw}`)
  templates.push(`"needle drop" "jazz" ${negativeKw}`)
  templates.push(`"full album" "vinyl" ${negativeKw}`)
  templates.push(`"vinyl rip" "album" ${negativeKw}`)
  templates.push(`"rare groove" "vinyl" ${negativeKw}`)
  templates.push(`"library music" "vinyl" ${negativeKw}`)
  templates.push(`"bossa nova" "vinyl" ${negativeKw}`)

  // International / language variants (less-mined territory)
  templates.push(`"vinyle rip" "full album" ${negativeKw}`)
  templates.push(`"rip vinyle" "1970s" ${negativeKw}`)
  templates.push(`"vinil rip" "album" ${negativeKw}`)
  templates.push(`"disco de vinil" "LP" ${negativeKw}`)
  templates.push(`"plak dinleme" "vinyl" ${negativeKw}`)
  templates.push(`"レコード" "vinyl" "album" ${negativeKw}`)
  templates.push(`"vinilo" "full album" "rip" ${negativeKw}`)
  templates.push(`"vinilo criollo" "LP" ${negativeKw}`)
  templates.push(`"vinyl criollo" "album" ${negativeKw}`)

  // Label-specific (CTI, Prestige, Carosello, Sonopresse, etc.)
  templates.push(`"CTI records" "full album" "vinyl" ${negativeKw}`)
  templates.push(`"prestige records" "vinyl rip" ${negativeKw}`)
  templates.push(`"carosello records" "vinyl" ${negativeKw}`)
  templates.push(`"sonopresse" "vinyl" "album" ${negativeKw}`)
  templates.push(`"private press" "full album" "vinyl" ${negativeKw}`)
  templates.push(`"blue note" "vinyl rip" "full album" ${negativeKw}`)
  templates.push(`"strata-east" "vinyl" ${negativeKw}`)
  templates.push(`"flying dutchman" "vinyl rip" ${negativeKw}`)
  templates.push(`"black jazz" "full album" ${negativeKw}`)
  templates.push(`"Creed Taylor" "vinyl" "jazz" ${negativeKw}`)

  return templates
}

// Legacy queries (kept for backward compatibility, will be phased out)
const SEARCH_QUERIES = [
  // Bossa Nova & Brazilian - Prioritize vinyl record videos
  "bossa nova 1970s vinyl rip album cover -review -reaction -talking -live -performance -cover -covers -playing",
  "rare bossa nova vinyl record image -review -talking -discussion -live -cover -covers -playing",
  "brazilian jazz 1960s full album vinyl -review -reaction -live -performance -cover -covers -playing",
  "obscure bossa nova LP record -review -reaction -unboxing -live -cover -covers -playing",
  "bossa nova drum break vinyl rip -review -talking -live -performance -cover -covers -playing",
  "brazilian jazz sample vinyl record -review -explained -live -cover -covers -playing",
  
  // Prog & Psychedelic - Prioritize vinyl record videos
  "prog psychedelic jazz groove vinyl record -review -reaction -live -performance -cover -covers -playing",
  "rare prog rock sample break vinyl rip -review -talking -discussion -live -cover -covers -playing",
  "psychedelic jazz 1970s full album vinyl -review -reaction -live -cover -covers -playing",
  "obscure prog rock vinyl rip record -review -unboxing -live -cover -covers -playing",
  "prog rock drum break vinyl -review -talking -live -performance -cover -covers -playing",
  "psychedelic jazz loop vinyl record -review -explained -live -cover -covers -playing",
  
  // Jazz & Fusion - Prioritize vinyl record videos
  "rare jazz vinyl 1970s album cover -review -reaction -talking -live -cover -covers -playing",
  "obscure jazz sample break vinyl rip -review -talking -discussion -live -cover -covers -playing",
  "jazz fusion 1970s full album vinyl -review -reaction -live -cover -covers -playing",
  "rare groove jazz instrumental vinyl record -review -reaction -interview -live -cover -covers -playing",
  "jazz drum break vinyl rip -review -talking -live -cover -covers -playing",
  "jazz fusion sample vinyl -review -explained -live -cover -covers -playing",
  
  // Funk & Soul - Prioritize vinyl record videos
  "rare funk vinyl 1970s record image -review -reaction -talking -live -cover -covers -playing",
  "obscure soul sample break vinyl rip -review -talking -discussion -live -cover -covers -playing",
  "rare groove funk instrumental vinyl -review -reaction -live -cover -covers -playing",
  "deep funk 1970s vinyl rip record -review -unboxing -live -cover -covers -playing",
  "funk drum break vinyl -review -talking -live -performance -cover -covers -playing",
  "soul sample loop vinyl record -review -explained -live -cover -covers -playing",
  
  // Instrumental & Sample-Friendly Formats - Prioritize vinyl
  "instrumental jazz 1970s vinyl record -review -talking -type beat -remix -flip -live -cover -covers -playing",
  "drum break rare vinyl rip -review -reaction -type beat -remix -flip -live -cover -covers -playing",
  "breakbeat vinyl album cover -review -talking -type beat -remix -flip -live -cover -covers -playing",
  "instrumental soul vinyl -review -talking -type beat -remix -flip -live -cover -covers -playing",
  
  // Full Album & LP Formats - Prioritize vinyl
  "full album jazz 1970s vinyl -review -reaction -live -performance -cover -covers -playing",
  "LP vinyl rip funk record -review -talking -live -cover -covers -playing",
  "complete album soul vinyl -review -discussion -live -cover -covers -playing",
  "full record jazz vinyl -review -reaction -live -cover -covers -playing",
  
  // General Rare Vinyl - Prioritize static record videos
  "rare vinyl rip instrumental album cover -review -reaction -talking -live -cover -covers -playing",
  "obscure sample break vinyl record -review -talking -discussion -live -cover -covers -playing",
  "rare groove instrumental vinyl rip -review -reaction -interview -live -cover -covers -playing",
  "crate digger sample break vinyl -review -talking -live -cover -covers -playing",
  "vinyl only sample instrumental record -review -talking -discussion -live -cover -covers -playing",
  "rare record full album vinyl -review -reaction -live -cover -covers -playing",
  "obscure record LP vinyl rip -review -unboxing -live -cover -covers -playing",
  
  // Explicit static vinyl record image queries (NO spinning/manipulation)
  "vinyl record image audio -cover -covers -playing -dj -scratch -spinning -rotating -mixing", 
  "album cover music -cover -covers -playing -dj -scratch -spinning -rotating -mixing",
  "vinyl rip with record image -cover -covers -playing -dj -scratch -spinning -rotating -mixing",
  "old vinyl record audio -cover -covers -playing -dj -scratch -spinning -rotating -mixing",
  "vintage album cover -cover -covers -playing -dj -scratch -spinning -rotating -mixing",
  "LP record audio -cover -covers -playing -dj -scratch -spinning -rotating -mixing",
  "static image vinyl record -cover -covers -playing -dj -scratch -spinning -rotating -mixing"
]

// Keywords that indicate review/talking videos (to filter out)
const EXCLUDE_KEYWORDS = [
  // Existing - reviews and talking
  "review", "reaction", "reaction video", "talking", "discussion",
  "breakdown", "analysis", "explained", "interview", "podcast",
  "unboxing", "unbox", "first listen", "first impression",
  // Beat making and producer content
  "type beat", "type beat", "made this beat", "i made this beat",
  "producer", "beatmaker", "beat maker", "beatmaking", "making beats",
  "flip", "sample flip", "flipped", "remix", "remixed",
  "chopped", "chopped up", "chopped and screwed",
  "lofi beat", "lofi hip hop", "lofi hiphop",
  "hip hop beat", "rap beat", "trap beat", "drill beat",
  "beat tape", "beat compilation", "beat mix",
  "producer tag", "producer tags", "beat tag",
  "free beat", "free type beat", "free for profit",
  "beat for sale", "lease", "exclusive beat",
  "sampled this", "sampled", "sample pack",
  "drum kit", "drum sample", "sample library",
  "beat breakdown", "how i made", "making of",
  "beat tutorial", "production tutorial",
  "fl studio", "ableton", "logic pro", "pro tools",
  "beat making", "beat production", "music production",
  "original beat", "original instrumental",
  "beat instrumental", "instrumental beat",
  "custom beat", "custom type beat",
  // Performance/playing videos - IMMEDIATE REJECTION
  "cover", "covers", "cover song", "cover version", "cover by", "covered by",
  "playing", "plays", "performs", "performance", "performer",
  "live performance", "live at", "live from", "live recording", "live session",
  "guitar", "guitarist", "playing guitar", "guitar cover", "guitar solo", "guitar player",
  "bass", "bassist", "playing bass", "bass cover", "bass solo", "bass player",
  "drums", "drummer", "playing drums", "drum cover", "drum solo", "drum player",
  "piano", "pianist", "playing piano", "piano cover", "piano solo", "piano player",
  "saxophone", "sax", "playing sax", "sax solo", "sax player",
  "trumpet", "trumpeter", "playing trumpet", "trumpet solo", "trumpet player",
  "violin", "violinist", "playing violin", "violin solo", "violin player",
  "acoustic", "acoustic version", "acoustic cover", "acoustic session",
  "solo", "solo performance", "solo guitar", "solo bass", "solo piano",
  "fingerstyle", "fingerpicking", "finger picking",
  "jam session", "jamming", "improv", "improvisation",
  "session", "recording session", "studio session",
  "performed by", "performed live", "live version",
  "instrumental cover", "instrumental version",
  "tribute", "tribute to", "in memory of",
  "recreation", "recreated", "recreating",
  // New additions - talking patterns
  "talks about", "discusses", "explains", "shows", "presents",
  "tells you", "goes through", "walks through", "breaks down",
  // Collection/showcase videos
  "vinyl collection", "record collection", "my collection",
  "collection tour", "showing my", "what's in my",
  // Ranking/review content
  "why this", "top 10", "top 5", "top 20", "best of", "ranking", "rated",
  "worst", "overrated", "underrated", "overhyped",
  // Unboxing/haul content
  "haul", "haul video", "what i bought", "new records",
  // Reaction/listening content
  "reacts to", "listening to", "first time hearing", "hearing for the first time",
  "my thoughts on", "my opinion on", "what i think",
  // Educational/tutorial content
  "how to", "tutorial", "guide", "tips", "tricks",
  // News/update content
  "news", "update", "announcement", "release date",
  // Comparison content
  "vs", "versus", "compared to", "comparison",
  // Other talking indicators
  "episode", "part 1", "part 2", "series", "ep", "season"
]

/**
 * Get a random search query from the curated list (legacy)
 */
function getRandomSearchQuery(): string {
  return SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)]
}

/**
 * Get a random high-signal query template
 */
export function getRandomQueryTemplate(): string {
  const templates = generateQueryTemplates()
  return templates[Math.floor(Math.random() * templates.length)]
}

/**
 * Extract genre and era from search query and video metadata
 * Checks title, description, tags, and query equally - first pattern match wins
 */
export function extractMetadata(query: string, title?: string, description?: string, tags?: string[]): { genre?: string; era?: string; year?: string; label?: string } {
  const allText = `${query} ${title || ""} ${description || ""} ${(tags || []).join(" ")}`
  const allTextLower = allText.toLowerCase()
  
  // Genre detection - check query first, then description/tags
  const genrePatterns = [
    /japanese|city pop|j-pop|japanese jazz|japanese funk|japanese soul/i,
    /bossa nova|brazilian/i,
    /jazz/i,
    /funk/i,
    /soul/i,
    /prog|progressive/i,
    /psychedelic|psych/i,
    /hip hop|hiphop/i,
    /r&b|rnb/i,
    /blues/i,
    /disco/i,
    /reggae/i,
    /latin/i,
  ]

  let genre: string | undefined
  for (const pattern of genrePatterns) {
    const match = allText.match(pattern)
    if (match) {
      const matched = match[0].toLowerCase()
      if (matched.includes("japanese") || matched.includes("city pop") || matched.includes("j-pop")) {
        genre = "japanese"
      } else if (matched.includes("bossa") || matched.includes("brazilian")) {
        genre = "bossa nova"
      } else if (matched.includes("prog") || matched.includes("progressive")) {
        genre = "prog"
      } else if (matched.includes("psych")) {
        genre = "psychedelic"
      } else if (matched.includes("r&b") || matched.includes("rnb")) {
        genre = "r&b"
      } else if (matched.includes("hip")) {
        genre = "hip hop"
      } else {
        genre = matched
      }
      break
    }
  }
  
  // Era and year detection - look for years in tags/title/description
  const eraMatch = allText.match(/(19[5-9]\d|20[0-1]\d)/)
  let era: string | undefined
  let year: string | undefined
  if (eraMatch) {
    const yearNum = parseInt(eraMatch[1])
    year = eraMatch[1]
    if (yearNum >= 1950 && yearNum < 1960) era = "1950s"
    else if (yearNum >= 1960 && yearNum < 1970) era = "1960s"
    else if (yearNum >= 1970 && yearNum < 1980) era = "1970s"
    else if (yearNum >= 1980 && yearNum < 1990) era = "1980s"
    else if (yearNum >= 1990 && yearNum < 2000) era = "1990s"
  }

  // Label detection - famous jazz/soul labels
  const labelPatterns = [
    /blue note/i,
    /impulse/i,
    /atlantic/i,
    /stax/i,
    /motown/i,
    /prestige/i,
    /verve/i,
    /riverside/i,
    /columbia/i,
    /warner/i,
  ]
  
  let label: string | undefined
  for (const pattern of labelPatterns) {
    const match = allText.match(pattern)
    if (match) {
      label = match[0]
      break
    }
  }
  
  return { genre, era, year, label }
}

/**
 * Check if video title/channel/description/tags suggests it's a review or talking video
 * Uses weighted scoring: title (weight: 3), description (weight: 2), channel (weight: 1), tags (weight: 1)
 */
function isReviewOrTalkingVideo(
  title: string, 
  channelTitle: string, 
  description?: string, 
  tags?: string[]
): boolean {
  const titleText = title.toLowerCase()
  const channelText = channelTitle.toLowerCase()
  const descText = (description || "").toLowerCase()
  const tagsText = (tags || []).join(" ").toLowerCase()
  
  // IMMEDIATE REJECTION - Cover videos (highest priority)
  const coverKeywords = [
    "cover", "covers", "cover song", "cover version", "cover by", "covered by",
    "bass cover", "guitar cover", "drum cover", "piano cover", "instrumental cover"
  ]
  
  for (const keyword of coverKeywords) {
    if (titleText.includes(keyword)) {
      console.log(`[Filter] REJECTED: Cover video detected in title: "${title}"`)
      return true
    }
    if (channelText.includes(keyword)) {
      console.log(`[Filter] REJECTED: Cover channel detected: "${channelTitle}"`)
      return true
    }
  }
  
  // IMMEDIATE REJECTION - People playing instruments
  const playingKeywords = [
    "playing", "plays", "performs", "performer",
    "playing bass", "playing guitar", "playing drums", "playing piano",
    "bassist", "guitarist", "drummer", "pianist",
    "bass player", "guitar player", "drum player", "piano player"
  ]
  
  for (const keyword of playingKeywords) {
    if (titleText.includes(keyword)) {
      console.log(`[Filter] REJECTED: Playing video detected in title: "${title}"`)
      return true
    }
  }
  
  // Check for beat-making/producer content first (higher weight)
  const beatKeywords = [
    "type beat", "made this beat", "producer", "beatmaker", "beat maker", "beatmaking",
    "flip", "sample flip", "remix", "chopped", "lofi beat", "hip hop beat",
    "rap beat", "trap beat", "beat tape", "free beat", "beat for sale",
    "sampled this", "drum kit", "beat breakdown", "fl studio", "ableton",
    "beat making", "original beat", "instrumental beat", "midi controller", "mpd", "mpc", "akai"
  ]
  
  // Check for performance/playing videos - more aggressive filtering
  const performanceKeywords = [
    "playing", "plays", "performs", "performance", "live performance",
    "live", "live at", "live from", "live recording", "live session",
    "concert", "gig", "show", "tour", "on stage", "stage performance",
    "guitar", "guitarist", "playing guitar", "guitar cover", "guitar solo",
    "bass", "bassist", "playing bass", "bass cover", "bass solo",
    "drums", "drummer", "playing drums", "drum cover", "drum solo",
    "piano", "pianist", "playing piano", "piano cover", "piano solo",
    "saxophone", "sax", "playing sax", "sax solo",
    "trumpet", "trumpeter", "playing trumpet", "trumpet solo",
    "violin", "violinist", "playing violin", "violin solo",
    "covers", "cover song", "cover version", "cover by",
    "acoustic", "acoustic version", "acoustic cover", "acoustic session",
    "solo", "solo performance", "solo guitar", "solo bass",
    "fingerstyle", "fingerpicking",
    "jam session", "jamming", "improv", "improvisation",
    "session", "recording session", "studio session",
    "performed by", "performed live", "live version",
    "in concert", "at the", "venue", "club", "bar", "festival"
  ]
  
  // Check all exclusion keywords
  const allExcludeKeywords = [...beatKeywords, ...performanceKeywords]

  for (const keyword of allExcludeKeywords) {
    if (titleText.includes(keyword)) return true
    if (channelText.includes(keyword)) return true
    if (descText.includes(keyword)) return true
    if (tagsText.includes(keyword)) return true
  }
  
  let score = 0
  
  // Check title (weight: 3)
  const titleMatches = EXCLUDE_KEYWORDS.filter(keyword => titleText.includes(keyword)).length
  score += titleMatches * 3
  
  // Check description (weight: 2)
  const descMatches = EXCLUDE_KEYWORDS.filter(keyword => descText.includes(keyword)).length
  score += descMatches * 2
  
  // Check channel (weight: 1)
  const channelMatches = EXCLUDE_KEYWORDS.filter(keyword => channelText.includes(keyword)).length
  score += channelMatches * 1
  
  // Check tags (weight: 1)
  const tagMatches = EXCLUDE_KEYWORDS.filter(keyword => tagsText.includes(keyword)).length
  score += tagMatches * 1
  
  // If score >= 3, it's likely a review/talking video
  return score >= 3
}

/**
 * Parse ISO 8601 duration (PT1M30S) to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  
  const hours = parseInt(match[1] || "0", 10)
  const minutes = parseInt(match[2] || "0", 10)
  const seconds = parseInt(match[3] || "0", 10)
  
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Get video details for multiple videos in a single API call (batch request)
 * This reduces API quota usage significantly
 */
async function getVideoDetailsBatch(videoIds: string[]): Promise<Map<string, { 
  duration: number;
  description?: string;
  tags?: string[];
}>> {
  const result = new Map()
  if (!getFirstYouTubeApiKey() || videoIds.length === 0) return result

  try {
    const batchSize = 50
    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize)
      const response = await fetchWithKeyRotation((key) => {
        const params = new URLSearchParams({
          part: "contentDetails,snippet",
          id: batch.join(","),
          key,
        })
        return fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
      })
      if (!response.ok) {
        console.warn(`[Batch] Failed to fetch batch: ${response.status}`)
        continue
      }

      const data = await response.json()
      if (data.items) {
        for (const item of data.items) {
          const duration = parseDuration(item.contentDetails.duration)
          result.set(item.id, {
            duration,
            description: item.snippet?.description,
            tags: item.snippet?.tags || [],
          })
        }
      }
    }
  } catch (error) {
    console.error("Error fetching video details batch:", error)
  }
  
  return result
}

/** Full metadata for candidate enrichment (snippet + contentDetails + status) */
export interface VideoDetailsFull {
  title: string
  channelId: string
  channelTitle: string
  thumbnail: string
  publishedAt: string
  duration: number
  description?: string
  tags?: string[]
  embeddable?: boolean // false when uploader disabled embedding
}

/**
 * Get full video details for multiple videos (for candidate enrichment).
 * Cost: 1 unit per 50 videos. Includes status.embeddable to filter blocked videos.
 */
export async function getVideoDetailsFullBatch(
  videoIds: string[]
): Promise<Map<string, VideoDetailsFull>> {
  const result = new Map<string, VideoDetailsFull>()
  if (!getFirstYouTubeApiKey() || videoIds.length === 0) return result
  const batchSize = 50
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize)
    const response = await fetchWithKeyRoundRobin((key) => {
      const params = new URLSearchParams({
        part: "contentDetails,snippet,status",
        id: batch.join(","),
        key,
      })
      return fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
    })
    if (!response.ok) {
      console.warn("[YouTube] videos.list batch failed:", response.status, "skipping batch")
      continue
    }
    const data = await response.json()
    if (data.items) {
      for (const item of data.items) {
        const sn = item.snippet || {}
        result.set(item.id, {
          title: sn.title || "",
          channelId: sn.channelId || "",
          channelTitle: sn.channelTitle || "",
          thumbnail: sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url || "",
          publishedAt: sn.publishedAt || "",
          duration: parseDuration(item.contentDetails?.duration),
          description: sn.description,
          tags: sn.tags || [],
          embeddable: item.status?.embeddable !== false,
        })
      }
    }
  }
  return result
}

/**
 * Check if a video is embeddable (not blocked on external sites). Cost: 1 unit.
 * Returns true if embeddable or if check fails (allow playback); false only when explicitly not embeddable.
 */
export async function getVideoEmbeddable(youtubeId: string): Promise<boolean> {
  if (!getFirstYouTubeApiKey()) return true
  try {
    const response = await fetchWithKeyRotation((key) => {
      const params = new URLSearchParams({
        part: "status",
        id: youtubeId,
        key,
      })
      return fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
    })
    if (!response.ok) return true
    const data = await response.json()
    const item = data?.items?.[0]
    if (!item?.status) return true
    return item.status.embeddable !== false
  } catch {
    return true // on error allow (don't block the user)
  }
}

/**
 * Get video details including duration, description, and tags (single video)
 * @deprecated Use getVideoDetailsBatch for multiple videos to save quota
 */
async function getVideoDetails(videoId: string): Promise<{ 
  duration: number;
  description?: string;
  tags?: string[];
} | null> {
  if (!getFirstYouTubeApiKey()) return null

  try {
    const response = await fetchWithKeyRotation((key) => {
      const params = new URLSearchParams({
        part: "contentDetails,snippet",
        id: videoId,
        key,
      })
      return fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
    })
    if (!response.ok) return null

    const data = await response.json()
    if (!data.items || data.items.length === 0) return null

    const item = data.items[0]
    const duration = parseDuration(item.contentDetails.duration)
    
    return {
      duration,
      description: item.snippet?.description,
      tags: item.snippet?.tags || [],
    }
  } catch (error) {
    console.error("Error fetching video details:", error)
    return null
  }
}

/**
 * Get video metadata (description and tags) - separate function for when we already have duration
 */
async function getVideoMetadata(videoId: string): Promise<{
  description?: string;
  tags?: string[];
} | null> {
  if (!getFirstYouTubeApiKey()) return null

  try {
    const response = await fetchWithKeyRotation((key) => {
      const params = new URLSearchParams({
        part: "snippet",
        id: videoId,
        key,
      })
      return fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
    })
    if (!response.ok) return null

    const data = await response.json()
    if (!data.items || data.items.length === 0) return null

    const item = data.items[0].snippet
    return {
      description: item?.description,
      tags: item?.tags || [],
    }
  } catch (error) {
    console.error("Error fetching video metadata:", error)
    return null
  }
}

/**
 * Get or create channel in database and return reputation
 * Uses YouTube channelId (not channel name) for lookup
 */
async function getChannelReputation(youtubeChannelId: string, channelName: string): Promise<number> {
  try {
    const { prisma } = await import("@/lib/db")
    
    let channel = await prisma.channel.findUnique({
      where: { channelId: youtubeChannelId }
    })
    
    if (!channel) {
      // Create new channel with default reputation
      channel = await prisma.channel.create({
        data: {
          channelId: youtubeChannelId,
          name: channelName,
          reputation: 0.5, // Default neutral reputation
        }
      })
    }
    
    return channel.reputation
  } catch (error) {
    // If database fails, return neutral reputation
    console.error("Error getting channel reputation:", error)
    return 0.5
  }
}

/**
 * Hard filter: Remove obvious bad matches (live, cover, etc.) before scoring.
 * Returns true if video should be rejected immediately. Exported for scraper-only path.
 */
export function shouldHardFilter(
  title: string,
  channelTitle: string,
  description?: string
): boolean {
  const titleLower = title.toLowerCase()
  const channelLower = channelTitle.toLowerCase()
  const descLower = (description || "").toLowerCase()
  
  // Check title/channel patterns (word-boundary for short/ambiguous ones e.g. "nas")
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  for (const pattern of HARD_FILTER_PATTERNS.titleChannel) {
    const matches = HARD_FILTER_WORD_BOUNDARY_TITLE_CHANNEL.has(pattern)
      ? new RegExp(`\\b${escapeRegex(pattern)}\\b`, "i").test(titleLower) || new RegExp(`\\b${escapeRegex(pattern)}\\b`, "i").test(channelLower)
      : titleLower.includes(pattern) || channelLower.includes(pattern)
    if (matches) {
      console.log(`[Hard Filter] REJECTED: ${title} - Matches pattern: ${pattern}`)
      return true
    }
  }
  
  // Check description patterns
  for (const pattern of HARD_FILTER_PATTERNS.description) {
    if (descLower.includes(pattern)) {
      console.log(`[Hard Filter] REJECTED: ${title} - Description matches: ${pattern}`)
      return true
    }
  }

  // Reject if song/content year is 2000+ (unless free sample pack etc.)
  const allText = `${titleLower} ${descLower}`
  const modernYearMatch = allText.match(/\b(20[0-2][0-9])\b/)
  if (modernYearMatch) {
    const keepPhrases = ["free sample pack", "sample pack", "royalty free", "royalty-free", "creative commons", "cc0", "public domain", "free to use", "no copyright"]
    if (!keepPhrases.some((p) => allText.includes(p))) {
      console.log(`[Hard Filter] REJECTED: ${title} - Modern year ${modernYearMatch[1]} in title/description`)
      return true
    }
  }

  return false
}

/**
 * Calculate VinylRipScore (0-100) for a candidate video.
 * When relaxVinylIndicators is true (e.g. crate-digger artist/album search), the -80 penalty
 * for missing static/vinyl indicators is skipped so artist+album matches can pass.
 */
function calculateVinylRipScore(
  title: string,
  channelTitle: string,
  description: string,
  duration: number,
  channelReputation: number,
  relaxVinylIndicators?: boolean
): number {
  let score = 0
  const titleLower = title.toLowerCase()
  const channelLower = channelTitle.toLowerCase()
  const descLower = description.toLowerCase()
  const allText = `${titleLower} ${channelLower} ${descLower}`

  // POSITIVE SIGNALS
  
  // Title: Vinyl rip keywords (highest weight)
  const vinylRipTerms = ["vinyl rip", "needle drop", "needledrop", "from vinyl"]
  for (const term of vinylRipTerms) {
    if (titleLower.includes(term)) {
      score += SCORING_WEIGHTS.title.vinylRip
      break // Only count once
    }
  }
  
  // Title: Format indicators
  for (const format of VINYL_RIP_KEYWORDS.format) {
    if (titleLower.includes(format)) {
      score += SCORING_WEIGHTS.title.format
      break
    }
  }
  
  // Title: Library music labels
  for (const label of VINYL_RIP_KEYWORDS.libraryMusic) {
    if (titleLower.includes(label)) {
      score += SCORING_WEIGHTS.title.libraryMusic
      break
    }
  }
  
  // Title: Private press / rare groove
  for (const term of VINYL_RIP_KEYWORDS.genre) {
    if (titleLower.includes(term)) {
      score += SCORING_WEIGHTS.title.privatePress
      break
    }
  }
  
  // Description: Vinyl-related terms
  const vinylTerms = ["rip", "needle", "turntable", "vinyl", "record"]
  for (const term of vinylTerms) {
    if (descLower.includes(term)) {
      score += SCORING_WEIGHTS.description.vinylTerms
      break
    }
  }
  
  // Visual indicators (STATIC album covers, vinyl images) - HIGH PRIORITY
  // ONLY static images - NO spinning/manipulation
  const staticVisualIndicators = [
    "album cover", "record cover", "vinyl cover", "LP cover",
    "record image", "vinyl image", "album image",
    "album sleeve", "record sleeve", "vinyl sleeve", "LP sleeve",
    "static image", "static cover", "full album cover",
    "album artwork", "cover art", "sleeve art"
  ]
  
  // DJ/manipulation indicators (NEGATIVE - reject these)
  // Relaxed: removed "turntable" (vinyl rips say "from my turntable"), "mixing"
  const djManipulationIndicators = [
    "scratch", "scratching", "turntablism", "beat juggling",
    "dj set", "dj mix", "mix set", "dj scratch", "scratch dj", "dj turntable", "turntable scratch",
    "vinyl manipulation", "record manipulation", "spinning", "rotating",
    "hands on", "hand on", "manipulating", "manipulation"
  ]
  
  // Check for DJ/manipulation indicators first (immediate rejection)
  for (const indicator of djManipulationIndicators) {
    if (titleLower.includes(indicator) || descLower.includes(indicator) || channelLower.includes(indicator)) {
      score -= 100 // Massive penalty - reject DJ/manipulation videos
      console.log(`  - DJ/Manipulation indicator: "${indicator}" (-100)`)
      break
    }
  }
  
  // Count static visual indicators (ONLY static images)
  let visualIndicatorCount = 0
  for (const indicator of staticVisualIndicators) {
    if (titleLower.includes(indicator) || descLower.includes(indicator)) {
      visualIndicatorCount++
      score += 25 // Higher weight for static visual indicators
      console.log(`  + Static visual indicator: "${indicator}" (+25)`)
    }
  }
  
  // REQUIRE at least ONE static visual indicator (album cover, static image, etc.)
  // This ensures we only get static images, not DJ/manipulation videos
  const hasStaticVisualIndicator = visualIndicatorCount > 0
  // Use title AND description so we match the pass gate (which uses title+description+tags)
  const textForVinylSignals = `${titleLower} ${descLower}`
  const hasStrongVinylSignals = (
    textForVinylSignals.includes("vinyl rip") ||
    textForVinylSignals.includes("needle drop") ||
    textForVinylSignals.includes("from vinyl") ||
    textForVinylSignals.includes("45 rpm") ||
    textForVinylSignals.includes("45rpm") ||
    textForVinylSignals.includes("full album") ||
    textForVinylSignals.includes("library music") ||
    textForVinylSignals.includes(" LP ") ||
    textForVinylSignals.includes(" lp ") ||
    titleLower.includes("LP") ||
    titleLower.includes("vinyl") ||
    titleLower.startsWith("lp ") ||
    titleLower.startsWith("lp/") ||
    textForVinylSignals.includes("7 inch")
  )
  
  // Only penalize when BOTH static and strong vinyl are missing (so "vinyl rip" in description can pass).
  // Skip this penalty when relaxVinylIndicators (crate-digger artist/album searches).
  if (!relaxVinylIndicators && !hasStaticVisualIndicator && !hasStrongVinylSignals) {
    score -= 80
    console.log(`  - No static visual/vinyl indicators (-80)`)
  }
  
  // Duration: Single track (1:30-8:00)
  if (duration >= DURATION_PATTERNS.singleTrack.min && duration <= DURATION_PATTERNS.singleTrack.max) {
    score += SCORING_WEIGHTS.duration.singleTrack
  }
  
  // Duration: Full album (20:00-70:00)
  if (duration >= DURATION_PATTERNS.fullAlbum.min && duration <= DURATION_PATTERNS.fullAlbum.max) {
    score += SCORING_WEIGHTS.duration.fullAlbum
  }
  
  // Channel: Rip/dig channel indicators
  const channelIndicators = ["records", "vinyl", "rare groove", "45", "LP", "archives", "library music"]
  for (const indicator of channelIndicators) {
    if (channelLower.includes(indicator)) {
      score += SCORING_WEIGHTS.channel.ripChannel
      break
    }
  }
  
  // Channel reputation boost (0.0-1.0, convert to 0-20 points)
  score += Math.round(channelReputation * 20)
  
  // Year-based filtering: Extract year from title/description
  const yearMatch = (titleLower + " " + descLower).match(/(19[6-9]\d|20[0-1]\d)/)
  if (yearMatch) {
    const year = parseInt(yearMatch[1])
    // Penalize videos from 2000s+ (unless they have very strong vinyl signals)
    if (year >= 2000) {
      // Only penalize if score isn't already very high (strong vinyl signals override)
      if (score < 40) {
        score += SCORING_WEIGHTS.negative.mainstream // Penalize modern content
      }
    }
    // Boost videos with 1960s-1970s era indicators
    if (year >= 1960 && year < 1980) {
      score += 5 // Small bonus for pre-1980s content
    }
  }
  
  // NEGATIVE SIGNALS
  
  // Interview/talking patterns (high penalty)
  const interviewTerms = ["interview", "interviews", "talks about", "discusses", "explains", "what i think", "my thoughts", "opinion on"]
  for (const term of interviewTerms) {
    if (titleLower.includes(term) || descLower.includes(term)) {
      score += SCORING_WEIGHTS.negative.interview
      break
    }
  }
  
  // Filming/equipment patterns (high penalty)
  // These indicate videos about the equipment/process, not actual audio rips
  const filmingTerms = [
    "filming", "filming my", "my record player", "record player setup", 
    "turntable setup", "equipment", "gear", "setup", "unboxing",
    "showing my", "my collection", "collection tour", "what's in my"
  ]
  for (const term of filmingTerms) {
    if (titleLower.includes(term) || descLower.includes(term)) {
      score += SCORING_WEIGHTS.negative.filming
      break
    }
  }
  
  // If title mentions "record player" but doesn't have strong vinyl rip signals, penalize
  // This catches videos like "Filming my record player" or "My record player setup"
  if (titleLower.includes("record player") || titleLower.includes("turntable")) {
    const hasStrongSignal = titleLower.includes("vinyl rip") || 
                           titleLower.includes("needle drop") || 
                           titleLower.includes("from vinyl") ||
                           titleLower.includes("full album") ||
                           titleLower.includes("45 rpm")
    if (!hasStrongSignal) {
      score += SCORING_WEIGHTS.negative.filming // Additional penalty
    }
  }
  
  // Review/reaction patterns (high penalty)
  const reviewTerms = ["review", "reviews", "reaction", "reacts to", "breakdown", "analysis", "explained", "first listen", "unboxing"]
  for (const term of reviewTerms) {
    if (titleLower.includes(term) || descLower.includes(term)) {
      score += SCORING_WEIGHTS.negative.review
      break
    }
  }
  
  // Live/cover/lesson/tutorial/session/performance
  const negativeTerms = ["live", "cover", "lesson", "tutorial", "session", "performance", "playing"]
  for (const term of negativeTerms) {
    if (titleLower.includes(term) || descLower.includes(term)) {
      score += SCORING_WEIGHTS.negative.liveCover
      break
    }
  }
  
  // Modern hip-hop/rap penalty (aggressive - these should be filtered out)
  const modernHipHopTerms = [
    "50 cent", "fifty cent", "in da club", "get rich or die tryin",
    "drake", "kendrick", "j cole", "nas", "eminem", "snoop",
    "ice cube", "dr dre", "tupac", "biggie", "notorious",
    "lil wayne", "future", "young thug", "gunna", "lil baby",
    "post malone", "lil nas x", "travis scott", "playboi carti"
  ]
  for (const term of modernHipHopTerms) {
    if (allText.includes(term)) {
      score += SCORING_WEIGHTS.negative.mainstream * 2 // Double penalty for modern hip-hop
      console.log(`  - Penalty: Modern hip-hop "${term}" (-${SCORING_WEIGHTS.negative.mainstream * 2})`)
      break
    }
  }
  
  // Timestamps pattern (common in lessons/covers)
  // Look for patterns like "00:00", "0:00", "1:23" followed by text
  const timestampPattern = /\d{1,2}:\d{2}\s+(intro|verse|chorus|bridge|solo|break|outro)/i
  if (descLower.match(timestampPattern)) {
    score += SCORING_WEIGHTS.negative.timestamps
  }
  
  // Very short clips (<45s)
  if (duration < 45) {
    score += SCORING_WEIGHTS.negative.shortClip
  }
  
  // Clamp score to 0-100
  return Math.max(0, Math.min(100, score))
}

/**
 * Fetch one page of YouTube search results (for pagination or single page).
 * Returns raw items and nextPageToken; does not filter or score.
 * When USE_YOUTUBE_SCRAPER=true, uses Playwright to scrape search (saves Search API quota); pagination not supported.
 */
async function fetchSearchPage(
  query: string,
  publishedBeforeDate: Date | undefined,
  pageToken?: string
): Promise<{ items: any[]; nextPageToken?: string }> {
  const useScraper = process.env.USE_YOUTUBE_SCRAPER === "true"
  if (useScraper) {
    if (pageToken) {
      console.log("[Search] Scraper: pagination not supported, using first page only")
    }
    console.log(`[Search] Scraping YouTube (no Search API quota) for: ${query.substring(0, 80)}...`)
    const { scrapeYouTubeSearch } = await import("./youtube-scraper")
    const { items } = await scrapeYouTubeSearch(query, {
      timeoutMs: 25000,
      headless: true,
      enrichDetailsForFirst: 1,
    })
    return { items, nextPageToken: undefined }
  }

  const response = await fetchWithKeyRotation((key) => {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "50",
      order: "relevance",
      key,
    })
    if (publishedBeforeDate) params.set("publishedBefore", publishedBeforeDate.toISOString())
    if (pageToken) params.set("pageToken", pageToken)
    return fetch(`${YOUTUBE_API_URL}?${params}`)
  })
  const data = await response.json()
  return {
    items: data.items || [],
    nextPageToken: data.nextPageToken || undefined,
  }
}

/**
 * Search YouTube with a specific query and return filtered + scored results
 */
export async function searchWithQuery(
  query: string,
  strictFiltering: boolean = false,
  excludedVideoIds: string[] = [],
  publishedBeforeDate?: Date
): Promise<Array<any>> {
  const useScraper = process.env.USE_YOUTUBE_SCRAPER === "true"
  if (!useScraper && !getFirstYouTubeApiKey()) {
    throw new Error("No YouTube API key set. Set YOUTUBE_API_KEY or YOUTUBE_API_KEYS in .env")
  }

  // Check cache first (only for non-paginated call)
  const cached = getCachedSearchResult<Array<any>>(query, excludedVideoIds)
  if (cached) {
    console.log(`[Search] Using cached results for query: ${query.substring(0, 50)}...`)
    return cached
  }

  const dateFilter = publishedBeforeDate || new Date("2010-01-01")
  const { items } = await fetchSearchPage(query, dateFilter)

  if (!items.length) {
    console.log(`[Search] No results for query: ${query.substring(0, 50)}`)
    return []
  }

  if (useScraper) {
    const out = processVideoItemsScraperOnly(items, excludedVideoIds)
    cacheSearchResult(query, excludedVideoIds, out.results)
    return out.results
  }

  const out = await processVideoItems(items, query, excludedVideoIds)
  cacheSearchResult(query, excludedVideoIds, out.results)
  return out.results
}

/** Per-page stats for verbose populate debugging */
export interface PageStats {
  rawCount: number
  excludedCount: number
  candidateCount: number
  noDetailsCount: number
  hardFilterRejectCount: number
  indicatorRejectCount: number
  djTermsRejectCount: number
  modernHipHopRejectCount: number
  durationRejectCount: number
  scoreRejectCount: number
  passedCount: number
}

/**
 * When USE_YOUTUBE_SCRAPER is true: process scraped items without calling the YouTube API.
 * Applies same live/cover/performance hard filter as API path (title, channel, description when present).
 * Returns same shape as processVideoItems so callers work unchanged.
 */
function processVideoItemsScraperOnly(
  rawItems: any[],
  excludedVideoIds: string[]
): { results: any[]; hadCandidates: boolean } {
  const excludedSet = excludedVideoIds.length > 0 ? new Set(excludedVideoIds) : null
  let candidateVideos = excludedSet
    ? rawItems.filter((v: { id: { videoId: string } }) => !excludedSet.has(v.id.videoId))
    : rawItems
  // Apply same live/cover/performance hard filter as API search path
  candidateVideos = candidateVideos.filter((video: any) => {
    const title = video.snippet?.title ?? ""
    const channelTitle = video.snippet?.channelTitle ?? ""
    const description = video.description ?? ""
    if (shouldHardFilter(title, channelTitle, description)) {
      console.log(`[Search] Scraper hard filtered: ${title}`)
      return false
    }
    return true
  })
  if (candidateVideos.length === 0) {
    return { results: [], hadCandidates: false }
  }
  const results = candidateVideos.map((video: any) => {
    const details = {
      duration: video.duration ?? 0,
      description: (video.description ?? "") as string | undefined,
      tags: (video.tags ?? []) as string[],
    }
    return {
      ...video,
      details,
      duration: video.duration ?? null,
      description: details.description,
      tags: details.tags,
    }
  })
  console.log(`[Search] Scraper-only: ${results.length} candidates (no API calls)`)
  return { results, hadCandidates: results.length > 0 }
}

/**
 * Process raw video items into filtered + scored results.
 * Used by search and by channel/playlist discovery. Items must have id.videoId and snippet.
 */
export async function processVideoItems(
  rawItems: any[],
  query: string,
  excludedVideoIds: string[],
  options?: { verbose?: boolean; breakEarlyAt?: number; relaxVinylIndicators?: boolean }
): Promise<{ results: any[]; hadCandidates: boolean; pageStats?: PageStats }> {
  const videosToCheck = rawItems
  const excludedSet = excludedVideoIds.length > 0 ? new Set(excludedVideoIds) : null
  const verbose = options?.verbose ?? false
  const breakEarlyAt = options?.breakEarlyAt ?? 10
  const relaxVinylIndicators = options?.relaxVinylIndicators ?? false

  const stats: PageStats = {
    rawCount: rawItems.length,
    excludedCount: 0,
    candidateCount: 0,
    noDetailsCount: 0,
    hardFilterRejectCount: 0,
    indicatorRejectCount: 0,
    djTermsRejectCount: 0,
    modernHipHopRejectCount: 0,
    durationRejectCount: 0,
    scoreRejectCount: 0,
    passedCount: 0,
  }

  // Filter out excluded videos first (before API calls)
  const candidateVideos = excludedSet
    ? videosToCheck.filter((v: { id: { videoId: string } }) => !excludedSet.has(v.id.videoId))
    : videosToCheck

  stats.excludedCount = rawItems.length - candidateVideos.length
  stats.candidateCount = candidateVideos.length

  if (candidateVideos.length === 0) {
    console.log(`[Search] All ${videosToCheck.length} videos were excluded`)
    return { results: [], hadCandidates: false, ...(verbose && { pageStats: stats }) }
  }
  
  // Check cache first for batch video details
  const videoIds = candidateVideos.map((v: { id: { videoId: string } }) => v.id.videoId)
  console.log(`[Search] Fetching details for ${videoIds.length} videos in batch...`)
  
  let detailsMap = getCachedVideoDetailsBatch<Map<string, { duration: number; description?: string; tags?: string[] }>>(videoIds)
  
  if (!detailsMap) {
    // Cache miss - fetch from API
    detailsMap = await getVideoDetailsBatch(videoIds)
    // Cache the results
    if (detailsMap && detailsMap.size > 0) {
      cacheVideoDetailsBatch(videoIds, detailsMap)
    }
  } else {
    console.log(`[Search] Using cached video details for ${videoIds.length} videos`)
  }
  
  const scoredVideos = []
  
  for (const video of candidateVideos) {
    // Get video details from batch result
    const details = detailsMap.get(video.id.videoId)
    
    if (!details || !details.duration) {
      console.warn(`[Search] No details or duration for ${video.id.videoId}`)
      stats.noDetailsCount++
      continue
    }

    // Hard filter: Use full hard filter function to catch all bad matches
    const shouldReject = shouldHardFilter(
      video.snippet.title,
      video.snippet.channelTitle,
      details.description
    )
    if (shouldReject) {
      console.log(`[Search] Hard filtered: ${video.snippet.title}`)
      stats.hardFilterRejectCount++
      continue
    }
    
    // REQUIREMENT: Must have visual or strong vinyl indicators
    const titleLower = video.snippet.title.toLowerCase()
    const channelLower = video.snippet.channelTitle.toLowerCase()
    const descLower = (details.description || "").toLowerCase()
    const allText = `${titleLower} ${channelLower} ${descLower}`
    
    // REQUIRE static visual indicators (album covers, static images)
    // NO spinning/manipulation terms
    const requiredStaticIndicators = [
      "album cover", "record cover", "vinyl cover", "LP cover",
      "record image", "vinyl image", "album image",
      "album sleeve", "record sleeve", "vinyl sleeve", "LP sleeve",
      "static image", "static cover", "full album cover",
      "album artwork", "cover art", "sleeve art"
    ]
    
    // Also allow strong vinyl rip signals (but prefer static visual)
    const strongVinylSignals = [
      "vinyl rip", "needle drop", "from vinyl", "45 rpm", "45rpm", "7 inch",
      "full album", "library music", "lp", "vinyl"
    ]
    
    const hasStaticIndicator = requiredStaticIndicators.some(indicator => 
      titleLower.includes(indicator) || 
      channelLower.includes(indicator) || 
      descLower.includes(indicator)
    )
    
    const hasStrongSignal = strongVinylSignals.some(signal => 
      titleLower.includes(signal) || 
      channelLower.includes(signal) || 
      descLower.includes(signal)
    )
    
    // REJECT if it has DJ/manipulation terms (compound only - allow "DJ Archives", "Full Album Mix")
    const djTerms = ["scratch", "scratching", "turntablism", "spinning", "rotating", "manipulation", "dj mix", "dj set", "dj scratch", "scratch dj", "dj turntable", "mix set"]
    const hasDjTerms = djTerms.some(term => 
      titleLower.includes(term) || 
      channelLower.includes(term) || 
      descLower.includes(term)
    )
    
    if (hasDjTerms) {
      console.log(`[Search] REJECTED: DJ/manipulation terms in: ${video.snippet.title}`)
      stats.djTermsRejectCount++
      continue // Skip - reject DJ/manipulation videos
    }

    // Must have static indicator OR strong vinyl signal (skip when relaxVinylIndicators for crate-digger artist/album searches)
    if (!relaxVinylIndicators) {
      if (!hasStaticIndicator && !hasStrongSignal) {
        console.log(`[Search] REJECTED: No static visual/vinyl indicators in: ${video.snippet.title}`)
        stats.indicatorRejectCount++
        continue // Skip - must have at least one static visual or strong vinyl indicator
      }
      const requiredIndicators = [...requiredStaticIndicators, ...strongVinylSignals]
      const hasRequiredIndicator = requiredIndicators.some(indicator =>
        titleLower.includes(indicator) ||
        channelLower.includes(indicator) ||
        descLower.includes(indicator)
      )
      if (!hasRequiredIndicator) {
        console.log(`[Search] REJECTED: No vinyl/album indicators in: ${video.snippet.title}`)
        stats.indicatorRejectCount++
        continue // Skip - must have at least one vinyl/album indicator
      }
    }
    
    // Additional filter: Modern hip-hop/rap artists (mainstream, not rare vinyl)
    
    // List of modern/mainstream hip-hop artists (not rare vinyl material) - EXPANDED
    const modernHipHopArtists = [
      "talib kweli", "kweli", "mos def", "common", "kanye", "jay z", "jay-z",
      "drake", "kendrick", "j cole", "nas", "eminem", "50 cent", "fifty cent", "snoop",
      "ice cube", "dr dre", "tupac", "biggie", "notorious", "wu-tang",
      "outkast", "a tribe called quest", "de la soul", "public enemy",
      "run dmc", "ll cool j", "rakim", "big daddy kane", "krs-one",
      "method man", "ghostface", "raekwon", "gza", "odb", "rza",
      "the roots", "black thought", "questlove", "pharrell", "timbaland",
      "swizz beatz", "just blaze", "dj premier", "pete rock", "9th wonder",
      "j dilla", "madlib", "mf doom", "flying lotus", "knxwledge",
      "tyler the creator", "earl sweatshirt", "odd future", "asap rocky",
      "travis scott", "playboi carti", "lil uzi", "21 savage", "migos",
      "cardi b", "nicky minaj", "megan thee stallion", "dababy", "lil baby",
      "lil wayne", "nicki minaj", "future", "young thug", "gunna", "lil yachty",
      "post malone", "lil nas x", "doja cat", "ariana grande", "the weeknd",
      "juice wrld", "xxxtentacion", "polo g", "roddy ricch", "lil tecca",
      "pop smoke", "king von", "nba youngboy", "lil durk", "g herbo"
    ]
    
    // Popular modern hip-hop song titles (immediate rejection)
    const modernHipHopSongs = [
      "in da club", "get rich or die tryin", "many men", "candy shop",
      "just a lil bit", "p.i.m.p", "21 questions", "wanksta", "heat",
      "if i can't", "patiently waiting", "what up gangsta", "poor lil rich",
      "stan", "lose yourself", "without me", "the real slim shady",
      "hotline bling", "god's plan", "in my feelings", "one dance",
      "humble", "dna", "alright", "good kid", "maad city",
      "no role modelz", "work out", "crooked smile", "power trip"
    ]
    
    // Check for modern hip-hop song titles first (most specific)
    // Use word boundary for "i" so we don't reject every title containing the letter i (e.g. Incriveis, vinyl)
    let isModernSong = false
    for (const song of modernHipHopSongs) {
      const matches = song.length <= 2
        ? new RegExp(`\\b${song.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(titleLower)
        : titleLower.includes(song)
      if (matches) {
        console.log(`[Search] Hard filtered: Modern hip-hop song "${song}" in: ${video.snippet.title}`)
        isModernSong = true
        break
      }
    }
    if (isModernSong) {
      stats.modernHipHopRejectCount++
      continue // Skip this video
    }
    
    // Reject if title/channel contains modern hip-hop artist name (word-boundary for short names e.g. "nas" vs "Meninas")
    const artistWordBoundary = new Set(["nas", "gza", "odb", "rza", "j cole"])
    let isModernHipHop = false
    for (const artist of modernHipHopArtists) {
      const matches = artistWordBoundary.has(artist)
        ? new RegExp(`\\b${artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(allText)
        : allText.includes(artist)
      if (matches) {
        console.log(`[Search] Hard filtered: Modern hip-hop artist "${artist}" in: ${video.snippet.title}`)
        isModernHipHop = true
        break
      }
    }
    if (isModernHipHop) {
      stats.modernHipHopRejectCount++
      continue // Skip this video
    }
    
    // Also reject if it's clearly modern hip-hop/rap without vinyl indicators
    // Make this check MORE aggressive - reject ANY hip-hop/rap unless it has STRONG vinyl signals
    const hipHopIndicators = ["hip hop", "hip-hop", "rap", "rapper", "mc", "emcee", "gangsta", "thug"]
    const hasHipHopIndicator = hipHopIndicators.some(indicator => allText.includes(indicator))
    
    // Require MULTIPLE vinyl indicators for hip-hop/rap content (very strict)
    const vinylIndicators = [
      "vinyl rip", "needle drop", "from vinyl", "45 rpm", "full album", "rare groove",
      "vinyl", "album cover", "record cover", "static image", "lp", "7 inch", "b-side", "promo", "library music"
    ]
    const vinylIndicatorCount = vinylIndicators.filter(indicator => allText.includes(indicator)).length
    
    // If it's hip-hop/rap, require at least 2 strong vinyl indicators
    if (hasHipHopIndicator && vinylIndicatorCount < 2) {
      console.log(`[Search] Hard filtered: Hip-hop/rap without strong vinyl indicators (found ${vinylIndicatorCount}): ${video.snippet.title}`)
      stats.modernHipHopRejectCount++
      continue
    }
    
    // Additional check: If title contains artist name format (e.g., "50 Cent - Song Name")
    // and it's a modern artist, reject it immediately (word-boundary for short names e.g. nas)
    const artistTitlePattern = /^[\w\s]+[\s-]+[\w\s]+/i
    if (artistTitlePattern.test(video.snippet.title)) {
      let isModernArtistTitle = false
      for (const artist of modernHipHopArtists) {
        const matchesArtist = artistWordBoundary.has(artist)
          ? new RegExp(`\\b${artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(titleLower)
          : titleLower.startsWith(artist) || (titleLower.includes(` - `) && titleLower.includes(artist))
        if (matchesArtist) {
          console.log(`[Search] Hard filtered: Modern artist in title format: ${video.snippet.title}`)
          isModernArtistTitle = true
          break
        }
      }
      if (isModernArtistTitle) {
        stats.modernHipHopRejectCount++
        continue // Skip this video
      }
    }

    // Duration filter: Allow 30s-70min (vinyl rips can be short tracks or full albums)
    if (details.duration < 30 || details.duration > 4200) {
      stats.durationRejectCount++
      continue
    }
    
    // Get channel reputation (use default 0.5 if lookup fails or takes too long)
    // Skip reputation lookup for speed - use default neutral reputation
    // This saves database calls and speeds up search significantly
    const channelReputation = 0.5 // Default neutral reputation (was: await getChannelReputation(...))
    
    // Calculate VinylRipScore (pass relaxVinylIndicators so crate-digger queries don't get -80)
    const vinylRipScore = calculateVinylRipScore(
      video.snippet.title,
      video.snippet.channelTitle,
      details.description || "",
      details.duration,
      channelReputation,
      relaxVinylIndicators
    )
    
    // Accept videos with score >= 20 AND must have STATIC visual indicators
    // Check title + description + tags (titleLower/descLower already set above) so "vinyl rip" in description counts
    const tagsLower = (details.tags || []).join(" ").toLowerCase()
    const textForIndicator = `${titleLower} ${descLower} ${tagsLower}`
    const hasStaticVisualIndicator = (
      textForIndicator.includes("album cover") ||
      textForIndicator.includes("record cover") ||
      textForIndicator.includes("vinyl cover") ||
      textForIndicator.includes("static image") ||
      textForIndicator.includes("static cover") ||
      textForIndicator.includes("album sleeve") ||
      textForIndicator.includes("record image") ||
      textForIndicator.includes("vinyl image") ||
      textForIndicator.includes("album artwork") ||
      textForIndicator.includes("cover art")
    )
    const hasStrongVinylSignal = (
      textForIndicator.includes("vinyl rip") ||
      textForIndicator.includes("needle drop") ||
      textForIndicator.includes("from vinyl") ||
      textForIndicator.includes("45 rpm") ||
      textForIndicator.includes("45rpm") ||
      textForIndicator.includes("full album") ||
      textForIndicator.includes("library music") ||
      textForIndicator.includes(" LP ") ||
      textForIndicator.includes(" lp ") ||
      titleLower.includes("LP") ||
      titleLower.includes("vinyl") ||
      titleLower.startsWith("lp ") ||
      titleLower.startsWith("lp/")
    )
    
    // REJECT if has DJ/manipulation terms (compound only - allow "from my turntable", "Full Album Mix")
    const hasDjManipulationTerms = (
      titleLower.includes("scratch") ||
      titleLower.includes("spinning") ||
      titleLower.includes("rotating") ||
      titleLower.includes("manipulation") ||
      titleLower.includes("dj mix") ||
      titleLower.includes("dj set") ||
      titleLower.includes("mix set")
    )
    
    if (hasDjManipulationTerms) {
      console.log(`[Search] REJECTED: DJ/manipulation terms in: ${video.snippet.title}`)
      stats.djTermsRejectCount++
      continue // Skip - reject DJ/manipulation videos
    }

    // Only accept videos with:
    // 1. Score >= 15
    // 2. AND (relaxed mode for crate-digger, OR has static visual indicator OR strong vinyl signal)
    if (vinylRipScore >= 15 && (relaxVinylIndicators || hasStaticVisualIndicator || hasStrongVinylSignal)) {
      stats.passedCount++
      scoredVideos.push({
        ...video,
        details,
        vinylRipScore,
        duration: details.duration,
        description: details.description,
        tags: details.tags,
        channelReputation
      })
      
      // Break early if we have enough high-scoring videos (optimize for search; channel discovery uses breakEarlyAt=0)
      if (breakEarlyAt > 0 && scoredVideos.length >= breakEarlyAt) {
        console.log(`[Search] Found ${scoredVideos.length} high-scoring videos, breaking early for speed`)
        break
      }
    } else {
      stats.scoreRejectCount++
    }
  }

  // Sort by VinylRipScore (highest first)
  scoredVideos.sort((a, b) => b.vinylRipScore - a.vinylRipScore)
  
  console.log(`[Search] Found ${scoredVideos.length} videos with score >= 5 (top scores: ${scoredVideos.slice(0, 3).map(v => v.vinylRipScore).join(", ")})`)

  // Return top 10 highest-scoring videos (or all if less than 10); we had candidates so hadCandidates: true
  return {
    results: scoredVideos.slice(0, 10),
    hadCandidates: true,
    ...(verbose && { pageStats: stats }),
  }
}

/**
 * Paginated search: fetch one page of results and return nextPageToken for more.
 * Does not use cache. Used by populate to get more than the first page per query.
 * When options.verbose is true, includes pageStats for debugging filter bottlenecks.
 */
export async function searchWithQueryPaginated(
  query: string,
  excludedVideoIds: string[],
  publishedBeforeDate: Date | undefined,
  pageToken?: string,
  options?: { verbose?: boolean }
): Promise<{ results: any[]; nextPageToken?: string; hadCandidates: boolean; pageStats?: PageStats }> {
  const useScraper = process.env.USE_YOUTUBE_SCRAPER === "true"
  if (!useScraper && !getFirstYouTubeApiKey()) {
    throw new Error("No YouTube API key set. Set YOUTUBE_API_KEY or YOUTUBE_API_KEYS in .env")
  }
  const { items, nextPageToken } = await fetchSearchPage(query, publishedBeforeDate, pageToken)
  if (!items.length) {
    return { results: [], nextPageToken, hadCandidates: false }
  }
  if (useScraper) {
    const out = processVideoItemsScraperOnly(items, excludedVideoIds)
    return { results: out.results, nextPageToken, hadCandidates: out.hadCandidates }
  }
  const out = await processVideoItems(items, query, excludedVideoIds, options)
  return {
    results: out.results,
    nextPageToken,
    hadCandidates: out.hadCandidates,
    ...(out.pageStats && { pageStats: out.pageStats }),
  }
}

/**
 * Search YouTube for a random sample with multi-pass strategy
 * Uses database-first approach: checks database → (optional) cache/YouTube API
 * @param excludedVideoIds - Array of YouTube video IDs to exclude (already shown videos)
 * @param userId - Optional user ID to exclude their saved samples
 * @param options - databaseOnly: if true, never call YouTube API (quota-safe); genre: optional genre filter; era: optional era filter (e.g. "1960s"); drumBreakOnly: if true, prefer samples with drum-break–style titles; royaltyFreeOnly: if true, only royalty-free samples (skips era filter)
 */
export async function findRandomSample(
  excludedVideoIds: string[] = [],
  userId?: string,
  options?: { databaseOnly?: boolean; genre?: string; era?: string; drumBreakOnly?: boolean; royaltyFreeOnly?: boolean }
): Promise<YouTubeVideo & { genre?: string; era?: string; duration?: number }> {
  const databaseOnly = options?.databaseOnly === true
  const genre = options?.genre?.trim() || undefined
  const era = options?.era?.trim() || undefined
  const drumBreakOnly = options?.drumBreakOnly === true
  const royaltyFreeOnly = options?.royaltyFreeOnly === true

  // STEP 1: Try database first (fastest, no API calls)
  console.log(`[Dig] Step 1: Checking database for pre-populated samples...`)
  const dbSample = await getRandomSampleFromDatabase(excludedVideoIds, userId, genre, drumBreakOnly, era, royaltyFreeOnly)
  if (dbSample) {
    console.log(`[Dig] ✓ Found sample in database: ${dbSample.id}`)
    return dbSample
  }

  const dbCount = await getDatabaseSampleCount(excludedVideoIds, userId)
  console.log(`[Dig] Database has ${dbCount} available samples (${excludedVideoIds.length} excluded)`)

  // When databaseOnly is set (e.g. for user-facing dig), never use API — avoids quota usage
  if (databaseOnly) {
    throw new Error(
      "No samples available right now. We're adding more—try again in a few minutes, or run the populate job to fill the database."
    )
  }

  // STEP 2: Check cache for search results (in searchWithQuery)
  // STEP 3: Fall back to YouTube API (only for populate job / when databaseOnly is false)
  console.log(`[Dig] Step 3: Falling back to YouTube API...`)

  if (!getFirstYouTubeApiKey()) {
    throw new Error("No YouTube API key set and database is empty. Set YOUTUBE_API_KEY or YOUTUBE_API_KEYS in .env")
  }

  let validVideos: any[] = []
  let usedQuery = ""
  let lastError: Error | null = null

  // Crate digger pass (25%): try a random artist/album from the 700+ reference list
  if (validVideos.length === 0 && Math.random() < 0.25) {
    try {
      const crateQuery = getRandomCrateDiggerQuery()
      usedQuery = crateQuery
      validVideos = await searchWithQuery(crateQuery, false, excludedVideoIds)
      if (validVideos.length > 0) {
        console.log(`[Dig] Crate digger pass: Found ${validVideos.length} videos`)
      }
    } catch (error: any) {
      console.warn(`[Dig] Crate digger pass error:`, error?.message)
      lastError = error
    }
  }

  // First pass: Try high-signal query templates (pre-2000s default)
  if (validVideos.length === 0) {
    try {
      const queryTemplate = getRandomQueryTemplate()
      usedQuery = queryTemplate
      validVideos = await searchWithQuery(queryTemplate, false, excludedVideoIds)
      console.log(`[Dig] First pass: Found ${validVideos.length} videos`)
    } catch (error: any) {
      console.warn(`[Dig] First pass error:`, error?.message)
      lastError = error
    }
  }
  
  // Second pass: If no results, try another template
  if (validVideos.length === 0) {
    try {
      const queryTemplate2 = getRandomQueryTemplate()
      usedQuery = queryTemplate2
      validVideos = await searchWithQuery(queryTemplate2, false, excludedVideoIds)
      console.log(`[Dig] Second pass: Found ${validVideos.length} videos`)
    } catch (error: any) {
      console.warn(`[Dig] Second pass error:`, error?.message)
      lastError = error
    }
  }
  
  // Third pass: If still no results, try legacy queries
  if (validVideos.length === 0) {
    try {
      console.log(`[Dig] No results with query templates, trying legacy queries...`)
      const fallbackQuery = getRandomSearchQuery()
      usedQuery = fallbackQuery
      validVideos = await searchWithQuery(fallbackQuery, false, excludedVideoIds)
      console.log(`[Dig] Third pass: Found ${validVideos.length} videos`)
    } catch (error: any) {
      console.warn(`[Dig] Third pass error:`, error?.message)
      lastError = error
    }
  }
  
  // Fourth pass: If still no results, try with pre-2010s as last resort
  if (validVideos.length === 0) {
    try {
      console.log(`[Dig] No results, trying pre-2010s as last resort...`)
      const fallbackQuery = getRandomSearchQuery()
      usedQuery = fallbackQuery
      validVideos = await searchWithQuery(fallbackQuery, false, excludedVideoIds, new Date("2010-01-01"))
      console.log(`[Dig] Fourth pass: Found ${validVideos.length} videos`)
    } catch (error: any) {
      console.warn(`[Dig] Fourth pass error:`, error?.message)
      lastError = error
    }
  }
  
  // If we still have no results, try one more time with minimal restrictions
  if (validVideos.length === 0) {
    console.log(`[Dig] No results after all passes, trying minimal restrictions...`)
    try {
      // Try with a very simple query, no date restrictions, and minimal exclusions
      const simpleQuery = "rare vinyl"
      usedQuery = simpleQuery
      const minimalExclusions = excludedVideoIds.length > 5 ? excludedVideoIds.slice(-5) : excludedVideoIds
      validVideos = await searchWithQuery(simpleQuery, false, minimalExclusions, new Date("2020-01-01"))
      console.log(`[Dig] Minimal search: Found ${validVideos.length} videos`)
    } catch (error: any) {
      console.error(`[Dig] Minimal search also failed:`, error?.message)
      lastError = error
    }
  }
  
  // If we still have no results, try with even fewer exclusions
  if (validVideos.length === 0) {
    console.log(`[Dig] No valid videos found with ${excludedVideoIds.length} exclusions`)
    // If we've excluded too many videos, try again with fewer exclusions
    if (excludedVideoIds.length > 10) {
      const minimalExclusions = excludedVideoIds.slice(-5)
      console.log(`[Dig] Retrying with only last 5 exclusions`)
      return findRandomSample(minimalExclusions)
    }
    // Last resort: throw error with helpful message
    if (lastError) {
      throw new Error(`Failed to fetch videos: ${lastError.message}. Excluded ${excludedVideoIds.length} videos.`)
    } else {
      throw new Error(`No valid videos found. This may be due to too many exclusions (${excludedVideoIds.length} videos excluded) or overly restrictive filters. Try clearing your browser session.`)
    }
  }
  
  // Additional safety check: Filter out any excluded videos that might have slipped through
  const filteredVideos = validVideos.filter(v => {
    const isExcluded = excludedVideoIds.includes(v.id.videoId)
    if (isExcluded) {
      console.log(`[Dig] Filtered out excluded video: ${v.id.videoId} - ${v.snippet.title}`)
    }
    return !isExcluded
  })
  if (filteredVideos.length === 0 && validVideos.length > 0) {
    console.log(`[Dig] All ${validVideos.length} candidates were excluded (${excludedVideoIds.length} total exclusions), retrying...`)
    // All candidates were excluded - retry with same exclusions (they should still be excluded)
    return findRandomSample(excludedVideoIds, userId)
  }
  
  // Use filtered list if we filtered anything out
  if (filteredVideos.length < validVideos.length) {
    console.log(`[Dig] Filtered out ${validVideos.length - filteredVideos.length} excluded videos from candidates`)
    validVideos = filteredVideos
  }

  try {
    // Ensure we have at least one valid video
    if (!validVideos || validVideos.length === 0) {
      throw new Error("No valid videos found after filtering")
    }
    
    // Select from top-scoring videos (prefer top 3, but allow random selection from top 10)
    // This gives some variety while still prioritizing high scores
    const topCandidates = validVideos.slice(0, Math.min(3, validVideos.length))
    const candidates = topCandidates.length > 0 ? topCandidates : validVideos
    
    // Final safety check: Ensure selected video is not in excluded list
    const availableCandidates = candidates.filter(v => {
      const isExcluded = excludedVideoIds.includes(v.id.videoId)
      if (isExcluded) {
        console.log(`[Dig] Candidate excluded: ${v.id.videoId} - ${v.snippet.title}`)
      }
      return !isExcluded
    })
    if (availableCandidates.length === 0) {
      console.log(`[Dig] All ${candidates.length} candidates were excluded (${excludedVideoIds.length} total exclusions), retrying...`)
      // Retry with same exclusions - don't reduce them, they should still be excluded
      return findRandomSample(excludedVideoIds, userId)
    }
    
    // Randomly select from available candidates
    const randomIndex = Math.floor(Math.random() * availableCandidates.length)
    const video = availableCandidates[randomIndex]
    
    if (!video || !video.id || !video.snippet) {
      throw new Error("Invalid video object selected")
    }
    
    console.log(`[Dig] Selected video with VinylRipScore: ${video.vinylRipScore || 0}/100, YouTube ID: ${video.id.videoId}`)
    
    // Double-check this video is not excluded (CRITICAL SAFETY CHECK)
    if (excludedVideoIds.includes(video.id.videoId)) {
      console.error(`[Dig] ERROR: Selected excluded video ${video.id.videoId} - ${video.snippet.title}!`)
      console.error(`[Dig] Excluded list:`, excludedVideoIds.slice(0, 10).join(", "), excludedVideoIds.length > 10 ? "..." : "")
      console.error(`[Dig] This should never happen. Retrying with same exclusions...`)
      // Don't reduce exclusions - they should still be excluded
      // Just retry with the same exclusions
      return findRandomSample(excludedVideoIds, userId)
    }
    
    console.log(`[Dig] ✓ Selected video ${video.id.videoId} is NOT in excluded list (${excludedVideoIds.length} exclusions checked)`)
    console.log(`[Dig] Excluded videos:`, excludedVideoIds.slice(0, 5).join(", "), excludedVideoIds.length > 5 ? "..." : "")

    // Ensure video object has required properties
    if (!video || !video.id || !video.snippet) {
      throw new Error("Invalid video object: missing required properties")
    }
    
    // Video details are already fetched in searchWithQuery, use them if available
    const videoDetails = video.details || await getVideoDetails(video.id.videoId)
    
    // Extract metadata AFTER video selection using actual video title, description, and tags
    // This ensures genre is determined from the actual video content, not just the search query
    const metadata = extractMetadata(
      usedQuery, // Keep query for context
      video.snippet.title, // Video title - important for genre detection
      videoDetails?.description || video.description, // Video description
      videoDetails?.tags || video.tags // Video tags
    )

    return {
      id: video.id.videoId,
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
      channelId: video.snippet.channelId, // Include channelId for database operations
      thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url,
      publishedAt: video.snippet.publishedAt,
      genre: metadata.genre,
      era: metadata.era,
      duration: video.duration || videoDetails?.duration,
    }
  } catch (error: any) {
    console.error("Error fetching YouTube sample:", error)
    // If we have too many exclusions, try with fewer
    if (excludedVideoIds.length > 20) {
      console.log(`[Dig] Retrying with fewer exclusions due to error`)
      const lenientExclusions = excludedVideoIds.slice(-20)
      return findRandomSample(lenientExclusions)
    }
    // Re-throw the error if we can't recover
    throw new Error(`Failed to fetch video: ${error?.message || "Unknown error"}`)
  }
}
