/**
 * Configuration for YouTube video selection algorithm
 * Tune these values without changing core logic
 */

// High-signal positive keywords (strong indicators of vinyl rips)
export const VINYL_RIP_KEYWORDS = {
  // Format indicators
  format: [
    "full album", "full LP", "full EP", "complete album",
    "vinyl rip", "needle drop", "needledrop", "from vinyl", "vinyl", "rip",
    "45 rpm", "7inch", "7 inch", "12 inch", "78 rpm",
    "instrumental", "inst", "b-side", "promo"
  ],
  // Library music labels (high signal)
  libraryMusic: [
    "library music", "production music", "Bruton", "KPM", "De Wolfe",
    "Chappell", "Sonoton", "Musique", "Selected Sound"
  ],
  // Genre/style indicators
  genre: [
    "private press", "obscure", "rare groove", "soul jazz funk", "psych", "bossa",
    "deep funk", "rare soul", "obscure jazz", "crate digger"
  ]
}

// Negative keywords (to exclude in search queries)
export const NEGATIVE_KEYWORDS = [
  "-live", "-cover", "-karaoke", "-lesson", "-tutorial", "-reaction",
  "-concert", "-session", "-performance", "-playing", "-guitar", "-drum", "-piano", "-tabs"
]

// Hard filter patterns (immediate rejection)
export const HARD_FILTER_PATTERNS = {
  // Title/channel patterns
  titleChannel: [
    "cover", "live", "session", "rehearsal", "tutorial", "lesson",
    "backing track", "karaoke", "remix", "tribute",
    "how to play", "tabs", "playthrough", "guitar cover", "drum cover",
    "official video", "music video",
    "interview", "interviews", "talks about", "discusses", "explains",
    "filming", "filming my", "my record player", "record player setup",
    "unboxing", "unbox", "first listen", "reaction", "reacts to",
    "review", "reviews", "breakdown", "analysis", "explained"
  ],
  // Description patterns
  description: [
    "performed by", "recorded live", "filmed at", "my cover",
    "gear used", "lesson", "tutorial", "how to",
    "interview", "talks about", "discusses", "explains",
    "filming", "my record player", "record player setup",
    "unboxing", "first listen", "reaction", "reacts to",
    "review", "breakdown", "analysis", "explained",
    "what i think", "my thoughts", "opinion on"
  ]
}

// Scoring weights
export const SCORING_WEIGHTS = {
  // Positive signals
  title: {
    vinylRip: 30,        // "vinyl rip", "needle drop", "from vinyl", etc.
    format: 25,          // "full album", "45rpm", "7inch", "b-side", "promo"
    libraryMusic: 20,    // "library music", "KPM", "Bruton", etc.
    privatePress: 15,    // "private press", "obscure", "rare groove"
  },
  description: {
    vinylTerms: 10,      // "rip", "needle", "turntable", "vinyl", "record"
  },
  duration: {
    singleTrack: 10,    // 1:30-8:00 (single track)
    fullAlbum: 8,       // 20:00-70:00 (full album)
  },
  channel: {
    ripChannel: 10,      // Channel name contains "records", "vinyl", "rare groove", "45", "LP", "archives", "library music"
  },
  // Negative signals (subtract points)
  negative: {
    liveCover: -60,      // Title/desc includes: live/cover/lesson/tutorial/session/performance
    interview: -50,      // Interview, talks about, discusses, explains
    filming: -40,        // Filming, record player setup, equipment videos
    review: -50,        // Review, reaction, breakdown, analysis, explained
    timestamps: -10,    // Many timestamps like "00:00 Intro / Verse / Chorus" (common for lessons/covers)
    shortClip: -15,     // Very short clips (<45s)
  }
}

// Duration patterns (in seconds)
export const DURATION_PATTERNS = {
  singleTrack: { min: 90, max: 480 },   // 1:30-8:00
  fullAlbum: { min: 1200, max: 4200 }   // 20:00-70:00
}
