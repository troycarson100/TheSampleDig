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
  ],
  // Visual indicators (STATIC album covers, vinyl images) - HIGH PRIORITY
  // ONLY static images - NO spinning/manipulation
  visual: [
    "album cover", "record cover", "vinyl cover", "LP cover",
    "record image", "vinyl image", "album image",
    "album sleeve", "record sleeve", "vinyl sleeve", "LP sleeve",
    "record label", "vinyl label", "45 label", "7 inch label",
    "static image", "static cover", "full album cover",
    "album artwork", "cover art", "sleeve art"
  ]
}

// Negative keywords (to exclude in search queries)
export const NEGATIVE_KEYWORDS = [
  "-live", "-cover", "-karaoke", "-lesson", "-tutorial", "-reaction",
  "-concert", "-session", "-performance", "-playing", "-guitar", "-drum", "-piano", "-tabs",
  "-official", "-music video", "-mv", "-street", "-vlog",
  "-billboard", "-top 40", "-chart", "-hit", "-single",
  // DJ/turntable manipulation - NOT static images
  "-dj", "-scratch", "-scratching", "-turntable", "-turntablism", "-beat juggling",
  "-crate digging", "-digging", "-mixing", "-mix", "-dj set", "-dj mix",
  "-vinyl manipulation", "-record manipulation", "-spinning", "-rotating"
]

// Hard filter patterns (immediate rejection)
export const HARD_FILTER_PATTERNS = {
  // Title/channel patterns
  titleChannel: [
    "cover", "live", "session", "sessions", "mic sessions", "rehearsal", "tutorial", "lesson",
    "backing track", "karaoke", "remix", "tribute",
    "how to play", "tabs", "playthrough", "guitar cover", "drum cover",
    "official video", "music video", "official", "official audio", "official music video",
    "mv", "official mv",
    "interview", "interviews", "talks about", "discusses", "explains",
    "filming", "filming my", "my record player", "record player setup",
    "unboxing", "unbox", "first listen", "reaction", "reacts to",
    "review", "reviews", "breakdown", "analysis", "explained",
    "street", "people in", "random", "vlog", "walking", "driving",
    "billboard", "top 40", "chart", "hit", "single", "popular",
    // DJ/turntable manipulation - NOT static images
    "dj", "scratch", "scratching", "turntable", "turntablism", "beat juggling",
    "crate digging", "digging", "mixing", "mix", "dj set", "dj mix",
    "vinyl manipulation", "record manipulation", "spinning", "rotating",
    "dj scratch", "turntable scratch", "scratch dj", "dj turntable",
    "hands on", "hand on", "manipulating", "manipulation",
    // Modern hip-hop/rap artists (mainstream, not rare vinyl) - EXPANDED
    "talib kweli", "kweli", "mos def", "common", "kanye", "jay z", "jay-z",
    "drake", "kendrick", "j cole", "nas", "eminem", "50 cent", "fifty cent", "snoop",
    "ice cube", "dr dre", "tupac", "biggie", "notorious", "wu-tang",
    "outkast", "a tribe called quest", "de la soul", "public enemy",
    "run dmc", "ll cool j", "rakim", "big daddy kane", "krs-one",
    "method man", "ghostface", "raekwon", "gza", "odb", "rza",
    "the roots", "black thought", "questlove", "pharrell", "timbaland",
    "swizz beatz", "just blaze", "dj premier", "pete rock", "9th wonder",
    "j dilla", "madlib", "mf doom", "doom", "flying lotus", "knxwledge",
    "tyler the creator", "earl sweatshirt", "odd future", "asap rocky",
    "travis scott", "playboi carti", "lil uzi", "21 savage", "migos",
    "cardi b", "nicky minaj", "megan thee stallion", "dababy", "lil baby",
    "lil wayne", "nicki minaj", "future", "young thug", "gunna", "lil yachty",
    "post malone", "lil nas x", "doja cat", "ariana grande", "the weeknd",
    "juice wrld", "xxxtentacion", "polo g", "roddy ricch", "lil tecca",
    "pop smoke", "king von", "nba youngboy", "lil durk", "g herbo",
    // Popular modern hip-hop song titles (immediate rejection)
    "in da club", "get rich or die tryin", "many men", "candy shop",
    "just a lil bit", "p.i.m.p", "21 questions", "wanksta", "heat",
    "if i can't", "patiently waiting", "what up gangsta", "poor lil rich"
  ],
  // Description patterns
  description: [
    "performed by", "recorded live", "filmed at", "my cover",
    "gear used", "lesson", "tutorial", "how to",
    "interview", "talks about", "discusses", "explains",
    "filming", "my record player", "record player setup",
    "unboxing", "first listen", "reaction", "reacts to",
    "review", "breakdown", "analysis", "explained",
    "what i think", "my thoughts", "opinion on",
    "official", "official video", "official audio", "music video", "mv",
    "street", "people in", "random", "vlog", "walking", "driving", "city", "urban",
    "billboard", "top 40", "chart", "hit", "single", "popular"
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
    mainstream: -50,     // Mainstream/popular music indicators
    musicVideo: -40,     // Music video indicators
    randomContent: -60,  // Street/random/people videos
    timestamps: -10,    // Many timestamps like "00:00 Intro / Verse / Chorus" (common for lessons/covers)
    shortClip: -15,     // Very short clips (<45s)
  }
}

// Duration patterns (in seconds)
export const DURATION_PATTERNS = {
  singleTrack: { min: 90, max: 480 },   // 1:30-8:00
  fullAlbum: { min: 1200, max: 4200 }   // 20:00-70:00
}
