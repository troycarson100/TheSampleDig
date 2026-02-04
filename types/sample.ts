export interface YouTubeVideo {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  publishedAt: string
  duration?: number // Duration in seconds
}

export interface Sample {
  id: string
  youtubeId: string
  title: string
  channel: string
  thumbnailUrl: string
  genre?: string | null
  era?: string | null
  createdAt: Date
}

export interface SavedSample extends Sample {
  savedAt: Date
}
