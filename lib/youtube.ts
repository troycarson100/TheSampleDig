import { YouTubeVideo } from "@/types/sample"
import {
  VINYL_RIP_KEYWORDS,
  NEGATIVE_KEYWORDS,
  HARD_FILTER_PATTERNS,
  SCORING_WEIGHTS,
  DURATION_PATTERNS
} from "./youtube-config"

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/search"

/**
 * Generate high-signal query templates
 * Rotates through templates that strongly correlate with record-rip uploads
 */
function generateQueryTemplates(): string[] {
  const templates: string[] = []
  
  // Template 1: Rare groove + vinyl rip + full album
  templates.push(`"rare groove" "vinyl rip" "full album" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 2: Library music + needle drop
  templates.push(`"library music" "needle drop" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 3: 45 rpm + from vinyl
  templates.push(`"45 rpm" "from vinyl" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 4: Full LP + vinyl rip
  templates.push(`"full LP" "vinyl rip" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 5: Private press + needle drop
  templates.push(`"private press" "needle drop" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 6: Obscure + vinyl rip + instrumental
  templates.push(`"obscure" "vinyl rip" "instrumental" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 7: Rare soul + from vinyl
  templates.push(`"rare soul" "from vinyl" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 8: B-side + 45 rpm
  templates.push(`"b-side" "45 rpm" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 9: Library music + KPM/Bruton
  templates.push(`"library music" "KPM" ${NEGATIVE_KEYWORDS.join(" ")}`)
  templates.push(`"library music" "Bruton" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 10: Full EP + vinyl rip
  templates.push(`"full EP" "vinyl rip" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 11: 7 inch + from vinyl
  templates.push(`"7 inch" "from vinyl" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 12: Promo + vinyl rip
  templates.push(`"promo" "vinyl rip" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 13: Crate digger + needle drop
  templates.push(`"crate digger" "needle drop" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 14: Deep funk + vinyl rip
  templates.push(`"deep funk" "vinyl rip" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  // Template 15: Psych + full album + vinyl
  templates.push(`"psych" "full album" "vinyl" ${NEGATIVE_KEYWORDS.join(" ")}`)
  
  return templates
}

// Legacy queries (kept for backward compatibility, will be phased out)
const SEARCH_QUERIES = [
  // Bossa Nova & Brazilian - Prioritize vinyl record videos
  "bossa nova 1970s vinyl rip record spinning -review -reaction -talking -live -performance -cover -covers -playing",
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
  "rare jazz vinyl 1970s record spinning -review -reaction -talking -live -cover -covers -playing",
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
  "breakbeat vinyl record spinning -review -talking -type beat -remix -flip -live -cover -covers -playing",
  "instrumental soul vinyl -review -talking -type beat -remix -flip -live -cover -covers -playing",
  
  // Full Album & LP Formats - Prioritize vinyl
  "full album jazz 1970s vinyl -review -reaction -live -performance -cover -covers -playing",
  "LP vinyl rip funk record -review -talking -live -cover -covers -playing",
  "complete album soul vinyl -review -discussion -live -cover -covers -playing",
  "full record jazz vinyl -review -reaction -live -cover -covers -playing",
  
  // General Rare Vinyl - Prioritize static record videos
  "rare vinyl rip instrumental record spinning -review -reaction -talking -live -cover -covers -playing",
  "obscure sample break vinyl record -review -talking -discussion -live -cover -covers -playing",
  "rare groove instrumental vinyl rip -review -reaction -interview -live -cover -covers -playing",
  "crate digger sample break vinyl -review -talking -live -cover -covers -playing",
  "vinyl only sample instrumental record -review -talking -discussion -live -cover -covers -playing",
  "rare record full album vinyl -review -reaction -live -cover -covers -playing",
  "obscure record LP vinyl rip -review -unboxing -live -cover -covers -playing",
  
  // Explicit vinyl record image queries
  "vinyl record spinning audio -cover -covers -playing", 
  "record spinning music -cover -covers -playing",
  "vinyl rip with record image -cover -covers -playing",
  "old vinyl record audio -cover -covers -playing",
  "vintage record spinning -cover -covers -playing",
  "LP record audio -cover -covers -playing",
  "vinyl record playback -cover -covers -playing"
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
function getRandomQueryTemplate(): string {
  const templates = generateQueryTemplates()
  return templates[Math.floor(Math.random() * templates.length)]
}

/**
 * Extract genre and era from search query and video metadata
 * Checks title, description, tags, and query equally - first pattern match wins
 */
function extractMetadata(query: string, title?: string, description?: string, tags?: string[]): { genre?: string; era?: string; label?: string } {
  const allText = `${query} ${title || ""} ${description || ""} ${(tags || []).join(" ")}`.toLowerCase()
  
  // Genre detection - check query first, then description/tags
  const genrePatterns = [
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
      if (matched.includes("bossa") || matched.includes("brazilian")) {
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
  
  // Era detection - look for years
  const eraMatch = allText.match(/(19[6-9]\d|20[0-1]\d)/)
  let era: string | undefined
  if (eraMatch) {
    const year = parseInt(eraMatch[1])
    if (year >= 1960 && year < 1970) era = "1960s"
    else if (year >= 1970 && year < 1980) era = "1970s"
    else if (year >= 1980 && year < 1990) era = "1980s"
    else if (year >= 1990 && year < 2000) era = "1990s"
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
  
  return { genre, era, label }
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
 * Get video details including duration, description, and tags
 */
async function getVideoDetails(videoId: string): Promise<{ 
  duration: number;
  description?: string;
  tags?: string[];
} | null> {
  if (!YOUTUBE_API_KEY) return null

  try {
    const params = new URLSearchParams({
      part: "contentDetails,snippet",
      id: videoId,
      key: YOUTUBE_API_KEY,
    })

    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
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
  if (!YOUTUBE_API_KEY) return null

  try {
    const params = new URLSearchParams({
      part: "snippet",
      id: videoId,
      key: YOUTUBE_API_KEY,
    })

    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
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
 * Hard filter: Remove obvious bad matches before scoring
 * Returns true if video should be rejected immediately
 */
function shouldHardFilter(
  title: string,
  channelTitle: string,
  description?: string
): boolean {
  const titleLower = title.toLowerCase()
  const channelLower = channelTitle.toLowerCase()
  const descLower = (description || "").toLowerCase()
  
  // Check title/channel patterns
  for (const pattern of HARD_FILTER_PATTERNS.titleChannel) {
    if (titleLower.includes(pattern) || channelLower.includes(pattern)) {
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
  
  return false
}

/**
 * Calculate VinylRipScore (0-100) for a candidate video
 */
function calculateVinylRipScore(
  title: string,
  channelTitle: string,
  description: string,
  duration: number,
  channelReputation: number
): number {
  let score = 0
  const titleLower = title.toLowerCase()
  const channelLower = channelTitle.toLowerCase()
  const descLower = description.toLowerCase()
  
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
 * Search YouTube with a specific query and return filtered + scored results
 */
async function searchWithQuery(
  query: string,
  strictFiltering: boolean = false,
  excludedVideoIds: string[] = []
): Promise<Array<any>> {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY is not set")
  }

  // Search parameters focused on finding rare vinyl samples
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "50",
    order: "relevance",
    videoCategoryId: "10", // Music category
    publishedBefore: new Date("2010-01-01").toISOString(), // Prefer older videos (rare vinyl)
    key: YOUTUBE_API_KEY,
  })

  const response = await fetch(`${YOUTUBE_API_URL}?${params}`)
  
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.statusText}`)
  }

  const data = await response.json()

  if (!data.items || data.items.length === 0) {
    return []
  }

  // Filter and score videos using new algorithm
  // Limit to first 50 videos to get good candidates
  const videosToCheck = data.items.slice(0, 50)
  const scoredVideos = []
  
  for (const video of videosToCheck) {
    // Skip if this video has already been shown (CRITICAL: Check first, before any processing)
    if (excludedVideoIds.includes(video.id.videoId)) {
      console.log(`[Filter] SKIPPED: ${video.snippet.title} (${video.id.videoId}) - Already shown (${excludedVideoIds.length} total excluded)`)
      continue
    }
    
    // Get video details including duration, description, and tags
    const details = await getVideoDetails(video.id.videoId)
    
    if (!details) {
      continue
    }
    
    // Hard filter: Remove obvious bad matches before scoring
    if (shouldHardFilter(video.snippet.title, video.snippet.channelTitle, details.description)) {
      continue
    }
    
    // Duration filter: Allow 30s-70min (vinyl rips can be short tracks or full albums)
    if (details.duration < 30 || details.duration > 4200) {
      continue
    }
    
    // Get channel reputation
    const channelReputation = await getChannelReputation(
      video.snippet.channelId || video.snippet.channelTitle,
      video.snippet.channelTitle
    )
    
    // Calculate VinylRipScore
    const vinylRipScore = calculateVinylRipScore(
      video.snippet.title,
      video.snippet.channelTitle,
      details.description || "",
      details.duration,
      channelReputation
    )
    
    // Only include videos with score >= 10 (filter out low-quality matches)
    // This ensures we only get high-signal vinyl rips, not borderline cases
    if (vinylRipScore >= 10) {
      scoredVideos.push({
        ...video,
        details,
        vinylRipScore,
        duration: details.duration,
        description: details.description,
        tags: details.tags,
        channelReputation
      })
    }
    
    // If we have enough high-scoring videos, break early
    if (scoredVideos.length >= 20) {
      break
    }
  }
  
  // Sort by VinylRipScore (highest first)
  scoredVideos.sort((a, b) => b.vinylRipScore - a.vinylRipScore)
  
  // Return top 10 highest-scoring videos
  return scoredVideos.slice(0, 10)
}

/**
 * Search YouTube for a random sample with multi-pass strategy
 * @param excludedVideoIds - Array of YouTube video IDs to exclude (already shown videos)
 */
export async function findRandomSample(excludedVideoIds: string[] = []): Promise<YouTubeVideo & { genre?: string; era?: string; duration?: number }> {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY is not set")
  }

  // First pass: Try high-signal query templates
  const queryTemplate = getRandomQueryTemplate()
  let validVideos = await searchWithQuery(queryTemplate, false, excludedVideoIds)
  let usedQuery = queryTemplate
  
  // Second pass: If no results, try another template
  if (validVideos.length === 0) {
    const queryTemplate2 = getRandomQueryTemplate()
    usedQuery = queryTemplate2
    validVideos = await searchWithQuery(queryTemplate2, false, excludedVideoIds)
  }
  
  // Third pass: If still no results, try legacy queries as fallback
  if (validVideos.length === 0) {
    const fallbackQuery = getRandomSearchQuery()
    usedQuery = fallbackQuery
    validVideos = await searchWithQuery(fallbackQuery, false, excludedVideoIds)
  }

  if (validVideos.length === 0) {
    console.log(`[Dig] No valid videos found with ${excludedVideoIds.length} exclusions`)
    // If we've excluded too many videos, try again with fewer exclusions (last 50 only)
    if (excludedVideoIds.length > 50) {
      const recentExclusions = excludedVideoIds.slice(-50)
      console.log(`[Dig] Retrying with only last 50 exclusions`)
      return findRandomSample(recentExclusions)
    }
    // Last resort: try again with a different query (but keep exclusions)
    console.log(`[Dig] Retrying with same exclusions`)
    return findRandomSample(excludedVideoIds)
  }
  
  // Additional safety check: Filter out any excluded videos that might have slipped through
  const filteredVideos = validVideos.filter(v => !excludedVideoIds.includes(v.id.videoId))
  if (filteredVideos.length === 0 && validVideos.length > 0) {
    console.log(`[Dig] All ${validVideos.length} candidates were excluded, retrying...`)
    // All candidates were excluded - retry
    return findRandomSample(excludedVideoIds)
  }
  
  // Use filtered list if we filtered anything out
  if (filteredVideos.length < validVideos.length) {
    console.log(`[Dig] Filtered out ${validVideos.length - filteredVideos.length} excluded videos from candidates`)
    validVideos = filteredVideos
  }

  try {
    // Select from top-scoring videos (prefer top 3, but allow random selection from top 10)
    // This gives some variety while still prioritizing high scores
    const topCandidates = validVideos.slice(0, Math.min(3, validVideos.length))
    const candidates = topCandidates.length > 0 ? topCandidates : validVideos
    
    // Final safety check: Ensure selected video is not in excluded list
    const availableCandidates = candidates.filter(v => !excludedVideoIds.includes(v.id.videoId))
    if (availableCandidates.length === 0) {
      console.log(`[Dig] All candidates were excluded, retrying...`)
      return findRandomSample(excludedVideoIds)
    }
    
    // Randomly select from available candidates
    const randomIndex = Math.floor(Math.random() * availableCandidates.length)
    const video = availableCandidates[randomIndex]
    
    console.log(`[Dig] Selected video with VinylRipScore: ${video.vinylRipScore || 0}/100, YouTube ID: ${video.id.videoId}`)
    
    // Double-check this video is not excluded
    if (excludedVideoIds.includes(video.id.videoId)) {
      console.error(`[Dig] ERROR: Selected excluded video ${video.id.videoId}! Retrying...`)
      return findRandomSample(excludedVideoIds)
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
  } catch (error) {
    console.error("Error fetching YouTube sample:", error)
    throw error
  }
}
