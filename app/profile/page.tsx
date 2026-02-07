"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import HeartToggle from "@/components/HeartToggle"
import SamplePlayer from "@/components/SamplePlayer"

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
}

type FilterType = "genre" | "key"

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const [samples, setSamples] = useState<SavedSample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedSample, setSelectedSample] = useState<SavedSample | null>(null)
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
        if (selectedSample?.id === sampleId) {
          setSelectedSample(null)
        }
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

  // Filter samples by active filters
  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      if (genreFilter != null && genreFilter !== "" && s.genre !== genreFilter) return false
      if (keyFilter != null && keyFilter !== "" && s.key !== keyFilter) return false
      return true
    })
  }, [samples, genreFilter, keyFilter])

  const clearFilter = (type: FilterType) => {
    if (type === "genre") setGenreFilter(null)
    if (type === "key") setKeyFilter(null)
  }

  const hasActiveFilters = genreFilter != null || keyFilter != null

  // Clear selected sample if it's no longer in the filtered list
  useEffect(() => {
    if (selectedSample && !filteredSamples.some((s) => s.id === selectedSample.id)) {
      setSelectedSample(null)
    }
  }, [filteredSamples, selectedSample])

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-black to-purple-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-purple-900">
        <nav className="p-6 flex justify-between items-center">
          <Link href="/dig" className="text-2xl font-bold text-white">
            Sample Roll
          </Link>
          <Link
            href="/login"
            className="text-purple-300 hover:text-purple-200 transition"
          >
            Login
          </Link>
        </nav>
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold text-white mb-4">
              My Saved Samples
            </h1>
            <p className="text-gray-400 text-lg mb-6">
              Please log in to view your saved samples.
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
            >
              Login
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-purple-900">
      <nav className="p-6 flex justify-between items-center">
        <Link href="/dig" className="text-2xl font-bold text-white">
          Sample Roll
        </Link>
        <div className="flex gap-4 items-center">
          <Link
            href="/dig"
            className="text-purple-300 hover:text-purple-200 transition"
          >
            Dig
          </Link>
          <Link
            href="/api/auth/signout"
            className="text-gray-400 hover:text-gray-300 transition"
          >
            Sign Out
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            My Saved Samples
          </h1>
          <p className="text-gray-400">
            {samples.length} {samples.length === 1 ? "sample" : "samples"} saved
          </p>
        </div>

        {/* Filters: dropdowns + active filter tags */}
        {samples.length > 0 && (
          <div className="mb-6 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-gray-400 text-sm font-medium">Filter:</span>
              <select
                value={genreFilter ?? ""}
                onChange={(e) => setGenreFilter(e.target.value ? e.target.value : null)}
                className="bg-black/50 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                <option value="">Genre</option>
                {genreOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <select
                value={keyFilter ?? ""}
                onChange={(e) => setKeyFilter(e.target.value ? e.target.value : null)}
                className="bg-black/50 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                <option value="">Key</option>
                {keyOptions.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500 text-sm">Active:</span>
                {genreFilter != null && genreFilter !== "" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/40 text-purple-200 rounded-full text-sm">
                    {genreFilter}
                    <button
                      type="button"
                      onClick={() => clearFilter("genre")}
                      className="hover:bg-purple-500/50 rounded-full p-0.5 transition"
                      aria-label="Remove genre filter"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                )}
                {keyFilter != null && keyFilter !== "" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600/40 text-green-200 rounded-full text-sm font-mono">
                    {keyFilter}
                    <button
                      type="button"
                      onClick={() => clearFilter("key")}
                      className="hover:bg-green-500/50 rounded-full p-0.5 transition"
                      aria-label="Remove key filter"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                )}
              </div>
            )}
            {hasActiveFilters && (
              <p className="text-gray-500 text-sm">
                Showing {filteredSamples.length} of {samples.length} samples
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded text-red-300">
            {error}
          </div>
        )}

        {samples.length === 0 && !loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-4">
              You haven't saved any samples yet.
            </p>
            <Link
              href="/dig"
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
            >
              Start Digging
            </Link>
          </div>
        ) : filteredSamples.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-4">
              No samples match your filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setGenreFilter(null)
                setKeyFilter(null)
              }}
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Video Player Section - Takes up 2 columns on large screens */}
            {selectedSample ? (
              <div className="lg:col-span-2">
                <div className="sticky top-8">
                  <SamplePlayer
                    youtubeId={selectedSample.youtubeId}
                    title={selectedSample.title}
                    channel={selectedSample.channel}
                    genre={selectedSample.genre}
                    era={selectedSample.era}
                    bpm={selectedSample.bpm}
                        musicalKey={selectedSample.key}
                    analysisStatus={selectedSample.analysisStatus}
                    autoplay={true}
                    startTime={selectedSample.startTime}
                    isSaved={true}
                    onSaveToggle={() => handleUnsave(selectedSample.id)}
                    showHeart={true}
                  />
                </div>
              </div>
            ) : (
              <div className="lg:col-span-2 flex items-center justify-center bg-black/30 rounded-lg border border-purple-500/20 min-h-[400px]">
                <div className="text-center">
                  <p className="text-gray-400 text-lg mb-2">Select a sample to play</p>
                  <p className="text-gray-500 text-sm">Click on any sample card to start listening</p>
                </div>
              </div>
            )}

            {/* Samples Grid - Takes up 2 columns on large screens */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSamples.map((sample) => (
                  <div
                    key={sample.id}
                    className={`bg-black/50 backdrop-blur-sm rounded-lg overflow-hidden border transition-all cursor-pointer ${
                      selectedSample?.id === sample.id
                        ? "border-purple-500 ring-2 ring-purple-500/50"
                        : "border-purple-500/20 hover:border-purple-500/40"
                    }`}
                    onClick={() => setSelectedSample(sample)}
                  >
                    <div className="aspect-video w-full bg-black relative group">
                      <img
                        src={sample.thumbnailUrl}
                        alt={sample.title}
                        className="w-full h-full object-cover"
                      />
                      {/* Timestamp overlay */}
                      {sample.startTime && (
                        <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-mono">
                          {formatTimestamp(sample.startTime)}
                        </div>
                      )}
                      {/* Heart toggle */}
                      <div
                        className="absolute top-2 right-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnsave(sample.id)
                        }}
                      >
                        <HeartToggle
                          isSaved={true}
                          onToggle={() => handleUnsave(sample.id)}
                          size="sm"
                          className="bg-black/50 backdrop-blur-sm rounded-full p-1"
                        />
                      </div>
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition">
                          <svg
                            className="w-12 h-12 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-white font-semibold mb-1 line-clamp-2 text-sm">
                        {sample.title}
                      </h3>
                      <p className="text-gray-400 text-xs mb-2">{sample.channel}</p>
                      {(sample.genre || sample.era || sample.bpm || sample.key) && (
                        <div className="flex gap-2 flex-wrap">
                          {sample.genre && (
                            <span className="px-2 py-1 bg-purple-600/30 text-purple-300 rounded text-xs">
                              {sample.genre}
                            </span>
                          )}
                          {sample.era && (
                            <span className="px-2 py-1 bg-purple-600/30 text-purple-300 rounded text-xs">
                              {sample.era}
                            </span>
                          )}
                          {sample.bpm && (
                            <span className="px-2 py-1 bg-blue-600/30 text-blue-300 rounded text-xs font-mono">
                              {sample.bpm} BPM
                            </span>
                          )}
                          {sample.key && (
                            <span className="px-2 py-1 bg-green-600/30 text-green-300 rounded text-xs font-mono">
                              {sample.key}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
