import { YouTubeVideo } from "@/types/sample"

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/search"

// Curated search queries targeting rare vinyl samples
// Prioritize static vinyl record videos (image of record with audio)
// Exclude review videos, people talking, live performances, covers, etc.
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
  "producer", "beatmaker", "beat maker", "making beats",
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
 * Get a random search query from the curated list
 */
function getRandomSearchQuery(): string {
  return SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)]
}

/**
 * Extract genre and era from search query and video metadata
 */
function extractMetadata(query: string, description?: string, tags?: string[]): { genre?: string; era?: string; label?: string } {
  const allText = `${query} ${description || ""} ${(tags || []).join(" ")}`.toLowerCase()
  
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
    "type beat", "made this beat", "producer", "beatmaker", "beat maker",
    "flip", "sample flip", "remix", "chopped", "lofi beat", "hip hop beat",
    "rap beat", "trap beat", "beat tape", "free beat", "beat for sale",
    "sampled this", "drum kit", "beat breakdown", "fl studio", "ableton",
    "beat making", "original beat", "instrumental beat"
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
 * Search YouTube with a specific query and return filtered results
 */
async function searchWithQuery(
  query: string,
  strictFiltering: boolean = false
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

  // Filter and score videos - prioritize static vinyl record videos
  // Limit to first 20 videos to speed up processing
  const videosToCheck = data.items.slice(0, 20)
  const scoredVideos = []
  
  // Keywords that indicate desirable static vinyl record videos
  const vinylRecordKeywords = [
    "vinyl record", "record spinning", "vinyl rip", "LP record",
    "vinyl LP", "record image", "vinyl playback", "record audio",
    "old vinyl", "vintage record", "vinyl album", "LP audio",
    "full album vinyl", "vinyl only", "record player"
  ]
  
  for (const video of videosToCheck) {
    // Get video details including duration, description, and tags
    const details = await getVideoDetails(video.id.videoId)
    
    if (!details) {
      continue
    }
    
    // Check duration: prefer 2-10 minutes (120-600 seconds), but allow 30s-30min
    if (details.duration < 30 || details.duration > 1800) {
      continue
    }
    
    const text = `${video.snippet.title} ${video.snippet.channelTitle} ${details.description || ""} ${(details.tags || []).join(" ")}`.toLowerCase()
    
    // Check for cover/playing keywords - reject immediately if found (HIGHEST PRIORITY)
    const coverKeywords = ["cover", "covers", "cover song", "cover version", "bass cover", "guitar cover", "drum cover", "piano cover", "instrumental cover"]
    const playingKeywords = ["playing", "plays", "performs", "playing bass", "playing guitar", "playing drums", "bassist", "guitarist", "drummer", "pianist"]
    const hasCoverKeyword = coverKeywords.some(keyword => text.includes(keyword))
    const hasPlayingKeyword = playingKeywords.some(keyword => text.includes(keyword))
    
    if (hasCoverKeyword || hasPlayingKeyword) {
      console.log(`[Filter] REJECTED: ${video.snippet.title} - Cover/Playing detected`)
      continue // Immediately reject cover/playing videos
    }
    
    // Check for beat-making/producer content - reject immediately if found (HIGHEST PRIORITY)
    const beatMakingKeywords = [
      "type beat", "made this beat", "i made this beat", "producer", "beatmaker", "beat maker",
      "making beats", "flip", "sample flip", "flipped", "remix", "remixed", "chopped",
      "lofi beat", "hip hop beat", "rap beat", "trap beat", "beat tape", "beat compilation",
      "free beat", "beat for sale", "lease", "exclusive beat", "sampled this",
      "drum kit", "beat breakdown", "how i made", "making of", "beat tutorial",
      "fl studio", "ableton", "logic pro", "pro tools", "beat making", "beat production",
      "original beat", "instrumental beat", "custom beat", "custom type beat", "beat instrumental"
    ]
    const hasBeatMakingKeyword = beatMakingKeywords.some(keyword => text.includes(keyword))
    
    if (hasBeatMakingKeyword) {
      console.log(`[Filter] REJECTED: ${video.snippet.title} - Beat-making/Producer detected`)
      continue // Immediately reject beat-making videos
    }
    
    // Check for live/performance keywords - reject immediately if found
    const liveKeywords = ["live", "live at", "live from", "live performance", "live recording", "concert", "gig", "show", "on stage", "stage performance", "performed live", "in concert"]
    const hasLiveKeyword = liveKeywords.some(keyword => text.includes(keyword))
    
    if (hasLiveKeyword) {
      console.log(`[Filter] REJECTED: ${video.snippet.title} - Live performance detected`)
      continue // Immediately reject live videos
    }
    
    // Skip review/talking videos using enhanced metadata checking
    // Use stricter threshold if strictFiltering is true
    const excludeThreshold = strictFiltering ? 2 : 3
    const excludeMatches = EXCLUDE_KEYWORDS.filter(keyword => text.includes(keyword)).length
    
    if (excludeMatches >= excludeThreshold) {
      continue
    }
    
    // Score video based on desirable keywords (vinyl record indicators)
    let score = 0
    for (const keyword of vinylRecordKeywords) {
      if (text.includes(keyword)) {
        score += 2 // Boost score for vinyl record keywords
      }
    }
    
    // Prefer videos with "full album", "LP", "vinyl" in title
    if (video.snippet.title.toLowerCase().includes("vinyl") || 
        video.snippet.title.toLowerCase().includes("LP") ||
        video.snippet.title.toLowerCase().includes("full album")) {
      score += 3 // Extra boost for title matches
    }
    
    // Prefer duration in 2-10 minute range
    const preferred = details.duration >= 120 && details.duration <= 600
    if (preferred) {
      score += 1
    }
    
    scoredVideos.push({
      ...video,
      details,
      score,
      preferred
    })
    
    // If we have enough valid videos, break early
    if (scoredVideos.length >= 10) {
      break
    }
  }
  
  // Sort by score (highest first) to prioritize vinyl record videos
  scoredVideos.sort((a, b) => b.score - a.score)
  
  // Return top scored videos with proper structure
  return scoredVideos.slice(0, 5).map(v => ({
    ...v,
    duration: v.details.duration,
    description: v.details.description,
    tags: v.details.tags,
    preferred: v.preferred,
    channelReputation: 0.5 // Default neutral (reputation check disabled for speed)
  }))
}

/**
 * Search YouTube for a random sample with multi-pass strategy
 */
export async function findRandomSample(): Promise<YouTubeVideo & { genre?: string; era?: string; duration?: number }> {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY is not set")
  }

  // First pass: Try with strict filtering
  const strictQueries = SEARCH_QUERIES.filter(q => q.includes("instrumental") || q.includes("full album") || q.includes("drum break"))
  const strictQuery = strictQueries[Math.floor(Math.random() * strictQueries.length)]
  const metadata = extractMetadata(strictQuery)
  
  let validVideos = await searchWithQuery(strictQuery, true)
  
  // Second pass: If no results, try broader queries with normal filtering
  if (validVideos.length === 0) {
    const query = getRandomSearchQuery()
    const queryMetadata = extractMetadata(query)
    Object.assign(metadata, queryMetadata) // Merge metadata
    validVideos = await searchWithQuery(query, false)
  }
  
  // Third pass: If still no results, try even broader search
  if (validVideos.length === 0) {
    const fallbackQuery = "rare vinyl -review -talking"
    validVideos = await searchWithQuery(fallbackQuery, false)
  }

  if (validVideos.length === 0) {
    // Last resort: try again with a different query
    return findRandomSample()
  }

  try {

    // Prioritize preferred duration videos (2-10 minutes)
    const preferredVideos = validVideos.filter(v => v.preferred)
    const candidates = preferredVideos.length > 0 ? preferredVideos : validVideos
    
    // Randomly select from candidates
    const randomIndex = Math.floor(Math.random() * candidates.length)
    const video = candidates[randomIndex]

    return {
      id: video.id.videoId,
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
      channelId: video.snippet.channelId, // Include channelId for database operations
      thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url,
      publishedAt: video.snippet.publishedAt,
      genre: metadata.genre,
      era: metadata.era,
      duration: video.duration,
    }
  } catch (error) {
    console.error("Error fetching YouTube sample:", error)
    throw error
  }
}
