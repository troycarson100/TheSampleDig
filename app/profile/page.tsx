"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import HeartToggle from "@/components/HeartToggle"
import SiteNav from "@/components/SiteNav"
import CrateFilterPanel from "@/components/CrateFilterPanel"
import { sampleMatchesDrumBreakFilter, titleIsExclusiveDrumBreakUpload } from "@/lib/drum-break-title-match"
import { getPlaylists, pruneYoutubeFromAllPlaylists } from "@/lib/user-playlists"
import type { UserPlaylist } from "@/lib/user-playlists"

const DIG_LOAD_SAMPLE_KEY = "digLoadSample"

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
  tags?: string | null
  savedAt: string
  startTime?: number
  duration?: number
  chops?: { key: string; time: number; color: string; index: number }[]
  loop?: { sequence: { key: string; timeMs: number }[]; loopStartMs: number; loopEndMs: number; fullLengthMs?: number }
  notes?: string | null
}

type FilterType = "genre" | "key" | "tempo" | "drumBreak" | "playlist"

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [samples, setSamples] = useState<SavedSample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [genreFilter, setGenreFilter] = useState<string | null>(null)
  const [keyFilter, setKeyFilter] = useState<string | null>(null)
  const [tempoRange, setTempoRange] = useState<[number, number]>([20, 300])
  const [drumBreakOnly, setDrumBreakOnly] = useState(false)
  const [playlistFilterId, setPlaylistFilterId] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)

  const userId = session?.user?.id ?? ""

  const refreshPlaylists = useCallback(() => {
    if (userId) setPlaylists(getPlaylists(userId))
  }, [userId])

  useEffect(() => {
    refreshPlaylists()
    window.addEventListener("userPlaylistsUpdated", refreshPlaylists)
    return () => window.removeEventListener("userPlaylistsUpdated", refreshPlaylists)
  }, [refreshPlaylists])

  useEffect(() => {
    if (playlistFilterId && !playlists.some((p) => p.id === playlistFilterId)) {
      setPlaylistFilterId(null)
    }
  }, [playlists, playlistFilterId])

  useEffect(() => {
    if (session) {
      fetchSavedSamples()
    } else {
      setLoading(false)
    }
  }, [session])

  const fetchSavedSamples = async () => {
    try {
      const response = await fetch("/api/samples/saved")
      if (!response.ok) {
        throw new Error("Failed to fetch saved samples")
      }
      const data = await response.json()
      setSamples(data)
    } catch (err) {
      setError("Failed to load saved samples")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleUnsave = async (sampleId: string) => {
    try {
      const response = await fetch("/api/samples/unsave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId }),
      })

      if (response.ok) {
        const removed = samples.find((s) => s.id === sampleId)
        if (removed && userId) pruneYoutubeFromAllPlaylists(userId, removed.youtubeId)
        setSamples(samples.filter((s) => s.id !== sampleId))
        window.dispatchEvent(new CustomEvent('samplesUpdated'))
      }
    } catch (error) {
      console.error("Error unsaving sample:", error)
    }
  }

  const formatTimestamp = (seconds?: number): string => {
    if (!seconds) return ""
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Derive filter options from current samples
  const genreOptions = useMemo(
    () => [...new Set(samples.map((s) => s.genre).filter(Boolean))].sort() as string[],
    [samples]
  )
  const keyOptions = useMemo(
    () => [...new Set(samples.map((s) => s.key).filter(Boolean))].sort() as string[],
    [samples]
  )

  // Filter samples by search (title, bpm, key, genre), dropdown filters, tempo range, and optional playlist
  const filteredSamples = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const [tempoMin, tempoMax] = tempoRange
    const playlistYoutubeIds =
      playlistFilterId != null ? playlists.find((p) => p.id === playlistFilterId)?.youtubeIds : null

    return samples.filter((s) => {
      if (playlistYoutubeIds != null && !playlistYoutubeIds.includes(s.youtubeId)) return false
      if (q) {
        const titleMatch = s.title?.toLowerCase().includes(q)
        const genreMatch = s.genre?.toLowerCase().includes(q)
        const keyMatch = s.key?.toLowerCase().includes(q)
        const bpmMatch = s.bpm != null && String(s.bpm).includes(q)
        if (!titleMatch && !genreMatch && !keyMatch && !bpmMatch) return false
      }
      if (genreFilter != null && genreFilter !== "" && s.genre !== genreFilter) return false
      if (keyFilter != null && keyFilter !== "" && s.key !== keyFilter) return false
      if (s.bpm != null && (s.bpm < tempoMin || s.bpm > tempoMax)) return false
      if (!drumBreakOnly && titleIsExclusiveDrumBreakUpload(s.title)) return false
      if (drumBreakOnly && !sampleMatchesDrumBreakFilter(s.title, s.tags)) return false
      return true
    })
  }, [samples, searchQuery, genreFilter, keyFilter, tempoRange, drumBreakOnly, playlistFilterId, playlists])

  const clearFilter = (type: FilterType) => {
    if (type === "genre") setGenreFilter(null)
    if (type === "key") setKeyFilter(null)
    if (type === "tempo") setTempoRange([20, 300])
    if (type === "drumBreak") setDrumBreakOnly(false)
    if (type === "playlist") setPlaylistFilterId(null)
  }

  const resetModalFilters = useCallback(() => {
    setGenreFilter(null)
    setKeyFilter(null)
    setTempoRange([20, 300])
    setDrumBreakOnly(false)
  }, [])

  const resetAllCrateFilters = () => {
    resetModalFilters()
    setPlaylistFilterId(null)
  }

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    genreFilter != null ||
    keyFilter != null ||
    tempoRange[0] !== 20 ||
    tempoRange[1] !== 300 ||
    drumBreakOnly ||
    playlistFilterId != null

  const playlistFilterName =
    playlistFilterId != null ? playlists.find((p) => p.id === playlistFilterId)?.name ?? null : null

  const openInDig = (s: SavedSample) => {
    try {
      sessionStorage.setItem(
        DIG_LOAD_SAMPLE_KEY,
        JSON.stringify({
          id: s.id,
          youtubeId: s.youtubeId,
          title: s.title,
          channel: s.channel,
          thumbnailUrl: s.thumbnailUrl,
          genre: s.genre,
          era: s.era,
          bpm: s.bpm,
          key: s.key,
          analysisStatus: s.analysisStatus,
          startTime: s.startTime,
          duration: s.duration,
          chops: s.chops,
          loop: s.loop,
          notes: s.notes,
        })
      )
      router.push("/dig")
    } catch (e) {
      console.warn("Failed to store sample for dig", e)
    }
  }

  const genreOptionsForSelect = useMemo(
    () => [{ value: "", label: "Any genre" }, ...genreOptions.map((g) => ({ value: g, label: g }))],
    [genreOptions]
  )

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen theme-vinyl flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-xl" style={{ color: "var(--brown)", fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace" }}>Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
        <header className="site-header w-full">
          <SiteNav />
        </header>
        <div className="profile-page-wrap">
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <h1 className="profile-title uppercase mb-2">My Crate</h1>
            <p className="profile-count mb-6" style={{ color: "var(--muted)" }}>
              Sign up for free to save samples. Sign in to see your saved samples.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="btn-primary inline-block no-underline">Register</Link>
              <Link href="/login" className="inline-block no-underline py-2.5 px-5 rounded-lg border font-medium" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <div className="profile-page-wrap">
        <div className="pt-2 pb-4">
          <h1 className="profile-title uppercase">My Crate</h1>
          <p className="profile-count">{samples.length} {samples.length === 1 ? "sample" : "samples"} saved</p>
        </div>

          {samples.length > 0 && (
            <>
              <div className="profile-filter-bar">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <input
                      type="search"
                      placeholder="Search by title, BPM, key or genre..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label="Search samples by title, BPM, key or genre"
                    />
                    <CrateFilterPanel
                      open={filtersOpen}
                      onOpen={() => setFiltersOpen(true)}
                      onClose={() => setFiltersOpen(false)}
                      genreFilter={genreFilter}
                      onGenreChange={setGenreFilter}
                      genreOptions={genreOptionsForSelect}
                      keyFilter={keyFilter}
                      onKeyChange={setKeyFilter}
                      keyOptions={keyOptions}
                      drumBreakOnly={drumBreakOnly}
                      onDrumBreakChange={setDrumBreakOnly}
                      tempoRange={tempoRange}
                      onTempoRangeChange={setTempoRange}
                      isPro={session?.user?.isPro === true}
                      onReset={resetModalFilters}
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
                    <span className="filter-label whitespace-nowrap">Playlist</span>
                    <select
                      value={playlistFilterId ?? ""}
                      onChange={(e) => setPlaylistFilterId(e.target.value ? e.target.value : null)}
                      className="profile-key-select min-w-[12rem] max-w-[20rem]"
                      aria-label="Filter by playlist"
                    >
                      <option value="">All saved samples</option>
                      {playlists.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.youtubeIds.length})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 profile-active-filters">
                  <span>Active:</span>
                  {searchQuery.trim() !== "" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm" style={{ background: "var(--muted-light)", color: "var(--brown)" }}>
                      Search: {searchQuery.trim()}
                      <button type="button" onClick={() => setSearchQuery("")} className="rounded-full p-0.5 hover:opacity-70 transition" aria-label="Clear search">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  )}
                  {genreFilter != null && genreFilter !== "" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm" style={{ background: "var(--muted-light)", color: "var(--brown)" }}>
                      {genreFilter}
                      <button type="button" onClick={() => clearFilter("genre")} className="rounded-full p-0.5 hover:opacity-70 transition" aria-label="Remove genre filter">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  )}
                  {keyFilter != null && keyFilter !== "" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono" style={{ background: "var(--muted-light)", color: "var(--brown)" }}>
                      {keyFilter}
                      <button type="button" onClick={() => clearFilter("key")} className="rounded-full p-0.5 hover:opacity-70 transition" aria-label="Remove key filter">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  )}
                  {(tempoRange[0] !== 20 || tempoRange[1] !== 300) && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono" style={{ background: "var(--muted-light)", color: "var(--brown)" }}>
                      {tempoRange[0]}-{tempoRange[1]} bpm
                      <button type="button" onClick={() => clearFilter("tempo")} className="rounded-full p-0.5 hover:opacity-70 transition" aria-label="Remove tempo filter">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  )}
                  {drumBreakOnly && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm" style={{ background: "var(--muted-light)", color: "var(--brown)" }}>
                      Drum breaks
                      <button type="button" onClick={() => clearFilter("drumBreak")} className="rounded-full p-0.5 hover:opacity-70 transition" aria-label="Remove drum break filter">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  )}
                  {playlistFilterId != null && playlistFilterName != null && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm max-w-[220px]" style={{ background: "var(--muted-light)", color: "var(--brown)" }}>
                      <span className="truncate">Playlist: {playlistFilterName}</span>
                      <button type="button" onClick={() => clearFilter("playlist")} className="rounded-full p-0.5 hover:opacity-70 transition shrink-0" aria-label="Remove playlist filter">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  )}
                  <span>Showing {filteredSamples.length} of {samples.length} samples</span>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl border" style={{ background: "rgba(185,28,28,0.06)", borderColor: "rgba(185,28,28,0.2)", color: "#b91c1c" }}>{error}</div>
          )}

          {samples.length === 0 && !loading ? (
            <div className="text-center py-12">
              <p className="profile-count mb-4">You haven't saved any samples yet.</p>
              <Link href="/dig" className="btn-primary inline-block no-underline">Start Digging</Link>
            </div>
          ) : filteredSamples.length === 0 ? (
            <div className="text-center py-12">
              <p className="profile-count mb-4">No samples match your filters.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("")
                  resetAllCrateFilters()
                }}
                className="btn-primary"
              >
                Clear filters
              </button>
            </div>
          ) : (
          <div className="pb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredSamples.map((sample) => (
                  <div
                    key={sample.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openInDig(sample)}
                    onKeyDown={(e) => e.key === "Enter" && openInDig(sample)}
                    className="profile-card cursor-pointer"
                  >
                    <div className="aspect-video w-full bg-black/10 relative group overflow-hidden">
                      <img src={sample.thumbnailUrl} alt={sample.title} className="w-full h-full object-cover" />
                      {sample.startTime && (
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-mono" style={{ fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace" }}>
                          {formatTimestamp(sample.startTime)}
                        </div>
                      )}
                      <div className="absolute top-2 right-2" onClick={(e) => { e.stopPropagation(); handleUnsave(sample.id) }}>
                        <HeartToggle isSaved={true} onToggle={() => handleUnsave(sample.id)} size="sm" className="bg-white/90 rounded-full p-1 shadow-sm" />
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition">
                          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="profile-card-title line-clamp-2">{sample.title}</h3>
                      <p className="profile-card-channel">{sample.channel}</p>
                      {(sample.genre || sample.era || sample.bpm || sample.key) && (
                        <div className="flex gap-2 flex-wrap">
                          {sample.genre && <span className="profile-tag genre">{sample.genre}</span>}
                          {sample.era && <span className="profile-tag" style={{ background: "rgba(122,122,80,0.1)", color: "var(--olive)", borderColor: "rgba(122,122,80,0.25)" }}>{sample.era}</span>}
                          {sample.bpm && <span className="profile-tag bpm">{sample.bpm} BPM</span>}
                          {sample.key && <span className="profile-tag key">{sample.key}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
          </div>
          )}

        <footer className="dig-footer mt-10 pt-8 border-t px-2 sm:px-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="footer-title text-lg font-semibold" style={{ color: "var(--foreground)" }}>Sample Roll</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>Helping you find samples that matter.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm" style={{ color: "var(--muted)" }}>
              <Link href="/dig" className="hover:text-[var(--foreground)] transition">Dig</Link>
              <Link href="/profile" className="hover:text-[var(--foreground)] transition">My Crate</Link>
              <Link href="/blog" className="hover:text-[var(--foreground)] transition">Blog</Link>
              <Link href="/login" className="hover:text-[var(--foreground)] transition">Sign in</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
