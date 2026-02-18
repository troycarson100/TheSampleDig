# Discovery Strategy & Quota Cost

This document explains the quota cost of each discovery mode so developers know which to use first.

---

## TL;DR — Use This Order

1. **Channels** (1 unit / 50 videos) — Best ROI
2. **Playlists** (1 unit / 50 videos) — Same cost, different source
3. **Search** (100 units / 50 videos) — Last resort

---

## Quota Basics

- **Daily quota**: 10,000 units per YouTube API key (default)
- **Key rotation**: Set `YOUTUBE_API_KEYS=key1,key2,key3` in `.env` to spread load
- **Reset**: Midnight Pacific Time

---

## Mode 1 — Channel Discovery (PRIORITY 1)

**Script**: `node scripts/discover-from-channels.js`  
**API route**: `POST /api/samples/populate-from-channels`

**How it works**: Seeds from `SELECT DISTINCT channelId FROM Channel` (channels that already have samples). For each channel, fetches uploads via `channels.list` + `playlistItems.list`. Runs each video through the same filter pipeline as search.

**Quota cost**:
- `channels.list` (contentDetails): **1 unit** per channel
- `playlistItems.list`: **1 unit per 50 videos**
- `videos.list` (details): **1 unit per 50 videos** (batched)
- **Total**: ~2 units per 50 videos (channels) + 1 per 50 (details) ≈ **3 units per 50 videos**

Compared to search: **100 units per 50 videos** → **~33× more quota-efficient**.

**When to use**: Always first. Requires at least one sample in DB (from a prior search run) to seed channels.

---

## Mode 2 — Playlist Discovery (PRIORITY 2)

**Script**: `node scripts/collect-10k-videos.js`  
**API route**: `POST /api/candidates/discover-playlists`

**How it works**: Either searches for playlists (100 units per search) or uses a **seed list** (`SEED_PLAYLIST_IDS`). Ingested videos go to the Candidate table, then through enrich → score → process pipeline to promote to Sample.

**Quota cost (with seed playlists)**:
- No search: **0 units**
- `playlistItems.list`: **1 unit per 50 videos**
- `videos.list` (enrich): **1 unit per 50 videos**
- **Total**: ~**2 units per 50 videos** (when using seed; no search)

**Quota cost (with search)**:
- `search` (type=playlist): **100 units** per request
- Same as above for ingest

**When to use**: When you have curated playlist IDs, or when channels are exhausted. Use `SEED_PLAYLIST_IDS=id1,id2,id3` and `SKIP_PLAYLIST_SEARCH=1` for zero search cost.

---

## Mode 3 — Search (PRIORITY 3)

**Script**: `node scripts/populate-until-10k.js`  
**API route**: `POST /api/samples/populate`

**How it works**: Uses `search.list` with query templates, excludes existing IDs, runs through filter pipeline. Uses `skipPages` to start at page 21+ (early pages already mined).

**Quota cost**:
- `search.list`: **100 units** per page (50 results)
- `videos.list` (details): **1 unit per 50 videos**
- **Total**: ~**101 units per 50 videos**

**When to use**: Last resort. Search space is heavily mined; `skipPages=20` or higher recommended.

---

## Unified Populate Script

```bash
node scripts/populate.js --mode=channels   # default
node scripts/populate.js --mode=playlists
node scripts/populate.js --mode=search
```

Or via env: `MODE=channels node scripts/populate.js`

---

## Quality Guardrails (Do Not Remove)

- **Score threshold**: Never lower below 15
- **Safeguards**: Keep `MAX_ZERO_BATCHES`, `MAX_CONSECUTIVE_ZERO_FILTER_PAGES`
- **Validation**: Always run `node scripts/validate-populate-pipeline.js` before a full search run
- **videoCategoryId**: If re-adding Music-only filter, add compensating hard filters for new bad-content types

---

## Recommended Workflow

1. **First run** (empty DB): Use search once to get initial samples and seed channels
2. **Ongoing**: Run `discover-from-channels.js` daily (or `populate.js --mode=channels`)
3. **If channels exhausted**: Add `SEED_PLAYLIST_IDS` to `.env`, run `collect-10k-videos.js`
4. **Fallback**: Run search with `SKIP_PAGES=20` when quota resets
