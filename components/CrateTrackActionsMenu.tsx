"use client"

import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  getPlaylists,
  createPlaylist,
  addYoutubeToPlaylist,
  type UserPlaylist,
} from "@/lib/user-playlists"

type Props = {
  userId: string
  youtubeId: string
  isPro: boolean
  removeLabel: string
  onRemove: () => void
}

const PANEL_W = 240

export default function CrateTrackActionsMenu({
  userId,
  youtubeId,
  isPro,
  removeLabel,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"main" | "playlists" | "pro">("main")
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([])
  const [newName, setNewName] = useState("")
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const refresh = useCallback(() => {
    setPlaylists(getPlaylists(userId))
  }, [userId])

  useEffect(() => {
    refresh()
    window.addEventListener("userPlaylistsUpdated", refresh)
    return () => window.removeEventListener("userPlaylistsUpdated", refresh)
  }, [refresh])

  const positionPanel = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    let left = r.right - PANEL_W
    left = Math.max(8, Math.min(left, window.innerWidth - PANEL_W - 8))
    setPos({ top: r.bottom + 6, left })
  }, [])

  const handleOpen = () => {
    if (open) {
      setOpen(false)
      return
    }
    setView("main")
    setNewName("")
    refresh()
    positionPanel()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    const onScroll = () => positionPanel()
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onScroll, true)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onScroll, true)
    }
  }, [open, positionPanel])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const handleAddToPlaylistClick = () => {
    if (!isPro) {
      setView("pro")
      return
    }
    setView("playlists")
    setNewName("")
  }

  const handleCreatePlaylist = () => {
    const pl = createPlaylist(userId, newName)
    if (pl) {
      addYoutubeToPlaylist(userId, pl.id, youtubeId)
      setNewName("")
      refresh()
      setOpen(false)
    }
  }

  const handlePickPlaylist = (playlistId: string) => {
    addYoutubeToPlaylist(userId, playlistId, youtubeId)
    setOpen(false)
  }

  const panelStyle: CSSProperties = {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    width: PANEL_W,
    zIndex: 5000,
    background: "rgba(14, 12, 10, 0.98)",
    border: "1px solid rgba(240, 235, 225, 0.12)",
    borderRadius: 12,
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  }

  const menu = open ? (
    <div ref={panelRef} style={panelStyle} role="menu">
      {view === "main" && (
        <div className="py-1.5">
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition hover:bg-white/5"
            style={{ color: "#f5f0e8" }}
            onClick={handleAddToPlaylistClick}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-80" aria-hidden>
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
              <path d="M17 14v6M14 17h6" />
            </svg>
            Add to playlist
            {!isPro && <span className="text-[10px] opacity-50 ml-auto">Pro</span>}
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2.5 text-sm transition hover:bg-white/5"
            style={{ color: "#fca5a5" }}
            onClick={() => {
              onRemove()
              setOpen(false)
            }}
          >
            {removeLabel}
          </button>
        </div>
      )}

      {view === "pro" && (
        <div className="p-4">
          <p className="text-sm mb-3" style={{ color: "rgba(245,240,232,0.85)" }}>
            Playlists are a <strong>Pro</strong> feature. Upgrade to organize tracks into custom lists.
          </p>
          <Link
            href="/pro"
            className="block text-center py-2.5 rounded-lg text-sm font-semibold no-underline transition hover:opacity-90"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            onClick={() => setOpen(false)}
          >
            View Pro
          </Link>
          <button
            type="button"
            className="w-full mt-2 text-xs py-2 opacity-60 hover:opacity-100"
            style={{ color: "var(--muted)" }}
            onClick={() => setView("main")}
          >
            Back
          </button>
        </div>
      )}

      {view === "playlists" && isPro && (
        <div className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              className="p-1 rounded hover:bg-white/10"
              aria-label="Back"
              onClick={() => setView("main")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(245,240,232,0.7)", fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace" }}>
              Add to playlist
            </span>
          </div>
          <div
            className="flex rounded-full overflow-hidden border mb-3"
            style={{ borderColor: "rgba(240,235,225,0.15)", background: "rgba(0,0,0,0.25)" }}
          >
            <input
              type="text"
              placeholder="New playlist"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
              className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:italic"
              style={{ color: "#f5f0e8" }}
            />
            <button
              type="button"
              className="shrink-0 px-3 py-2 text-lg leading-none transition hover:bg-white/10"
              style={{ borderLeft: "1px solid rgba(240,235,225,0.12)" }}
              aria-label="Create playlist and add track"
              onClick={handleCreatePlaylist}
            >
              +
            </button>
          </div>
          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
            {playlists.length === 0 ? (
              <p className="text-xs py-2" style={{ color: "rgba(245,240,232,0.45)" }}>
                No playlists yet — create one above.
              </p>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  className="w-full text-left px-2 py-2 rounded-lg text-sm flex items-center gap-2 transition hover:bg-white/8"
                  style={{ color: "#f5f0e8" }}
                  onClick={() => handlePickPlaylist(pl.id)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-60" aria-hidden>
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span className="truncate flex-1">{pl.name}</span>
                  <span className="text-[10px] tabular-nums opacity-40">{pl.youtubeIds.length}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  ) : null

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="flex items-center justify-center min-w-[2rem] h-8 rounded-md transition hover:bg-white/10 shrink-0"
        style={{ color: "rgba(255,255,255,0.45)" }}
        aria-label="Track actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation()
          handleOpen()
        }}
      >
        <span className="flex flex-row items-center gap-[3px]" aria-hidden>
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
        </span>
      </button>
      {typeof document !== "undefined" && createPortal(menu, document.body)}
    </>
  )
}
