import { YouTubeVideo } from "@/types/sample"

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/search"

// Curated search queries targeting rare vinyl samples
// Exclude review videos, people talking, etc.
const SEARCH_QUERIES = [
  // Bossa Nova & Brazilian
  "bossa nova 1970s vinyl -review -reaction -reaction video",
  "rare bossa nova sample -review -talking",
  "brazilian jazz 1960s vinyl rip -review",
  "obscure bossa nova -review -reaction",
  
  // Prog & Psychedelic
  "prog psychedelic jazz groove -review -reaction",
  "rare prog rock sample -review -talking",
  "psychedelic jazz 1970s vinyl -review",
  "obscure prog rock vinyl rip -review",
  
  // Jazz & Fusion
  "rare jazz vinyl 1970s -review -reaction",
  "obscure jazz sample -review -talking",
  "jazz fusion 1970s -review",
  "rare groove jazz -review -reaction",
  
  // Funk & Soul
  "rare funk vinyl 1970s -review -reaction",
  "obscure soul sample -review -talking",
  "rare groove funk -review",
  "deep funk 1970s vinyl -review",
  
  // General Rare Vinyl
  "rare vinyl rip -review -reaction",
  "obscure sample -review -talking",
  "rare groove -review -reaction",
  "crate digger sample -review",
  "vinyl only sample -review -talking",
  "rare record -review -reaction",
  "obscure record -review",
]

// Keywords that indicate review/talking videos (to filter out)
const EXCLUDE_KEYWORDS = [
  "review", "reaction", "reaction video", "talking", "discussion",
  "breakdown", "analysis", "explained", "interview", "podcast",
  "unboxing", "unbox", "first listen", "first impression"
]

/**
 * Get a random search query from the curated list
 */
function getRandomSearchQuery(): string {
  return SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)]
}

/**
 * Extract genre and era from search query
 */
function extractMetadata(query: string): { genre?: string; era?: string } {
  const genreMatch = query.match(/(bossa nova|jazz|funk|soul|prog|psychedelic)/i)
  const eraMatch = query.match(/(1960s|1970s|1980s)/i)
  
  return {
    genre: genreMatch ? genreMatch[1].toLowerCase() : undefined,
    era: eraMatch ? eraMatch[1] : undefined,
  }
}

/**
 * Check if video title/channel suggests it's a review or talking video
 */
function isReviewOrTalkingVideo(title: string, channelTitle: string): boolean {
  const text = `${title} ${channelTitle}`.toLowerCase()
  return EXCLUDE_KEYWORDS.some(keyword => text.includes(keyword))
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
 * Get video details including duration
 */
async function getVideoDetails(videoId: string): Promise<{ duration: number } | null> {
  if (!YOUTUBE_API_KEY) return null

  try {
    const params = new URLSearchParams({
      part: "contentDetails",
      id: videoId,
      key: YOUTUBE_API_KEY,
    })

    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
    if (!response.ok) return null

    const data = await response.json()
    if (!data.items || data.items.length === 0) return null

    const duration = parseDuration(data.items[0].contentDetails.duration)
    return { duration }
  } catch (error) {
    console.error("Error fetching video details:", error)
    return null
  }
}

/**
 * Search YouTube for a random sample
 */
export async function findRandomSample(): Promise<YouTubeVideo & { genre?: string; era?: string; duration?: number }> {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY is not set")
  }

  const query = getRandomSearchQuery()
  const metadata = extractMetadata(query)

  // Search parameters focused on finding rare vinyl samples
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "50",
    order: "relevance",
    videoCategoryId: "10", // Music category
    key: YOUTUBE_API_KEY,
  })

  try {
    const response = await fetch(`${YOUTUBE_API_URL}?${params}`)
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      // Fallback to a simpler search if no results
      return findRandomSample()
    }

    // Filter and randomly select from results
    const validVideos = []
    for (const video of data.items) {
      // Skip review/talking videos
      if (isReviewOrTalkingVideo(video.snippet.title, video.snippet.channelTitle)) {
        continue
      }

      // Get video duration to ensure it's >30 seconds
      const details = await getVideoDetails(video.id.videoId)
      if (details && details.duration >= 30) {
        validVideos.push({ ...video, duration: details.duration })
      } else if (!details) {
        // If we can't get duration, include it anyway (fallback)
        validVideos.push(video)
      }
    }

    // If no valid videos found, try again
    if (validVideos.length === 0) {
      return findRandomSample()
    }

    // Randomly select from valid videos
    const randomIndex = Math.floor(Math.random() * validVideos.length)
    const video = validVideos[randomIndex]

    return {
      id: video.id.videoId,
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
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
