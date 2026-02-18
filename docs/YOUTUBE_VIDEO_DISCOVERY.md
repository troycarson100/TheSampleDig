# YouTube Video Discovery – Technical Overview

This document explains how we search for and filter vinyl rip videos for the SampleRoll dig experience, and the problems we're facing.

---

## Overview

We need **vinyl rip / needle drop** music videos—people playing records and recording the audio (often with a static album cover image). The target is vintage/obscure content: library music, rare groove, soul, funk, bossa nova, private press, etc. We have ~5.6k samples in the DB; the goal is 10k.

There are **two main discovery paths**:

1. **Search-based populate** (`populate-until-10k.js`) – YouTube search API with query templates
2. **Playlist-based pipeline** (`collect-10k-videos.js`) – Discover playlists → ingest as candidates → score and promote to samples

This doc focuses on the search path, which we use most and where we've had the most issues.

---

## How Search-Based Discovery Works

### 1. Query Templates

`lib/youtube.ts` → `generateQueryTemplates()` builds ~60 query strings. Each combines:

- **Positive phrases** (quoted): `"vinyl rip"`, `"full album"`, `"1970s"`, `"library music"`, `"needle drop"`, etc.
- **Negative phrases**: `-live`, `-cover`, `-karaoke`, `-tutorial`, `-reaction`, `-dj set`, etc.

Example: `"rare groove" "vinyl rip" "full album" "1970s" -live -cover -karaoke ...`

Config: `lib/youtube-config.ts` → `NEGATIVE_KEYWORDS`

### 2. API Flow

1. **Search** (`fetchSearchPage`): `GET youtube/v3/search` with `q`, `type=video`, `maxResults=50`, `order=relevance`
2. **Exclude** already-known video IDs (from DB) so we don't re-process them
3. **Fetch details** for remaining videos: `youtube/v3/videos` (part=snippet,contentDetails) to get duration and description
4. **Filter & score** each video
5. **Store** passing videos in the `Sample` table

### 3. Pagination and skipPages

- Each search returns one page (up to 50 results)
- We use `pageToken` to request more pages
- **`skipPages`** (default 15): we skip the first N pages per template and start at page N+1
- Reason: Pages 1–15 are heavily mined; we already have ~5.5k samples. New content is typically further back.

### 4. Filter Pipeline (`processSearchPageItems`)

Each video goes through:

| Stage | Action |
|-------|--------|
| **Exclusion** | Skip if `youtubeId` is in DB |
| **Details** | Skip if no duration (need `videos.list`) |
| **Hard filter** | Title/channel/description matched against `HARD_FILTER_PATTERNS` → immediate reject |
| **Indicators** | Must have static visual (album cover, record image, etc.) OR strong vinyl signal (vinyl rip, needle drop, full album, LP, etc.) |
| **DJ terms** | Reject if scratch, turntablism, spinning, dj mix, etc. |
| **Duration** | 30s–70min only |
| **Score** | `calculateVinylRipScore()` ≥ 15 AND (static indicator OR strong vinyl signal) |

Config: `lib/youtube-config.ts` → `HARD_FILTER_PATTERNS`, `SCORING_WEIGHTS`

### 5. Scoring (`calculateVinylRipScore`)

- Positive: vinyl rip terms, format (full album, 45rpm), library music, private press, duration (single vs album), channel reputation
- Negative: live/cover/lesson, interview, filming, review, mainstream, music video, random content, timestamps, short clips
- Output: 0–100; threshold **15** to pass

---

## Quota

- **Daily quota**: 10,000 units (default per API key)
- **Search** = 100 units per request
- **Videos.list** = 1 unit per video (we batch up to 50)
- Example: 17 pages (15 skips + 2 content) ≈ 1,700 units per validation run
- Multiple keys: `YOUTUBE_API_KEYS=key1,key2,key3` in `.env`; we rotate on 403 quota exceeded

---

## Validation Before Full Run

To avoid wasting quota on a broken pipeline:

```bash
node scripts/validate-populate-pipeline.js
```

- Runs 2 content pages with **real excluded IDs** (simulates production)
- Cost: ~1,700 units
- Returns **GO** if ≥1 video passes; **NO-GO** otherwise
- `populate-until-10k.js` runs validation by default; use `SKIP_VALIDATE=1` to bypass

---

## Current Problems

### 1. Search Space Exhaustion

- DB has ~5.6k samples
- Early pages (1–15) of our query templates return mostly videos we already have
- With `skipPages=9` we got **0 candidates** (all excluded)
- With `skipPages=15` we get some new candidates
- **Implication**: We must skip deeper (higher `skipPages`) or use different discovery (playlists, channels)

### 2. Quota Burn With Little Return

- Weeks of runs returned **0 new samples** before we fixed validation + skipPages
- Each failed run still burns quota (search + videos.list)
- **Safeguards added**:
  - Validation mode: prove pipeline works before full run
  - `MAX_ZERO_BATCHES=3`: stop after 3 batches with 0 stored
  - `MAX_CONSECUTIVE_ZERO_FILTER_PAGES=8`: stop if 8 pages in a row have 0 passed
  - `MAX_PAGES_PER_BATCH=200`: cap pages per batch

### 3. Filter Let-Through (Bad Videos)

We recently had several bad videos pass:

- Vinyl **storage shed** ad
- **Economist** explainer on vinyl prices
- **Vinyl manufacturing** / pressing process
- **Vinyl finds** / haul vlogs
- **Vinyl as art** / display content

We deleted these and added hard filter patterns: `shed`, `portable shed`, `economist`, `economics`, `examines`, `vinyl finds`, `vinyl haul`, `manufacturing`, `record pressing`, `pressage`, `como arte`, `vinyl as art`, etc. (see `lib/youtube-config.ts`).

**Issue**: Hard filters are substring-based. New bad patterns will keep appearing; we need to iterate.

### 4. Tightrope: Too Strict vs Too Loose

- **Too strict**: 0 results (e.g. when we over-blocked "cover", "turntable", "doom", "i")
- **Too loose**: Sheds, economists, manufacturing videos get in
- We've relaxed and re-tightened filters multiple times

### 5. No `videoCategoryId` Filter

- We used to restrict to `videoCategoryId: "10"` (Music); we removed it to get more results
- Tradeoff: more non-music videos (sheds, economics, etc.) in the result set

---

## Discovery Modes

See `docs/DISCOVERY_STRATEGY.md` for quota cost and mode ordering (channels → playlists → search).

| File | Purpose |
| `lib/youtube-config.ts` | `NEGATIVE_KEYWORDS`, `HARD_FILTER_PATTERNS`, `SCORING_WEIGHTS`, `DURATION_PATTERNS` |
| `lib/youtube.ts` | `generateQueryTemplates`, `fetchSearchPage`, `processSearchPageItems`, `shouldHardFilter`, `calculateVinylRipScore` |
| `app/api/samples/populate/route.ts` | Populate API: search loop, skipPages, validation mode, dry run |
| `app/api/samples/populate-from-channels/route.ts` | Channel discovery: uploads from Sample channels |
| `scripts/populate-until-10k.js` | Main populate script: validation → batches until 10k or zero batches |
| `scripts/validate-populate-pipeline.js` | Minimal validation before full run |
| `scripts/check-youtube-quota.js` | Quick quota check before running |
| `scripts/collect-10k-videos.js` | Playlist discovery → candidate pipeline (supports SEED_PLAYLIST_IDS) |
| `scripts/discover-from-channels.js` | Channel-first discovery (1 unit/50 videos) |
| `scripts/populate.js` | Unified script with --mode=channels|playlists|search |
| `lib/youtube-keys.ts` | Key rotation on 403 |

---

## Recommendations for Developers

1. **Add more hard filter patterns** when new bad content types appear; check title, channel, and description.
2. **Consider playlist/channel discovery** as primary path; search may be nearing saturation.
3. **Add new query templates** to reach different corners of YouTube (e.g. language-specific, niche genres).
4. **Raise score threshold** (e.g. 15 → 20) if bad videos still slip through, at the cost of fewer passes.
5. **Log and analyze rejections** with `verbose=true` to see where candidates are dropped (hard filter vs indicator vs score).
6. **Test with validation** before any full populate run to confirm the pipeline is working.
