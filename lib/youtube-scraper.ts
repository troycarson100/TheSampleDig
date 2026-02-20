/**
 * YouTube search scraper: fetches search results via browser (Playwright) to avoid
 * Search API quota. Returns items in the same shape as the API for drop-in use
 * with processVideoItems + getVideoDetailsBatch (details still use API).
 *
 * Enable with USE_YOUTUBE_SCRAPER=true. Pagination is not supported (one page per query).
 */

import { chromium, type Browser, type Page } from "playwright"

const YOUTUBE_SEARCH_BASE = "https://www.youtube.com/results"
const YOUTUBE_WATCH_BASE = "https://www.youtube.com/watch"
const DEFAULT_TIMEOUT_MS = 25_000
const SCRAPER_DELAY_BETWEEN_SEARCHES_MS = 2000
const SCRAPER_DELAY_BETWEEN_WATCH_MS = 1500

/** Last time we ran a search (for rate limiting) */
let lastSearchTime = 0

export interface ScrapedVideoDetails {
  title?: string
  description?: string
  duration?: number
  tags?: string[]
}

export interface ScrapedVideoItem {
  id: { videoId: string }
  snippet: {
    title: string
    channelTitle: string
    channelId?: string
    thumbnails: { default: { url: string }; medium?: { url: string } }
    publishedAt?: string
  }
  description?: string
  duration?: number
  tags?: string[]
}

/** Extract video ID from /watch?v=XXX or from navigationEndpoint */
function getVideoId(renderer: any): string | null {
  const url = renderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url
  if (url && typeof url === "string" && url.startsWith("/watch?v=")) {
    return url.replace("/watch?v=", "").split("&")[0] || null
  }
  return renderer?.videoId ?? null
}

/** Get title text from title.runs[0].text or title.simpleText */
function getTitle(renderer: any): string {
  const title = renderer?.title
  if (!title) return ""
  if (title.runs?.[0]?.text) return title.runs[0].text
  if (typeof title.simpleText === "string") return title.simpleText
  return ""
}

/** Get channel name and optional channel ID */
function getChannel(renderer: any): { name: string; channelId?: string } {
  const name = renderer?.ownerText?.runs?.[0]?.text
    ?? renderer?.longBylineText?.runs?.[0]?.text
    ?? ""
  const channelId = renderer?.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
    ?? renderer?.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
  return { name, channelId: channelId || undefined }
}

/** Get duration from thumbnailOverlays (e.g. "12:34") and return seconds, or undefined */
function getDurationSeconds(renderer: any): number | undefined {
  try {
    const overlay = renderer?.thumbnailOverlays?.find(
      (o: any) => o?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText
    )
    const text = overlay?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText
    if (!text || typeof text !== "string") return undefined
    const parts = text.trim().split(":").map((s: string) => parseInt(s, 10))
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return undefined
  } catch {
    return undefined
  }
}

/** Recursively find all videoRenderer objects in a JSON tree */
function collectVideoRenderers(obj: any, out: any[]): void {
  if (!obj || typeof obj !== "object") return
  if (obj.videoRenderer) {
    out.push(obj.videoRenderer)
    return
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectVideoRenderers(item, out)
    return
  }
  for (const key of Object.keys(obj)) {
    collectVideoRenderers(obj[key], out)
  }
}

/**
 * Scrape the watch page for a single video to get real title, description, duration, tags.
 * Use this to replace search-result snippet title (which is often wrong, e.g. "Now playing").
 */
export async function scrapeYouTubeVideoDetails(
  videoId: string,
  options?: { page?: Page; timeoutMs?: number }
): Promise<ScrapedVideoDetails> {
  const timeoutMs = options?.timeoutMs ?? 15_000
  const useExistingPage = !!options?.page

  const extract = async (page: Page): Promise<ScrapedVideoDetails> => {
    const result = await page.evaluate(() => {
      const out: { title?: string; description?: string; duration?: number; tags?: string[] } = {}
      try {
        let parsed: any = null
        const scriptById = document.querySelector("script#ytInitialPlayerResponse")?.textContent
        if (scriptById) {
          try {
            parsed = JSON.parse(scriptById)
          } catch {
            // ignore
          }
        }
        if (!parsed) {
          const html = document.documentElement.innerHTML
          const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var\s|<\/script)/s)
          if (match) {
            try {
              parsed = JSON.parse(match[1])
            } catch {
              // ignore
            }
          }
        }
        if (!parsed) {
          const scriptData = document.querySelector("script#ytInitialData")?.textContent
          if (scriptData) parsed = JSON.parse(scriptData)
        }
        const player = parsed?.playerResponse ?? parsed
        const vd = player?.videoDetails
        if (vd?.title) out.title = vd.title
        if (vd?.lengthSeconds) out.duration = parseInt(String(vd.lengthSeconds), 10) || undefined
        const desc = vd?.shortDescription ?? player?.videoDetails?.shortDescription
        if (desc) out.description = desc
        const microformat = player?.microformat?.playerMicroformatRenderer
        if (microformat?.description) out.description = out.description || microformat.description
        const keywords = vd?.keywords
        if (Array.isArray(keywords)) out.tags = keywords
      } catch {
        // ignore
      }
      return out
    })
    return result
  }

  if (useExistingPage && options?.page) {
    const url = `${YOUTUBE_WATCH_BASE}?v=${videoId}`
    await options.page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs })
    await options.page.waitForTimeout(2000)
    return extract(options.page)
  }

  let browser: Browser | null = null
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] })
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    })
    const page = await context.newPage()
    const url = `${YOUTUBE_WATCH_BASE}?v=${videoId}`
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs })
    await page.waitForTimeout(2000)
    return extract(page)
  } finally {
    if (browser) await browser.close()
  }
}

/**
 * Scrape one page of YouTube search results for the given query.
 * Returns items in API-compatible shape so they can be passed to processVideoItems.
 * Optionally enriches the first N items with watch-page data (real title, description, tags).
 */
export async function scrapeYouTubeSearch(
  query: string,
  options?: { timeoutMs?: number; headless?: boolean; enrichDetailsForFirst?: number }
): Promise<{ items: ScrapedVideoItem[] }> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const headless = options?.headless ?? true
  const enrichDetailsForFirst = options?.enrichDetailsForFirst ?? 0

  // Rate limit
  const now = Date.now()
  const elapsed = now - lastSearchTime
  if (elapsed < SCRAPER_DELAY_BETWEEN_SEARCHES_MS) {
    await new Promise((r) => setTimeout(r, SCRAPER_DELAY_BETWEEN_SEARCHES_MS - elapsed))
  }
  lastSearchTime = Date.now()

  const url = `${YOUTUBE_SEARCH_BASE}?search_query=${encodeURIComponent(query)}`
  let browser: Browser | null = null

  try {
    browser = await chromium.launch({
      headless,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    })
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
    })
    const page = await context.newPage()

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs })
    await page.waitForTimeout(3000)

    const items: ScrapedVideoItem[] = []
    const rawRenderers: any[] = []

    const ytData = await page.evaluate(() => {
      const script = document.querySelector('script#ytInitialData')?.textContent
      if (!script) return null
      try {
        return JSON.parse(script)
      } catch {
        return null
      }
    })

    if (ytData) {
      // Explicit path: search results are under primaryContents -> sectionListRenderer -> contents
      const primary =
        ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
      const sectionContents = primary?.contents
      if (Array.isArray(sectionContents)) {
        for (const section of sectionContents) {
          const list = section?.itemSectionRenderer?.contents
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item?.videoRenderer) rawRenderers.push(item.videoRenderer)
            }
          }
        }
      }
      // Fallback: recursive search for any videoRenderer
      if (rawRenderers.length === 0) {
        collectVideoRenderers(ytData, rawRenderers)
      }
    }

    // DOM fallback: if no data from JSON, scrape ytd-video-renderer or watch links
    if (rawRenderers.length === 0) {
      const domResults = await page.evaluate(() => {
        const out: { videoId: string; title: string; channelTitle: string }[] = []
        const links = document.querySelectorAll('a[href^="/watch?v="]')
        const seen = new Set<string>()
        for (const a of links) {
          const href = (a as HTMLAnchorElement).getAttribute("href")
          if (!href) continue
          const id = href.replace("/watch?v=", "").split("&")[0]
          if (!id || seen.has(id)) continue
          const link = a as HTMLAnchorElement
          const title =
            link.getAttribute("title") ||
            link.getAttribute("aria-label") ||
            (link.querySelector("#video-title") as HTMLElement)?.textContent?.trim() ||
            link.textContent?.trim() ||
            "Unknown"
          const row = link.closest("ytd-video-renderer") || link.closest("ytd-compact-video-renderer")
          const channelEl = row?.querySelector("#channel-name a") || row?.querySelector("#text.ytd-channel-name a") || row?.querySelector("ytd-channel-name a")
          const channelTitle = (channelEl as HTMLElement)?.textContent?.trim() || "Unknown"
          seen.add(id)
          out.push({ videoId: id, title: title || "Unknown", channelTitle })
        }
        return out
      })
      for (const r of domResults) {
        items.push({
          id: { videoId: r.videoId },
          snippet: {
            title: r.title,
            channelTitle: r.channelTitle,
            thumbnails: {
              default: { url: `https://i.ytimg.com/vi/${r.videoId}/mqdefault.jpg` },
              medium: { url: `https://i.ytimg.com/vi/${r.videoId}/mqdefault.jpg` },
            },
          },
        })
      }
    }

    const seenIds = new Set<string>()
    for (const r of rawRenderers) {
      const videoId = getVideoId(r)
      if (!videoId || seenIds.has(videoId)) continue
      seenIds.add(videoId)
      const title = getTitle(r)
      const { name: channelTitle, channelId } = getChannel(r)
      const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
      items.push({
        id: { videoId },
        snippet: {
          title: title || "Unknown",
          channelTitle: channelTitle || "Unknown",
          channelId,
          thumbnails: {
            default: { url: thumbnailUrl },
            medium: { url: thumbnailUrl },
          },
          publishedAt: undefined,
        },
      })
    }

    if (enrichDetailsForFirst > 0 && items.length > 0 && page) {
      const toEnrich = items.slice(0, enrichDetailsForFirst)
      for (let i = 0; i < toEnrich.length; i++) {
        const item = toEnrich[i]
        try {
          const details = await scrapeYouTubeVideoDetails(item.id.videoId, {
            page,
            timeoutMs: 15_000,
          })
          if (details.title) item.snippet.title = details.title
          if (details.description !== undefined) item.description = details.description
          if (details.duration !== undefined) item.duration = details.duration
          if (details.tags !== undefined) item.tags = details.tags
        } catch {
          // keep search snippet if watch page fails
        }
        if (i < toEnrich.length - 1) {
          await new Promise((r) => setTimeout(r, SCRAPER_DELAY_BETWEEN_WATCH_MS))
        }
      }
    }

    return { items }
  } finally {
    if (browser) await browser.close()
  }
}
