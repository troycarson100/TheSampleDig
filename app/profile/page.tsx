"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import HeartToggle from "@/components/HeartToggle"
import SiteNav from "@/components/SiteNav"

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
  savedAt: string
  startTime?: number
  duration?: number
  chops?: { key: string; time: number; color: string; index: number }[]
  loop?: { sequence: { key: string; timeMs: number }[]; loopStartMs: number; loopEndMs: number; fullLengthMs?: number }
}

type FilterType = "genre" | "key"

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [samples, setSamples] = useState<SavedSample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [genreFilter, setGenreFilter] = useState<string | null>(null)
  const [keyFilter, setKeyFilter] = useState<string | null>(null)

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

  // Filter samples by search (title, bpm, key, genre) and dropdown filters
  const filteredSamples = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return samples.filter((s) => {
      if (q) {
        const titleMatch = s.title?.toLowerCase().includes(q)
        const genreMatch = s.genre?.toLowerCase().includes(q)
        const keyMatch = s.key?.toLowerCase().includes(q)
        const bpmMatch = s.bpm != null && String(s.bpm).includes(q)
        if (!titleMatch && !genreMatch && !keyMatch && !bpmMatch) return false
      }
      if (genreFilter != null && genreFilter !== "" && s.genre !== genreFilter) return false
      if (keyFilter != null && keyFilter !== "" && s.key !== keyFilter) return false
      return true
    })
  }, [samples, searchQuery, genreFilter, keyFilter])

  const clearFilter = (type: FilterType) => {
    if (type === "genre") setGenreFilter(null)
    if (type === "key") setKeyFilter(null)
  }

  const hasActiveFilters = searchQuery.trim() !== "" || genreFilter != null || keyFilter != null

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
        })
      )
      router.push("/dig")
    } catch (e) {
      console.warn("Failed to store sample for dig", e)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-xl" style={{ color: "var(--muted)" }}>Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen" style={{ background: "var(--background)" }}>
        <header className="w-full py-2" style={{ background: "#F6F0E8" }}>
          <div className="max-w-6xl mx-auto px-3 sm:px-4">
            <SiteNav />
          </div>
        </header>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="flex flex-col items-center justify-center text-center py-16">
            <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-halant), Georgia, serif" }}>My Saved Samples</h1>
            <p className="text-lg mb-6" style={{ color: "var(--muted)" }}>Please log in to view your saved samples.</p>
            <Link href="/login" className="inline-block px-5 py-2.5 rounded-[var(--radius-button)] font-medium text-white transition opacity-90 hover:opacity-100" style={{ background: "var(--primary)" }}>Login</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="w-full py-2" style={{ background: "#F6F0E8" }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <SiteNav />
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="pt-2 pb-4">
          <h1 className="text-3xl sm:text-4xl font-semibold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-halant), Georgia, serif" }}>My Saved Samples</h1>
            <p className="text-[15px]" style={{ color: "var(--muted)" }}>{samples.length} {samples.length === 1 ? "sample" : "samples"} saved</p>
          </div>

          {samples.length > 0 && (
            <div className="mb-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  placeholder="Search by title, BPM, key or genre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-[200px] rounded-full border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ background: "var(--muted-light)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  aria-label="Search samples by title, BPM, key or genre"
                />
                <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>Filter:</span>
                <select
                  value={genreFilter ?? ""}
                  onChange={(e) => setGenreFilter(e.target.value ? e.target.value : null)}
                  className="rounded-full border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ background: "var(--muted-light)", borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                <option value="">Genre</option>
                {genreOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <select
                value={keyFilter ?? ""}
                onChange={(e) => setKeyFilter(e.target.value ? e.target.value : null)}
                className="rounded-full border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-offset-1"
                style={{ background: "var(--muted-light)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <option value="">Key</option>
                {keyOptions.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm" style={{ color: "var(--muted)" }}>Active:</span>
                {searchQuery.trim() !== "" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm" style={{ background: "var(--muted-light)", color: "var(--foreground)" }}>
                    Search: {searchQuery.trim()}
                    <button type="button" onClick={() => setSearchQuery("")} className="rounded-full p-0.5 hover:opacity-70 transition" aria-label="Clear search">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                )}
                {genreFilter != null && genreFilter !== "" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm" style={{ background: "var(--muted-light)", color: "var(--foreground)" }}>
                    {genreFilter}
                    <button type="button" onClick={() => clearFilter("genre")} className="rounded-full p-0.5 hover:opacity-70 transition" aria-label="Remove genre filter">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                )}
                {keyFilter != null && keyFilter !== "" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono" style={{ background: "var(--muted-light)", color: "var(--foreground)" }}>
                    {keyFilter}
                    <button type="button" onClick={() => clearFilter("key")} className="rounded-full p-0.5 hover:opacity-70 transition" aria-label="Remove key filter">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                )}
              </div>
            )}
            {hasActiveFilters && (
              <p className="text-sm" style={{ color: "var(--muted)" }}>Showing {filteredSamples.length} of {samples.length} samples</p>
            )}
          </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl border" style={{ background: "rgba(185,28,28,0.06)", borderColor: "rgba(185,28,28,0.2)", color: "#b91c1c" }}>{error}</div>
          )}

          {samples.length === 0 && !loading ? (
            <div className="text-center py-12">
              <p className="text-lg mb-4" style={{ color: "var(--muted)" }}>You haven't saved any samples yet.</p>
              <Link href="/dig" className="inline-block px-5 py-2.5 rounded-[var(--radius-button)] font-medium text-white transition opacity-90 hover:opacity-100" style={{ background: "var(--primary)" }}>Start Digging</Link>
            </div>
          ) : filteredSamples.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg mb-4" style={{ color: "var(--muted)" }}>No samples match your filters.</p>
              <button type="button" onClick={() => { setSearchQuery(""); setGenreFilter(null); setKeyFilter(null) }} className="inline-block px-5 py-2.5 rounded-[var(--radius-button)] font-medium text-white transition opacity-90 hover:opacity-100" style={{ background: "var(--primary)" }}>Clear filters</button>
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
                    className="rounded-2xl overflow-hidden border transition-all cursor-pointer hover:border-[var(--primary)]/40"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div className="aspect-video w-full bg-black/10 relative group">
                      <img src={sample.thumbnailUrl} alt={sample.title} className="w-full h-full object-cover" />
                      {sample.startTime && (
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-mono">
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
                      <h3 className="font-semibold mb-1 line-clamp-2 text-sm" style={{ color: "var(--foreground)" }}>{sample.title}</h3>
                      <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{sample.channel}</p>
                      {(sample.genre || sample.era || sample.bpm || sample.key) && (
                        <div className="flex gap-2 flex-wrap">
                          {sample.genre && <span className="px-2 py-1 rounded-full text-xs" style={{ background: "var(--muted-light)", color: "var(--foreground)" }}>{sample.genre}</span>}
                          {sample.era && <span className="px-2 py-1 rounded-full text-xs" style={{ background: "var(--muted-light)", color: "var(--foreground)" }}>{sample.era}</span>}
                          {sample.bpm && <span className="px-2 py-1 rounded-full text-xs font-mono" style={{ background: "var(--muted-light)", color: "var(--foreground)" }}>{sample.bpm} BPM</span>}
                          {sample.key && <span className="px-2 py-1 rounded-full text-xs font-mono" style={{ background: "var(--muted-light)", color: "var(--foreground)" }}>{sample.key}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
          </div>
          )}

        <footer className="mt-10 pt-8 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="text-lg font-semibold" style={{ fontFamily: "var(--font-halant), Georgia, serif", color: "var(--foreground)" }}>Sample Roll</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Helping you find samples that matter.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm" style={{ color: "var(--muted)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
              <Link href="/dig" className="hover:text-[var(--foreground)] transition">Dig</Link>
              <Link href="/profile" className="hover:text-[var(--foreground)] transition">My Samples</Link>
              <Link href="/blog" className="hover:text-[var(--foreground)] transition">Blog</Link>
              <Link href="/login" className="hover:text-[var(--foreground)] transition">Login</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
