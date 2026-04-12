const HISTORY_KEY = "sampleroll_dig_history"
const MAX_HISTORY = 1000

export interface HistoryItem {
  youtubeId: string
  title: string
  channel: string
  thumbnailUrl: string
  genre?: string | null
  bpm?: number | null
  key?: string | null
  viewedAt: number // unix ms
}

// ---------------------------------------------------------------------------
// localStorage helpers (used for non-Pro / offline cache)
// ---------------------------------------------------------------------------

export function recordHistory(item: Omit<HistoryItem, "viewedAt">): void {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const existing: HistoryItem[] = raw ? JSON.parse(raw) : []
    // Move to front if already in history, otherwise prepend
    const filtered = existing.filter((h) => h.youtubeId !== item.youtubeId)
    const next = [{ ...item, viewedAt: Date.now() }, ...filtered].slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent("digHistoryUpdated"))
  } catch {}
}

export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(HISTORY_KEY)
    window.dispatchEvent(new CustomEvent("digHistoryUpdated"))
  } catch {}
}

export function removeHistoryItem(youtubeId: string): void {
  if (typeof window === "undefined" || !youtubeId) return
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const existing: HistoryItem[] = raw ? JSON.parse(raw) : []
    const next = existing.filter((h) => h.youtubeId !== youtubeId)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent("digHistoryUpdated"))
  } catch {}
}

// ---------------------------------------------------------------------------
// Server-sync helpers (Pro users — persists to database)
// ---------------------------------------------------------------------------

/** Record a history item on the server (Pro only). Fire-and-forget. */
export async function recordHistoryServer(item: Omit<HistoryItem, "viewedAt">): Promise<void> {
  try {
    await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    })
  } catch {}
}

/** Fetch persisted history from server (Pro only). Returns [] on error. */
export async function fetchHistoryServer(): Promise<HistoryItem[]> {
  try {
    const res = await fetch("/api/history")
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.items) ? data.items : []
  } catch {
    return []
  }
}

/** Remove a single history item on the server (Pro only). Fire-and-forget. */
export async function removeHistoryItemServer(youtubeId: string): Promise<void> {
  try {
    await fetch(`/api/history/${encodeURIComponent(youtubeId)}`, { method: "DELETE" })
  } catch {}
}

/** Clear all history on the server (Pro only). Fire-and-forget. */
export async function clearHistoryServer(): Promise<void> {
  try {
    await fetch("/api/history", { method: "DELETE" })
  } catch {}
}

// ---------------------------------------------------------------------------

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(ms).toLocaleDateString()
}
