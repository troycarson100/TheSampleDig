"use client"

import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useGoProModal } from "@/components/GoProModalContext"
import { useSession } from "next-auth/react"
import HeartToggle from "./HeartToggle"
import CrateTrackActionsMenu from "./CrateTrackActionsMenu"
import { getHistory, clearHistory, timeAgo, removeHistoryItem, type HistoryItem } from "@/lib/dig-history"
import {
  getPlaylists,
  createPlaylist,
  deletePlaylist,
  pruneYoutubeFromAllPlaylists,
  removeYoutubeFromPlaylist,
  type UserPlaylist,
} from "@/lib/user-playlists"
import { useIsPro } from "@/hooks/useIsPro"

interface SavedSample {
  id: string
  youtubeId: string
  title: string
  channel: string
  thumbnailUrl: string
  genre?: string | null
  era?: string | null
  bpm?: number | null
  key?: string | null
  analysisStatus?: string | null
  savedAt: string
  startTime?: number
  duration?: number
  chops?: { key: string; time: number; color: string; index: number }[]
  loop?: { sequence: { key: string; timeMs: number }[]; loopStartMs: number; loopEndMs: number; fullLengthMs?: number }
  notes?: string | null
  bpmOverride?: number | null
}

interface SavedSamplesSidebarProps {
  onSampleClick?: (sample: SavedSample) => void
  onHistoryItemClick?: (item: HistoryItem) => void
  currentSampleId?: string
  /** In-memory session history for non–Pro users (clears on full page refresh). Pro users use localStorage instead. */
  sessionDigHistory?: HistoryItem[]
  onSessionDigHistoryClear?: () => void
  onSessionDigHistoryRemoveItem?: (youtubeId: string) => void
}

type Tab = "crate" | "history"

function formatTimestamp(seconds?: number): string {
  if (!seconds) return ""
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const DROPDOWN_W = 220

function PlaylistFilterDropdown({
  open,
  onClose,
  anchorRef,
  playlists,
  activePlaylistId,
  onSelectAll,
  onSelectPlaylist,
  onDeletePlaylist,
  isPro,
  userId,
  guestSignupHref,
  onProUpgrade,
}: {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
  playlists: UserPlaylist[]
  activePlaylistId: string | null
  onSelectAll: () => void
  onSelectPlaylist: (id: string) => void
  onDeletePlaylist: (id: string) => void
  /** True when user has Pro subscription (session); not useIsPro() soft gate */
  isPro: boolean
  /** Required for Pro “new playlist” create (localStorage key). */
  userId: string
  guestSignupHref: string
  /** Logged-in non-Pro: opens Pro modal. Guests use `guestSignupHref`. */
  onProUpgrade?: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [newPlaylistName, setNewPlaylistName] = useState("")

  const position = useCallback(() => {
    const r = anchorRef.current?.getBoundingClientRect()
    if (!r) return
    let left = r.left
    left = Math.max(8, Math.min(left, window.innerWidth - DROPDOWN_W - 8))
    setPos({ top: r.bottom + 6, left })
  }, [anchorRef])

  useEffect(() => {
    if (!open) return
    position()
    const onScroll = () => position()
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", position)
    return () => {
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", position)
    }
  }, [open, position])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      onClose()
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open, onClose, anchorRef])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) setNewPlaylistName("")
  }, [open])

  if (!open || typeof document === "undefined") return null

  const style: CSSProperties = {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    width: DROPDOWN_W,
    zIndex: 4990,
    background: "rgba(14, 12, 10, 0.98)",
    border: "1px solid rgba(240, 235, 225, 0.12)",
    borderRadius: 12,
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    maxHeight: "min(320px, 70vh)",
    overflow: "auto",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  }

  return createPortal(
    <div ref={panelRef} className="theme-vinyl" style={style} role="listbox" aria-label="Filter by playlist">
      <button
        type="button"
        role="option"
        aria-selected={activePlaylistId === null}
        className="w-full text-left px-3 py-2.5 text-sm transition hover:bg-white/5 border-b"
        style={{ color: "#f5f0e8", borderColor: "rgba(255,255,255,0.06)" }}
        onClick={() => {
          onSelectAll()
          onClose()
        }}
      >
        All saved samples
      </button>
      {isPro && userId ? (
        <div className="p-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p
            className="px-1 pb-2"
            style={{
              fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
              fontSize: "8px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(245,240,232,0.45)",
            }}
          >
            New playlist
          </p>
          <div
            className="flex rounded-full overflow-hidden border"
            style={{ borderColor: "rgba(240,235,225,0.15)", background: "rgba(0,0,0,0.25)" }}
          >
            <input
              type="text"
              placeholder="Name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return
                const pl = createPlaylist(userId, newPlaylistName)
                if (pl) {
                  setNewPlaylistName("")
                  onClose()
                }
              }}
              className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:italic"
              style={{ color: "#f5f0e8" }}
            />
            <button
              type="button"
              className="shrink-0 px-3 py-2 text-lg leading-none transition hover:bg-white/10"
              style={{ borderLeft: "1px solid rgba(240,235,225,0.12)" }}
              aria-label="Create playlist"
              onClick={() => {
                const pl = createPlaylist(userId, newPlaylistName)
                if (pl) {
                  setNewPlaylistName("")
                  onClose()
                }
              }}
            >
              +
            </button>
          </div>
        </div>
      ) : null}
      {!isPro && (
        <div className="p-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {onProUpgrade ? (
            <button
              type="button"
              className="sample-notes-pro-gate theme-vinyl flex items-center justify-between gap-2 w-full rounded-lg px-3 py-2.5 transition hover:opacity-95 border-0 cursor-pointer text-left"
              style={{
                fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
                fontSize: "9px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#fff",
                boxSizing: "border-box",
                background: "transparent",
              }}
              onClick={() => {
                onProUpgrade()
                onClose()
              }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-95" aria-hidden>
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                  <path d="M17 14v6M14 17h6" />
                </svg>
                <span className="truncate">Add playlist</span>
              </span>
              <span className="pro-locked-filter-row__pill--cta shrink-0 inline-flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                PRO
              </span>
            </button>
          ) : (
            <Link
              href={guestSignupHref}
              className="sample-notes-pro-gate theme-vinyl flex items-center justify-between gap-2 w-full rounded-lg px-3 py-2.5 no-underline transition hover:opacity-95"
              style={{
                fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
                fontSize: "9px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#fff",
                boxSizing: "border-box",
              }}
              onClick={onClose}
            >
              <span className="flex items-center gap-2 min-w-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-95" aria-hidden>
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                  <path d="M17 14v6M14 17h6" />
                </svg>
                <span className="truncate">Add playlist</span>
              </span>
              <span className="pro-locked-filter-row__pill--cta shrink-0 inline-flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                PRO
              </span>
            </Link>
          )}
        </div>
      )}
      {isPro &&
        playlists.map((pl) => (
          <div
            key={pl.id}
            className="flex items-center gap-1 border-b last:border-0"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <button
              type="button"
              role="option"
              aria-selected={activePlaylistId === pl.id}
              className="flex-1 min-w-0 text-left px-3 py-2.5 text-sm truncate transition hover:bg-white/5"
              style={{ color: "#f5f0e8" }}
              onClick={() => {
                onSelectPlaylist(pl.id)
                onClose()
              }}
            >
              {pl.name}
              <span className="text-[10px] tabular-nums opacity-40 ml-1">({pl.youtubeIds.length})</span>
            </button>
            <button
              type="button"
              className="shrink-0 flex items-center justify-center px-1 py-0.5 text-sm font-light leading-none transition-colors text-[#F0EBE1] hover:text-[#B85C38]"
              style={{ fontFamily: "system-ui, sans-serif" }}
              aria-label={`Delete playlist ${pl.name}`}
              onClick={(e) => {
                e.stopPropagation()
                onDeletePlaylist(pl.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
    </div>,
    document.body
  )
}

function TabBar({
  active,
  onSelect,
  crateCount,
  playlistChevronRef,
  onPlaylistChevronClick,
  playlistDropdownOpen,
}: {
  active: Tab
  onSelect: (t: Tab) => void
  crateCount: number
  playlistChevronRef: React.RefObject<HTMLButtonElement | null>
  onPlaylistChevronClick: () => void
  playlistDropdownOpen: boolean
}) {
  const tabStyle = (isActive: boolean): CSSProperties => ({
    fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace",
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
  })

  const crateActive = active === "crate"
  const historyActive = active === "history"
  const badge = crateCount > 0 ? crateCount : null

  return (
    <div
      className="flex items-stretch border-b shrink-0"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
      role="tablist"
    >
      {/* My Crate: label + badge in one button; playlist chevron is a sibling (valid HTML — no nested buttons). */}
      <div className="flex-1 flex items-stretch min-w-0 relative">
        <button
          type="button"
          role="tab"
          aria-selected={crateActive}
          onClick={() => onSelect("crate")}
          className="flex-1 flex items-center justify-center gap-1 py-4 text-center transition-colors min-w-0"
          style={tabStyle(crateActive)}
        >
          <span className="inline-flex items-center gap-0.5">My Crate</span>
          {badge !== null && (
            <span
              className="inline-flex items-center justify-center rounded-full tabular-nums"
              style={{
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                fontSize: "8px",
                fontWeight: 700,
                background: crateActive ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)",
                color: crateActive ? "#fff" : "rgba(255,255,255,0.4)",
              }}
            >
              {badge}
            </span>
          )}
        </button>
        <button
          ref={playlistChevronRef}
          type="button"
          className="shrink-0 px-1.5 flex items-center self-stretch hover:bg-white/10 transition"
          style={{ color: playlistDropdownOpen ? "var(--rust-l)" : "rgba(255,255,255,0.45)" }}
          aria-label="Playlists"
          aria-expanded={playlistDropdownOpen}
          onClick={(e) => {
            e.stopPropagation()
            onPlaylistChevronClick()
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        {crateActive && (
          <span
            className="pointer-events-none absolute bottom-0 left-2 right-2 rounded-t-sm"
            style={{ height: 2, background: "var(--rust)" }}
            aria-hidden
          />
        )}
      </div>

      <button
        type="button"
        role="tab"
        aria-selected={historyActive}
        onClick={() => onSelect("history")}
        className="flex-1 flex items-center justify-center gap-1 py-4 text-center transition-colors relative"
        style={tabStyle(historyActive)}
      >
        <span>History</span>
        {historyActive && (
          <span
            className="absolute bottom-0 left-4 right-4 rounded-t-sm"
            style={{ height: 2, background: "var(--rust)" }}
            aria-hidden
          />
        )}
      </button>
    </div>
  )
}

function HistoryList({
  onItemClick,
  userId,
  isPro,
  ephemeralItems,
  onEphemeralClear,
  onEphemeralRemoveItem,
}: {
  onItemClick?: (item: HistoryItem) => void
  userId: string
  isPro: boolean
  /** When set (including `[]`), list is driven by parent state — session-only until refresh for non-Pro. */
  ephemeralItems?: HistoryItem[]
  onEphemeralClear?: () => void
  onEphemeralRemoveItem?: (youtubeId: string) => void
}) {
  const isEphemeral = ephemeralItems !== undefined
  const [persistedItems, setPersistedItems] = useState<HistoryItem[]>([])
  const [, setTick] = useState(0)

  const loadPersisted = () => setPersistedItems(getHistory())

  useEffect(() => {
    if (isEphemeral) return
    loadPersisted()
    window.addEventListener("digHistoryUpdated", loadPersisted)
    return () => window.removeEventListener("digHistoryUpdated", loadPersisted)
  }, [isEphemeral])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const items = isEphemeral ? ephemeralItems : persistedItems

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,255,255,0.2)", marginBottom: 10 }} aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <p style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "10px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}>
          No history yet
        </p>
        <p style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "9px", color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
          Roll the dice to discover samples
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <span style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "9px", letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)" }}>
          {items.length} tracks
        </span>
        <button
          type="button"
          onClick={() => {
            if (isEphemeral) {
              onEphemeralClear?.()
            } else {
              clearHistory()
              setPersistedItems([])
            }
          }}
          className="transition hover:opacity-80"
          style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}
        >
          Clear
        </button>
      </div>
      <div className="pl-5 pr-4 pb-4">
        {items.map((item, index) => (
          <div key={`${item.youtubeId}-${item.viewedAt}`}>
            <div className="group py-3 transition-opacity duration-150 hover:opacity-90">
              <div className="flex gap-3 items-start">
                <div
                  className="relative shrink-0 rounded-md overflow-hidden bg-black/20 cursor-pointer"
                  style={{ width: 56, height: 42 }}
                  onClick={() => onItemClick?.(item)}
                >
                  <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onItemClick?.(item)}>
                  <p
                    className="text-white line-clamp-2 leading-snug mb-1"
                    style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontSize: "11px", fontWeight: 500 }}
                  >
                    {item.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.genre && (
                      <span
                        className="rounded"
                        style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", padding: "2px 5px" }}
                      >
                        {item.genre}
                      </span>
                    )}
                    {item.bpm != null && (
                      <span className="rounded font-mono" style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "8px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", padding: "2px 5px" }}>
                        {item.bpm} BPM
                      </span>
                    )}
                    {item.key && (
                      <span className="rounded font-mono" style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "8px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", padding: "2px 5px" }}>
                        {item.key}
                      </span>
                    )}
                    <span style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "8px", color: "rgba(255,255,255,0.25)" }}>
                      {timeAgo(item.viewedAt)}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <CrateTrackActionsMenu
                    userId={userId}
                    youtubeId={item.youtubeId}
                    isPro={isPro}
                    removeLabel="Remove from history"
                    onRemove={() => {
                      if (isEphemeral) onEphemeralRemoveItem?.(item.youtubeId)
                      else removeHistoryItem(item.youtubeId)
                    }}
                  />
                </div>
              </div>
            </div>
            {index < items.length - 1 && (
              <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SavedSamplesSidebar({
  onSampleClick,
  onHistoryItemClick,
  currentSampleId,
  sessionDigHistory,
  onSessionDigHistoryClear,
  onSessionDigHistoryRemoveItem,
}: SavedSamplesSidebarProps) {
  const { data: session, status } = useSession()
  const { openProModal } = useGoProModal()
  const isPro = useIsPro()
  /** Real subscription — History list uses this, not the env-based UI bypass in useIsPro. */
  const hasProSubscription = session?.user?.isPro === true
  const userId = session?.user?.id ?? ""

  /** Guests default to History; logged-in users default to My Crate (set once session is known). */
  const [activeTab, setActiveTab] = useState<Tab>("history")
  const tabAuthRef = useRef<boolean | null>(null)

  useEffect(() => {
    if (status === "loading") return
    const authed = status === "authenticated" && !!session?.user
    if (tabAuthRef.current === null) {
      tabAuthRef.current = authed
      setActiveTab(authed ? "crate" : "history")
      return
    }
    if (tabAuthRef.current === true && !authed) {
      setActiveTab("history")
    } else if (tabAuthRef.current === false && authed) {
      setActiveTab("crate")
    }
    tabAuthRef.current = authed
  }, [status, session?.user])
  const [samples, setSamples] = useState<SavedSample[]>([])
  const [loading, setLoading] = useState(true)
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([])
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  const [playlistDropdownOpen, setPlaylistDropdownOpen] = useState(false)
  const playlistChevronRef = useRef<HTMLButtonElement>(null)

  const refreshPlaylists = useCallback(() => {
    if (userId) setPlaylists(getPlaylists(userId))
  }, [userId])

  useEffect(() => {
    refreshPlaylists()
    window.addEventListener("userPlaylistsUpdated", refreshPlaylists)
    return () => window.removeEventListener("userPlaylistsUpdated", refreshPlaylists)
  }, [refreshPlaylists])

  useEffect(() => {
    if (session) fetchSavedSamples()
    else {
      setSamples([])
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    const handle = () => {
      if (session) fetchSavedSamples()
    }
    window.addEventListener("samplesUpdated", handle)
    return () => window.removeEventListener("samplesUpdated", handle)
  }, [session])

  const fetchSavedSamples = async () => {
    try {
      const response = await fetch("/api/samples/saved")
      if (response.ok) setSamples(await response.json())
    } catch {}
    finally {
      setLoading(false)
    }
  }

  const handleUnsave = async (sample: SavedSample) => {
    try {
      const response = await fetch("/api/samples/unsave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId: sample.id }),
      })
      if (response.ok) {
        if (userId) pruneYoutubeFromAllPlaylists(userId, sample.youtubeId)
        setSamples((prev) => prev.filter((s) => s.id !== sample.id))
        window.dispatchEvent(new CustomEvent("samplesUpdated"))
      }
    } catch {}
  }

  const displayedCrateSamples = useMemo(() => {
    if (!activePlaylistId) return samples
    const pl = playlists.find((p) => p.id === activePlaylistId)
    if (!pl) return samples
    return samples.filter((s) => pl.youtubeIds.includes(s.youtubeId))
  }, [samples, activePlaylistId, playlists])

  const activePlaylistName = useMemo(() => {
    if (!activePlaylistId) return null
    return playlists.find((p) => p.id === activePlaylistId)?.name ?? null
  }, [activePlaylistId, playlists])

  const crateCount = samples.length

  return (
    <div className="h-full min-h-0 flex flex-col">
      <TabBar
        active={activeTab}
        onSelect={(t) => {
          setActiveTab(t)
          setPlaylistDropdownOpen(false)
        }}
        crateCount={crateCount}
        playlistChevronRef={playlistChevronRef}
        onPlaylistChevronClick={() => setPlaylistDropdownOpen((o) => !o)}
        playlistDropdownOpen={playlistDropdownOpen}
      />

      <PlaylistFilterDropdown
        open={playlistDropdownOpen}
        onClose={() => setPlaylistDropdownOpen(false)}
        anchorRef={playlistChevronRef}
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        onSelectAll={() => setActivePlaylistId(null)}
        onSelectPlaylist={(id) => setActivePlaylistId(id)}
        onDeletePlaylist={(id) => {
          if (userId) deletePlaylist(userId, id)
          if (activePlaylistId === id) setActivePlaylistId(null)
        }}
        isPro={hasProSubscription}
        userId={userId}
        guestSignupHref="/register"
        onProUpgrade={session ? () => openProModal() : undefined}
      />

      {/* My Crate: locked for guests */}
      {activeTab === "crate" && !session && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 text-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "rgba(184,92,56,0.12)", color: "var(--rust)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <div className="flex flex-col gap-1">
            <p style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
              Save your discoveries
            </p>
            <p style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "9px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
              Create a free account to heart tracks and build your crate.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <Link
              href="/register"
              className="w-full py-2.5 rounded-lg text-center no-underline transition hover:opacity-90"
              style={{ background: "var(--rust)", color: "#fff", fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="w-full py-2 rounded-lg text-center no-underline border transition hover:opacity-80"
              style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      )}

      {/* Non-Pro: session-only history (clears on refresh); Pro: persisted in localStorage */}
      {activeTab === "history" && !hasProSubscription && (
        <div
          className="shrink-0 px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.25)" }}
        >
          <p
            className="text-center leading-relaxed mb-2"
            style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "9px", letterSpacing: "0.06em", color: "rgba(245,240,232,0.55)" }}
          >
            Session only — list clears when you refresh. Pro saves up to 1,000 tracks across visits.
          </p>
            <button
              type="button"
              className="pro-gradient-btn pro-gradient-btn--block pro-gradient-btn--lg pro-gradient-btn--rounded text-center font-bold border-0 cursor-pointer w-full"
              onClick={() => openProModal()}
            >
              TRY PRO FREE
            </button>
        </div>
      )}

      {activeTab === "crate" && session && activePlaylistId && activePlaylistName && (
        <div
          className="flex items-center justify-between px-4 py-2 shrink-0 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}
        >
          <span
            className="text-[10px] uppercase tracking-wider truncate pr-2"
            style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", color: "rgba(245,240,232,0.75)" }}
          >
            {activePlaylistName}
            <span className="opacity-50 ml-1">({displayedCrateSamples.length})</span>
          </span>
          <button
            type="button"
            className="text-[10px] uppercase shrink-0 hover:opacity-80"
            style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", color: "rgba(245,240,232,0.45)" }}
            onClick={() => setActivePlaylistId(null)}
          >
            Show all
          </button>
        </div>
      )}

      {activeTab === "crate" && session && (
        <>
          {loading ? (
            <div className="flex-1 px-5 pt-5">
              <p style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>
                Loading...
              </p>
            </div>
          ) : samples.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,255,255,0.2)", marginBottom: 10 }} aria-hidden>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <p style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "10px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}>
                No saved samples yet
              </p>
            </div>
          ) : displayedCrateSamples.length === 0 ? (
            <div className="flex-1 px-5 py-8 text-center">
              <p style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>
                No tracks in this playlist yet.
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pl-5 pr-4 pb-4 pt-3">
              {displayedCrateSamples.map((sample, index) => (
                <div key={sample.id}>
                  <div
                    className={`group cursor-pointer py-3 transition-opacity duration-150 ${
                      currentSampleId === sample.id ? "opacity-100" : "opacity-80 hover:opacity-100"
                    }`}
                    onClick={() => onSampleClick?.(sample)}
                  >
                    <div className="flex gap-3 items-start">
                      <div className="relative shrink-0 rounded-md overflow-hidden bg-black/20" style={{ width: 56, height: 42 }}>
                        <img src={sample.thumbnailUrl} alt={sample.title} className="w-full h-full object-cover" loading="lazy" />
                        {sample.startTime && (
                          <div className="absolute bottom-0 right-0 bg-black/70 text-white px-1 rounded-tl text-[8px] font-mono leading-tight py-0.5">
                            {formatTimestamp(sample.startTime)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-white line-clamp-2 leading-snug mb-1"
                          style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontSize: "11px", fontWeight: 500 }}
                        >
                          {sample.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {sample.genre && (
                            <span className="rounded" style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", padding: "2px 5px" }}>
                              {sample.genre}
                            </span>
                          )}
                          {sample.bpm != null && (
                            <span className="rounded" style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "8px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", padding: "2px 5px" }}>
                              {sample.bpm} BPM
                            </span>
                          )}
                          {sample.key && (
                            <span className="rounded" style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "8px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", padding: "2px 5px" }}>
                              {sample.key}
                            </span>
                          )}
                          {sample.notes != null && sample.notes.trim() !== "" && (
                            <span className="inline-flex items-center justify-center rounded" style={{ width: 18, height: 16, background: "rgba(255,255,255,0.08)" }} title="Has note" aria-label="Has note">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <HeartToggle isSaved={true} onToggle={() => handleUnsave(sample)} size="sm" className="opacity-70 hover:opacity-100 transition-opacity" />
                        <CrateTrackActionsMenu
                          userId={userId}
                          youtubeId={sample.youtubeId}
                          isPro={hasProSubscription}
                          removeLabel={activePlaylistId ? "Remove from playlist" : "Remove from crate"}
                          onRemove={() => {
                            if (activePlaylistId && userId) {
                              removeYoutubeFromPlaylist(userId, activePlaylistId, sample.youtubeId)
                            } else {
                              void handleUnsave(sample)
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  {index < displayedCrateSamples.length - 1 && (
                    <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "history" && (
        <HistoryList
          onItemClick={onHistoryItemClick}
          userId={userId}
          isPro={isPro}
          {...(hasProSubscription
            ? {}
            : {
                ephemeralItems: sessionDigHistory ?? [],
                onEphemeralClear: onSessionDigHistoryClear,
                onEphemeralRemoveItem: onSessionDigHistoryRemoveItem,
              })}
        />
      )}
    </div>
  )
}
