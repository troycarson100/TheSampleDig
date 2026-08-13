# Sample Roll — Product overview

**Sample Roll** is a web app for **crate-style sample discovery**: users “dig” through YouTube-hosted audio (primarily vinyl- and rare-groove–oriented material) surfaced from a **curated database**, with tools to preview, filter, chop, save, and organize finds. The experience is built around the **Dig** flow (`/dig`), with supporting pages for account, saved samples (“My Crate”), Pro subscription, optional tools (stem splitter, beat visualizer), editorial content (blog), and marketplace-adjacent routes (e.g. sounds).

Branding in-app uses the name **Sample Roll**; marketing copy also references **Sample Roll Pro** for the paid tier.

---

## Current features (high level)

### Discovery & playback (Dig)

- **Random sample discovery** from a **pre-populated database** of YouTube videos (user-facing Dig does not consume YouTube Search API quota per roll).
- **YouTube embed playback** with metadata (title, channel, genre, era when available).
- **BPM and musical key** when present on the sample (including backfill/analysis pipelines).
- **Filters**
  - **Genre** and **era** (decade-style) filters.
  - **Drum Break** (Pro): prefer drum-break–oriented titles / curated drum-break list.
  - **Sample packs / royalty-free–style** mode: surfaces samples whose titles match royalty-free / pack-style phrases (era is relaxed in this mode).
- **Playback options**: autoplay, optional **random start time** (vs. fixed start behavior for certain modes).
- **Chop mode** (keyboard / pads): **logged-in users** can use chop mode; **Pro** unlocks **looping, quantized recording, and saving** chops/loops to the sample (see Pro section below). Desktop-focused; marketing notes Chop Mode nuances for free vs Pro.
- **Save** samples to the user’s account (heart / save flow).
- **Reporting** low-quality or problematic samples (implicit skip feedback on fast skips).

### Account & library

- **Registration / login** (credentials-based).
- **My Crate** (`/profile`): grid of saved samples, search, filters (genre, key, BPM range), **Drum break only** (Pro-aligned filter for saved items), playlist filter when applicable.
- **Playlists** (Pro subscription): organize saved samples into custom playlists (client-side playlist storage keyed by user).
- **Private notes** on saved samples (Pro-gated in product UI).

### History

- **Dig history** (tracks you’ve rolled): up to **1,000** entries.
- **Pro**: history can be **synced to the server** (`/api/history`) for persistence across devices/sessions.
- **Non-Pro**: history may be **session/device local** and can be cleared when not subscribed (implementation aligns Pro with durable history).

### Monetization & surface area

- **Stripe subscription** for Pro: checkout exposes a **7-day trial**, then **$5.99/month** (see `/pro` and checkout flow).
- **In-app ads**: Dig (and blog article placements when configured) can show ads for **non-Pro** users when AdSense flags are enabled; Pro messaging positions ad removal for the Sample Roll experience (excluding third-party content such as YouTube’s own ads).

### Other product surfaces

- **Blog** (`/blog`): editorial posts on sampling, gear, and related topics.
- **Stem splitter** (`/stem-splitter`): separate tool for splitting audio into stems (not the core Dig loop).
- **Beat visualizer** (`/visualizer`): experimental visualizer route (feature-flagged via env in deployment).
- **Sounds / creator** marketplace-style routes under the app structure.
- **Alerts** (`/alerts`): product announcements.
- **Settings**, **legal** (terms, privacy, cookies), **email verification** and password flows.

### Technical / operator notes (not end-user features)

- **Populate scripts** (admin/ops): ingest curated PDF lists (e.g. drum breaks) via **Crawl4AI** or **Playwright scraping** or YouTube Data API depending on env — used to fill/update the sample database, not the live user Dig path.
- **Pro enforcement toggle**: `NEXT_PUBLIC_REQUIRE_PRO_SUBSCRIPTION` controls whether some **client** “soft” gates treat everyone as Pro for testing; **subscription-gated features** tied to `session.user.isPro` (Drum Break, notes, etc.) use **real Stripe/complementary Pro status** regardless of that flag.

---

## Free (regular) vs Pro membership

| Area | Regular (free) | Pro |
|------|----------------|-----|
| **Account** | Register, log in, save samples to My Crate | Same |
| **Dig** | Full access to standard digs, genre/era/sample-pack filters | Same, **plus** **Drum Break** filter (curated pool) |
| **Chop mode** | **Chop mode UI** for signed-in users; **loops / quantize record / save chops to sample** are **Pro** (per in-app Pro offering) | Full chop loop + save experience |
| **Playlists** | Filter UI may show upgrade path; **creating/managing playlists** as a Pro feature in the crate sidebar | Create and use playlists |
| **Notes** | Gated — upgrade to Pro to add private notes on saves | Private per-sample notes |
| **History** | Limited / local-session behavior; not the full cross-device synced history | Up to **1,000** tracks, **server-backed** history where implemented |
| **Ads** | May see Sample Roll in-app ad units where enabled | **Ad-free Sample Roll experience** for those units (marketing: excludes YouTube’s own ads) |
| **Billing** | — | **7-day trial**, then **$5.99/mo** via Stripe (subject to change in Stripe dashboard) |

### How Pro status is determined

- **Stripe subscription** statuses such as **active**, **trialing**, **past_due**, and **paused** map to **Pro** in session (`lib/auth.ts` logic).
- **Complimentary Pro**: server env **`COMPLIMENTARY_PRO_EMAILS`** (comma-separated) grants Pro without Stripe.
- **Dev only**: **`DEV_PRO_EMAILS`** in development can force Pro for testing.

---

## Summary

**Sample Roll** is a **sample discovery and organization product** centered on **Dig**, with **Pro** adding **curated drum-break digging**, **full chop loop + save**, **playlists**, **notes**, **persistent dig history**, and **removal of in-app ads** where applicable. The **free tier** remains useful for **browsing, saving, and basic chopping**, while **Pro** targets heavy users who want **faster targeting (drum breaks)**, **workflow (loops, playlists, notes)**, and a **cleaner session**.

---

*This document reflects the codebase and product behavior as of the date it was written. Pricing and feature details may change in Stripe, env flags, or UI without this file updating.*
