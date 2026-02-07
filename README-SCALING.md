# Scaling Architecture for Sample Roll

This document explains the multi-layer architecture implemented to handle 10,000+ concurrent users without hitting YouTube API quota limits.

## Architecture Overview

```
User Request (Dig)
    │
    ├─→ Step 1: Database (Pre-populated samples)
    │   └─→ 95%+ of requests served here (0 API calls)
    │
    ├─→ Step 2: Cache (In-memory/Redis)
    │   └─→ 4% of requests served here (0 API calls)
    │
    └─→ Step 3: YouTube API (Live search)
        └─→ <1% of requests need this (only when DB/cache empty)
```

## Components

### 1. Database Pre-Population (`lib/database-samples.ts`)

Pre-populated sample database that stores discovered videos. This is the primary data source.

**Key Functions:**
- `getRandomSampleFromDatabase()` - Gets random sample from DB, excluding seen/saved videos
- `storeSampleInDatabase()` - Stores new samples (used by pre-population job)
- `getDatabaseSampleCount()` - Returns count of available samples

**Benefits:**
- Zero API calls for 95%+ of requests
- Fast response times (<50ms)
- Scales to unlimited users

### 2. Caching Layer (`lib/cache.ts`)

In-memory cache for search results and video details.

**Cache TTLs:**
- Search results: 24 hours
- Video details: 30 days (rarely change)

**Benefits:**
- Reduces API calls by 80-90%
- Fast lookups (<1ms)
- Automatic cleanup of expired entries

### 3. Smart Routing (`lib/youtube.ts`)

The `findRandomSample()` function now uses a database-first approach:

1. **Check Database** - If samples exist, return immediately (no API call)
2. **Check Cache** - If cached results exist, return from cache (no API call)
3. **YouTube API** - Only as last resort (when DB/cache empty)

### 4. Pre-Population System

**API Route:** `/api/samples/populate`

Runs YouTube searches and stores results in the database. Should be called by a background job/cron.

**Usage:**
```bash
# Via API
curl -X POST "http://localhost:3000/api/samples/populate?secret=YOUR_SECRET&limit=100"

# Via script
node scripts/populate-database.js 500 YOUR_SECRET
```

**Setup:**
1. Add `POPULATE_SECRET` to `.env`:
   ```
   POPULATE_SECRET=your-secret-key-here
   ```

2. Run nightly via cron:
   ```cron
   0 2 * * * cd /path/to/project && node scripts/populate-database.js 500
   ```

### 5. Rate Limiting (`app/api/samples/rate-limit/route.ts`)

Tracks user API usage and enforces quotas (currently placeholder - needs database implementation).

**Tiers:**
- Free: 20 searches/day, 5/hour
- Paid: 100 searches/day, 20/hour
- Premium: Unlimited

## Expected Performance

**With 10,000 users doing 10 searches/day:**

- **100,000 total searches**
- **95,000 from database** = 0 API calls
- **4,000 from cache** = 0 API calls
- **1,000 from YouTube API** = ~115,000 units
- **API keys needed:** ~12 keys (manageable!)

## YouTube API key rotation (multiple keys)

When one key hits its daily quota, the app can automatically try the next key.

**Setup:** In `.env`, set either a single key or multiple keys (comma-separated, no spaces):

```bash
# Single key (unchanged)
YOUTUBE_API_KEY=your_key_here

# Or multiple keys – on 403 quota exceeded we try the next key
YOUTUBE_API_KEYS=key1,key2,key3
```

If you use `YOUTUBE_API_KEYS`, it takes precedence over `YOUTUBE_API_KEY`. Create extra keys in Google Cloud Console (same or different projects) and add them to get more quota per day.

---

## Setup Instructions

### 1. Initial Database Population

Run the pre-population script to seed the database:

```bash
# Set secret in .env
echo "POPULATE_SECRET=your-secret-key" >> .env

# Run initial population (500 samples)
node scripts/populate-database.js 500
```

### 2. Schedule Nightly Updates

Add to cron (runs at 2 AM daily):

```bash
crontab -e
```

Add:
```
0 2 * * * cd /path/to/thesampledig && node scripts/populate-database.js 200
```

### 3. Monitor Database Size

Check database stats:
```bash
curl http://localhost:3000/api/samples/populate
```

### 4. Optional: Add Redis

For production, replace in-memory cache with Redis:

```typescript
// lib/cache.ts - Add Redis support
import Redis from 'ioredis'
const redis = new Redis(process.env.REDIS_URL)
```

## Monitoring

**Key Metrics to Track:**
- Database sample count (should grow over time)
- Cache hit rate (should be >80%)
- API call rate (should be <1% of requests)
- Response times (DB: <50ms, Cache: <1ms, API: 1-2s)

## Troubleshooting

**Problem:** All requests hitting YouTube API
- **Solution:** Run pre-population script to seed database

**Problem:** Database growing too large
- **Solution:** Archive old samples or implement cleanup job

**Problem:** Cache not working
- **Solution:** Check cache size limits and TTLs

**Problem:** Still hitting quota limits
- **Solution:** 
  1. Increase pre-population frequency
  2. Add more API keys with rotation
  3. Increase cache TTLs
  4. Implement user-provided API keys for premium tier

---

## Candidate Pipeline (Large-Scale Discovery)

To build an **extremely large** database of vinyl-sample-friendly videos without burning search quota, use the **candidate pipeline**. It discovers videos from **playlists and channels** (1 unit per 50 items) instead of search (100 units per query), then enriches, scores, and promotes only high-quality candidates to the Sample table.

### Flow

1. **Ingest** – Add video IDs from playlists/channels to the `candidates` table (no metadata yet).
2. **Enrich** – Fetch title, description, duration, etc. via `videos.list` (1 unit per 50 videos).
3. **Score** – Heuristic (and optional AI) scores each candidate 0–100; only “static vinyl / album art” style passes.
4. **Process** – Promote candidates with score ≥ 55 to the `samples` table (what Dig uses).

### API Endpoints (same `POPULATE_SECRET` as populate)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/candidates/ingest` | POST | Add IDs from playlists/channels (body or env) |
| `/api/candidates/enrich` | POST | Fetch metadata for unenriched candidates |
| `/api/candidates/score` | POST | Run quality scoring on enriched candidates |
| `/api/candidates/process` | POST | Promote high-scoring candidates to Sample |
| `/api/candidates/pipeline` | POST | Run one batch: enrich → score → process |
| `/api/candidates/stats` | GET | Counts: total, unenriched, unscored, processable, samples |

### Ingest (playlists and channels)

**Body (optional if env is set):**
```json
{
  "playlists": ["PLxxx", "PLyyy"],
  "channels": ["UCxxx", "UCyyy"]
}
```

**Env (for cron without body):**
```
CANDIDATE_PLAYLIST_IDS=PLxxx,PLyyy
CANDIDATE_CHANNEL_IDS=UCxxx,UCyyy
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/candidates/ingest?secret=YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"playlists":["PLxxx"],"channels":["UCyyy"]}'
```

### Run full pipeline (enrich → score → process)

```bash
# One batch (default: 50 enrich, 100 score, 30 process)
curl -X POST "http://localhost:3000/api/candidates/pipeline?secret=YOUR_SECRET"

# Via script (run repeatedly for cron)
node scripts/run-candidate-pipeline.js

# With ingest first (uses CANDIDATE_PLAYLIST_IDS / CANDIDATE_CHANNEL_IDS)
node scripts/run-candidate-pipeline.js ingest
```

### Suggested cron setup

1. **Ingest** once (or weekly) to add new playlists/channels:
   ```bash
   curl -X POST ".../api/candidates/ingest?secret=SECRET" -H "Content-Type: application/json" -d '{"playlists":["..."],"channels":["..."]}'
   ```
2. **Pipeline** every hour (or every 15 min) to enrich/score/process:
   ```bash
   node scripts/run-candidate-pipeline.js
   ```

### Quality scoring

- Implemented in `lib/quality-scorer.ts` (heuristic: static vinyl/album keywords, penalties for DJ/live/beatmaking).
- Minimum score to promote: **55** (configurable via `minScore` on `/api/candidates/process`).
- Genre/era are set from the same logic as search-based populate (`extractMetadata`).

### Discover playlists from the API (collect ~10k videos)

Playlists are **discovered** via YouTube search (type=playlist) using curated queries (rare samples, vintage jazz, genres, artists/albums), then their video IDs are ingested into candidates.

**Endpoint:** `POST /api/candidates/discover-playlists?secret=YOUR_SECRET`

**Optional body:**
```json
{
  "queries": ["optional override list"],
  "maxPlaylistSearches": 25,
  "maxPlaylistsToIngest": 80,
  "maxVideosPerPlaylist": 400
}
```

Default queries are in `lib/discover-playlists-queries.ts` (e.g. "rare samples vinyl", "vintage jazz vinyl", "bossa nova vinyl", "Sun Ra", "Ahmad Jamal The Awakening", "Japanese jazz vinyl", etc.).

**One-shot script to aim for ~10k samples:**
```bash
node scripts/collect-10k-videos.js
```
This will: (1) discover playlists and ingest their video IDs into candidates, (2) run the pipeline (enrich → score → process) repeatedly until you have ~10k samples or no more candidates. Use `node scripts/collect-10k-videos.js no-discover` to skip discover and only run the pipeline (e.g. after adding more playlists manually).
