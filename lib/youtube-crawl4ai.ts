/**
 * YouTube search via Crawl4AI (Python). Set USE_CRAWL4AI=true in env.
 * See scripts/requirements-crawl4ai.txt and scripts/yt_search_crawl4ai.py.
 * Optional watch-page enrichment reuses lib/youtube-scraper (Playwright) — no Search API.
 */

import { spawn } from "child_process"
import path from "path"

export interface Crawl4aiScrapedItem {
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

function pythonBinary(): string {
  return process.env.CRAWL4AI_PYTHON?.trim() || "python3"
}

/** Crawl4AI prints progress lines starting with "["; find the JSON array line. */
function parseCrawl4aiJsonArray(stdout: string): unknown {
  const lines = stdout.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim()
    if (!t.startsWith("[")) continue
    try {
      const v = JSON.parse(t) as unknown
      if (Array.isArray(v)) return v
    } catch {
      /* e.g. "[FETCH]" is not JSON */
    }
  }
  const start = lines.findIndex((l) => {
    const t = l.trimStart()
    return t.startsWith("[") && (t.startsWith("[{") || t === "[]")
  })
  if (start >= 0) {
    return JSON.parse(lines.slice(start).join("\n").trim()) as unknown
  }
  return JSON.parse(stdout.trim()) as unknown
}

/**
 * Run Crawl4AI against YouTube search; returns API-shaped items.
 */
export async function crawl4aiYouTubeSearch(
  query: string,
  options?: { enrichDetailsForFirst?: number }
): Promise<{ items: Crawl4aiScrapedItem[] }> {
  const scriptPath = path.join(process.cwd(), "scripts", "yt_search_crawl4ai.py")
  const py = pythonBinary()
  const items = await new Promise<Crawl4aiScrapedItem[]>((resolve, reject) => {
    const proc = spawn(py, [scriptPath, query], {
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let out = ""
    let err = ""
    proc.stdout?.on("data", (d: Buffer) => {
      out += d.toString()
    })
    proc.stderr?.on("data", (d: Buffer) => {
      err += d.toString()
    })
    proc.on("error", (e) => reject(e))
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err.trim() || `Crawl4AI subprocess exited ${code}`))
        return
      }
      if (err.trim()) console.error("[Crawl4AI]", err.trim())
      try {
        const parsed = parseCrawl4aiJsonArray(out) as unknown
        if (parsed && typeof parsed === "object" && "error" in (parsed as object)) {
          reject(new Error(String((parsed as { error: string }).error)))
          return
        }
        if (!Array.isArray(parsed)) {
          reject(new Error("Crawl4AI returned non-array JSON"))
          return
        }
        resolve(parsed as Crawl4aiScrapedItem[])
      } catch (e) {
        reject(new Error(`Crawl4AI invalid JSON: ${(e as Error).message}`))
      }
    })
  })

  const enrich = Math.max(0, options?.enrichDetailsForFirst ?? 0)
  if (enrich > 0 && items.length > 0) {
    const { scrapeYouTubeVideoDetails } = await import("./youtube-scraper")
    const n = Math.min(enrich, items.length)
    for (let i = 0; i < n; i++) {
      const item = items[i]
      const id = item.id?.videoId
      if (!id) continue
      try {
        const details = await scrapeYouTubeVideoDetails(id, { timeoutMs: 15_000 })
        if (details.title) item.snippet.title = details.title
        if (details.description !== undefined) item.description = details.description
        if (details.duration !== undefined) item.duration = details.duration
        if (details.tags !== undefined) item.tags = details.tags
      } catch {
        // keep search-level fields
      }
    }
  }

  return { items }
}
