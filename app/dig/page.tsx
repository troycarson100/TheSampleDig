"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import SamplePlayer from "@/components/SamplePlayer"
import type { SavedLoopData } from "@/hooks/useChopMode"
import DiceButton from "@/components/DiceButton"
import AutoplayToggle from "@/components/AutoplayToggle"
import SavedSamplesSidebar from "@/components/SavedSamplesSidebar"
import SiteNav from "@/components/SiteNav"
import GenreSelect from "@/components/GenreSelect"
// import BeatsPanel from "@/components/BeatsPanel" // Beat loop section commented out for now

/** Genre options for the dig filter (value matches DB genre; label for display) */
const GENRE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any genre" },
  { value: "jazz", label: "Jazz" },
  { value: "soul", label: "Soul" },
  { value: "funk", label: "Funk" },
  { value: "r&b", label: "R&B" },
  { value: "hip hop", label: "Hip Hop" },
  { value: "bossa nova", label: "Bossa Nova" },
  { value: "blues", label: "Blues" },
  { value: "disco", label: "Disco" },
  { value: "reggae", label: "Reggae" },
  { value: "latin", label: "Latin" },
  { value: "prog", label: "Prog" },
  { value: "psychedelic", label: "Psychedelic" },
  { value: "afrobeat", label: "Afrobeat" },
  { value: "lounge", label: "Lounge" },
  { value: "japanese", label: "Japanese" },
  { value: "soundtrack", label: "Soundtrack" },
  { value: "folk", label: "Folk" },
  { value: "world", label: "World" },
]

/** Era options for the dig filter (value matches DB era; label for display) */
const ERA_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any era" },
  { value: "1950s", label: "50s" },
  { value: "1960s", label: "60s" },
  { value: "1970s", label: "70s" },
  { value: "1980s", label: "80s" },
  { value: "1990s", label: "90s" },
]

interface Chop {
  key: string
  time: number
  color: string
  index: number
}

interface Sample {
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
  startTime?: number
  duration?: number
  chops?: Chop[]
  loop?: SavedLoopData | null
  notes?: string | null
}

const DIG_LOAD_SAMPLE_KEY = "digLoadSample"

export default function DigPage() {
  const { data: session, status } = useSession()
  const [sample, setSample] = useState<Sample | null>(null)
  const [previousSample, setPreviousSample] = useState<Sample | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSaved, setIsSaved] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const [drumBreak, setDrumBreak] = useState(false)
  const [samplePacks, setSamplePacks] = useState(false)
  const [genreFilter, setGenreFilter] = useState("")
  const [eraFilter, setEraFilter] = useState("")
  const [sampleLoadTime, setSampleLoadTime] = useState<number | null>(null)
  const isSavedRef = useRef(isSaved)
  const sampleRef = useRef(sample)
  const sessionRef = useRef(session)

  // Load sample from My Samples page (profile): open in dig and start playing
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DIG_LOAD_SAMPLE_KEY)
      if (!raw) return
      sessionStorage.removeItem(DIG_LOAD_SAMPLE_KEY)
      const data = JSON.parse(raw) as Sample
      if (data?.youtubeId && data.youtubeId.length === 11) {
        setSample(data)
        setIsSaved(true)
        setAutoplay(true)
      }
    } catch {
      sessionStorage.removeItem(DIG_LOAD_SAMPLE_KEY)
    }
  }, [])
  
  // Keep refs in sync with state
  useEffect(() => {
    isSavedRef.current = isSaved
  }, [isSaved])
  
  useEffect(() => {
    sampleRef.current = sample
  }, [sample])
  
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // Load autoplay preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("autoplay")
    if (saved !== null) {
      setAutoplay(saved === "true")
    }
  }, [])

  // Save autoplay preference to localStorage
  useEffect(() => {
    localStorage.setItem("autoplay", autoplay.toString())
  }, [autoplay])

  // Load drum break preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("digDrumBreak")
    if (saved !== null) {
      setDrumBreak(saved === "true")
    }
  }, [])

  // Save drum break preference to localStorage
  useEffect(() => {
    localStorage.setItem("digDrumBreak", drumBreak.toString())
  }, [drumBreak])

  // Load Sample Packs preference from localStorage; clear era when loading (sample packs mostly post-1990)
  useEffect(() => {
    const saved = localStorage.getItem("digSamplePacks") ?? localStorage.getItem("digRoyaltyFree")
    if (saved !== null) {
      const val = saved === "true"
      setSamplePacks(val)
      if (val) setEraFilter("")
    }
  }, [])

  // Save Sample Packs preference to localStorage; clear era when enabling
  useEffect(() => {
    localStorage.setItem("digSamplePacks", samplePacks.toString())
    if (samplePacks) setEraFilter("")
  }, [samplePacks])

  // Load genre filter from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("digGenre")
    if (saved !== null && GENRE_OPTIONS.some((o) => o.value === saved)) {
      setGenreFilter(saved)
    }
  }, [])

  // Save genre filter to localStorage
  useEffect(() => {
    localStorage.setItem("digGenre", genreFilter)
  }, [genreFilter])

  // Load era filter from localStorage (skip if Sample Packs mode is on — era doesn't apply)
  useEffect(() => {
    if (localStorage.getItem("digSamplePacks") === "true" || localStorage.getItem("digRoyaltyFree") === "true") return
    const saved = localStorage.getItem("digEra")
    if (saved !== null && ERA_OPTIONS.some((o) => o.value === saved)) {
      setEraFilter(saved)
    }
  }, [])

  // Save era filter to localStorage
  useEffect(() => {
    localStorage.setItem("digEra", eraFilter)
  }, [eraFilter])

  // Get seen video IDs from sessionStorage
  const getSeenVideoIds = (): string[] => {
    if (typeof window === "undefined") return []
    try {
      const seen = sessionStorage.getItem("seenVideos")
      if (!seen) return []
      const ids = JSON.parse(seen) as string[]
      // Keep only last 100 to prevent sessionStorage from getting too large
      return ids.slice(-100)
    } catch {
      return []
    }
  }

  // Add video ID to seen list
  const addSeenVideo = (youtubeId: string) => {
    if (typeof window === "undefined") return
    try {
      const seen = getSeenVideoIds()
      if (!seen.includes(youtubeId)) {
        seen.push(youtubeId)
        // Keep only last 100
        const trimmed = seen.slice(-100)
        sessionStorage.setItem("seenVideos", JSON.stringify(trimmed))
      }
    } catch (error) {
      console.error("Error saving seen video:", error)
    }
  }

  const handleDig = async () => {
    // Track if this is a quick skip (user clicked Dig again within 5 seconds)
    const currentTime = Date.now()
    if (sample && sampleLoadTime && (currentTime - sampleLoadTime) < 5000) {
      // User skipped quickly - report as implicit negative feedback
      try {
        await fetch("/api/samples/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            sampleId: sample.id,
            reason: "other" // Implicit skip
          }),
        })
      } catch (error) {
        console.error("Error reporting skip:", error)
      }
    }
    
    setLoading(true)
    setError("")
    setSampleLoadTime(Date.now())
    
    try {
      // Get list of seen videos to exclude
      const excludedIds = getSeenVideoIds()
      console.log(`[Repeat Prevention] Excluding ${excludedIds.length} videos:`, excludedIds.slice(0, 5).join(", "), excludedIds.length > 5 ? "..." : "")
      
      const params = new URLSearchParams()
      if (excludedIds.length > 0) params.set("excluded", excludedIds.join(","))
      if (genreFilter.trim() !== "") params.set("genre", genreFilter.trim())
      if (!samplePacks && eraFilter.trim() !== "") params.set("era", eraFilter.trim())
      if (drumBreak) params.set("drumBreak", "1")
      if (samplePacks) params.set("samplePacks", "1")
      const url = params.toString() ? `/api/samples/dig?${params.toString()}` : "/api/samples/dig"

      const response = await fetch(url)
      const responseData = await response.json()
      
      if (!response.ok) {
        throw new Error(responseData.error || `Failed to fetch sample (${response.status})`)
      }
      
      const data = responseData
      // Drum Break mode: always start at 0:00. Otherwise smart start (avoid intro/outro).
      const END_BUFFER = 25
      let finalStartTime: number
      if (drumBreak) {
        finalStartTime = 0
        console.log(`[Dig] Drum Break mode: start at 0:00`)
      } else if (data.duration && data.duration > 0) {
        finalStartTime = Math.max(15, Math.min(Math.floor(data.duration * 0.3), data.duration - END_BUFFER))
        if (finalStartTime > data.duration - END_BUFFER) {
          finalStartTime = Math.max(15, data.duration - END_BUFFER)
        }
        finalStartTime = Math.max(15, Math.min(finalStartTime, data.duration - END_BUFFER))
        console.log(`[Dig] Final start time: ${finalStartTime} (duration: ${data.duration})`)
      } else {
        finalStartTime = Math.floor(Math.random() * 300) + 30
      }
      
      // Save current sample as previous before setting new one
      if (sample) {
        setPreviousSample(sample)
        console.log("Previous sample saved:", sample.title)
      }
      
      // Add this video to seen list IMMEDIATELY to prevent repeats (before setting sample)
      // This ensures it's excluded from the next request even if user clicks quickly
      if (data.youtubeId && data.youtubeId.length === 11) {
        addSeenVideo(data.youtubeId)
        console.log(`[Repeat Prevention] Added ${data.youtubeId} to seen list`)
      } else {
        console.warn(`[Repeat Prevention] Invalid YouTube ID: ${data.youtubeId}`)
      }
      
      // Ensure we always have youtubeId for the player (11-char ID; never use database cuid)
      const youtubeId = data.youtubeId && String(data.youtubeId).length === 11
        ? data.youtubeId
        : (data.id && String(data.id).length === 11 ? data.id : null)
      if (!youtubeId) {
        console.warn("[Dig] Response missing valid youtubeId, skipping this sample")
        handleDig()
        return
      }
      const newSample = {
        ...data,
        youtubeId,
        startTime: finalStartTime,
      }
      console.log('Sample loaded:', newSample)
      setSample(newSample)
      
      // Check if sample is already saved (only if logged in)
      if (data.id && status === "authenticated") {
        const checkResponse = await fetch(`/api/samples/check?sampleId=${data.id}`)
        if (checkResponse.ok) {
          const checkData = await checkResponse.json()
          setIsSaved(checkData.isSaved)
        }
      } else {
        setIsSaved(false)
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load sample. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Update saved status when session changes
  useEffect(() => {
    if (sample?.id && status === "authenticated") {
      fetch(`/api/samples/check?sampleId=${sample.id}`)
        .then(res => res.json())
        .then(data => setIsSaved(data.isSaved))
        .catch(() => setIsSaved(false))
    } else if (status === "unauthenticated") {
      setIsSaved(false)
    }
  }, [sample?.id, status])

  // BPM/key analysis disabled for dig — we use tap tempo only; no polling for server analysis.
  // useEffect(() => {
  //   if (sample?.id && (sample.analysisStatus === "processing" || sample.analysisStatus === "pending")) {
  //     let pollCount = 0
  //     const maxPolls = 8
  //     const pollInterval = setInterval(async () => {
  //       pollCount++
  //       if (pollCount > maxPolls) {
  //         setSample(prev => prev ? { ...prev, analysisStatus: "failed" } : null)
  //         clearInterval(pollInterval)
  //         return
  //       }
  //       try {
  //         const response = await fetch(`/api/samples/get?sampleId=${sample.id}`)
  //         if (response.ok) {
  //           const data = await response.json()
  //           if (data.analysisStatus === "completed" || data.analysisStatus === "failed" || data.bpm || data.key) {
  //             setSample(prev => prev ? { ...prev, bpm: data.bpm ?? prev.bpm, key: data.key ?? prev.key, analysisStatus: data.analysisStatus ?? prev.analysisStatus } : null)
  //             if (data.analysisStatus === "completed" || data.analysisStatus === "failed") clearInterval(pollInterval)
  //           }
  //         }
  //       } catch (error) {
  //         if (pollCount > 3) clearInterval(pollInterval)
  //       }
  //     }, 5000)
  //     return () => clearInterval(pollInterval)
  //   }
  // }, [sample?.id, sample?.analysisStatus])

  const handleGoBack = () => {
    if (previousSample) {
      // Swap current and previous samples
      const current = sample
      setSample(previousSample)
      setPreviousSample(current) // Current becomes the new previous
      
      // Check if the restored sample is saved
      if (previousSample.id && status === "authenticated") {
        fetch(`/api/samples/check?sampleId=${previousSample.id}`)
          .then(res => res.json())
          .then(data => setIsSaved(data.isSaved))
          .catch(() => setIsSaved(false))
      }
    }
  }

  // Memoize the save toggle handler to prevent unnecessary re-renders
  // Use refs to keep callback completely stable - no dependencies
  const handleSaveToggle = useCallback(async (opts?: { chops?: Chop[]; loop?: SavedLoopData | null }) => {
    const currentSample = sampleRef.current
    const currentSession = sessionRef.current
    if (!currentSession) {
      alert("Please log in to save samples.")
      return
    }
    if (!currentSample) {
      console.error("[Frontend] No current sample to save")
      return
    }
    // Save API accepts either database sample id or youtubeId for lookup
    const sampleId = currentSample.id
    const youtubeId = currentSample.youtubeId
    if (!sampleId && !youtubeId) {
      console.error("[Frontend] Sample has no id or youtubeId")
      alert("This sample can’t be saved yet. Roll the dice again to load a new one.")
      return
    }
    const currentlySaved = isSavedRef.current
    const endpoint = currentlySaved ? "/api/samples/unsave" : "/api/samples/save"
    console.log("[Frontend] Saving sample:", {
      sampleId,
      youtubeId,
      title: currentSample.title,
      channel: currentSample.channel,
      isSaved: currentlySaved,
      chopsCount: opts?.chops?.length ?? 0,
    })
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          currentlySaved
            ? { sampleId: sampleId || youtubeId }
            : {
                sampleId: sampleId || youtubeId,
                startTime: currentSample.startTime ?? Math.floor(Math.random() * 300) + 30,
                youtubeId: youtubeId,
                title: currentSample.title,
                channel: currentSample.channel,
                thumbnailUrl: currentSample.thumbnailUrl,
                chops: opts?.chops,
                loop: opts?.loop,
              }
        ),
      })

      const data = await response.json()
      console.log("[Frontend] Save response:", { status: response.status, data })

      if (response.ok) {
        setIsSaved(!currentlySaved)
        if (!currentlySaved && currentSample.youtubeId) {
          addSeenVideo(currentSample.youtubeId)
          console.log(`[Save] Added ${currentSample.youtubeId} to seen list to prevent repeats`)
        }
        // Use returned database sample id so unsave and update-chops work reliably
        if (!currentlySaved && data.sampleId && currentSample.id !== data.sampleId) {
          setSample((prev) => (prev ? { ...prev, id: data.sampleId } : null))
        }
        window.dispatchEvent(new CustomEvent("samplesUpdated"))
      } else {
        console.error("[Frontend] Save error:", data.error, "Response status:", response.status, "Full data:", data)
        const errorMsg = data.error || "Failed to save sample"
        const detailsMsg = data.details ? `\n\nDetails: ${data.details}` : ""
        const codeMsg = data.code ? `\n\nError Code: ${data.code}` : ""
        alert(`${errorMsg}${detailsMsg}${codeMsg}\n\nPlease check the console for more details.`)
      }
    } catch (error: any) {
      console.error("[Frontend] Error saving/unsaving:", error)
      alert(`Failed to save sample: ${error?.message || "Unknown error"}. Please try again.`)
    }
  }, []) // No dependencies - callback is completely stable

  // Auto-save chops and loop when sample is already saved and user edits (debounced in SamplePlayer)
  const handleSavedChopsChange = useCallback(async (chops: Chop[], loop?: SavedLoopData | null) => {
    const currentSample = sampleRef.current
    if (!currentSample?.id) return
    try {
      const res = await fetch("/api/samples/update-chops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId: currentSample.id, chops, loop: loop ?? undefined }),
      })
      if (res.ok) window.dispatchEvent(new CustomEvent("samplesUpdated"))
    } catch (e) {
      console.warn("[Dig] Failed to auto-save chops/loop:", e)
    }
  }, [])

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <div className="genre-ticker">
        <div className="ticker-track" aria-hidden>
          {/* Genres + eras for ticker; sequence repeated for seamless loop (track duplicated so -50% loops) */}
          {(() => {
            const genres = GENRE_OPTIONS.filter((o) => o.value).map((o) => o.label)
            const eras = ERA_OPTIONS.filter((o) => o.value).map((o) => o.label)
            const labels = [...genres, ...eras]
            const repeated = [...Array(8)].flatMap(() => labels)
            return (
              <>
                {repeated.flatMap((label, i) =>
                  i === 0 ? [<span key={i} className="ticker-label">{label}</span>] : [<span key={`d-${i}`} className="ticker-dot">✦</span>, <span key={i} className="ticker-label">{label}</span>]
                )}
                {repeated.flatMap((label, i) =>
                  i === 0 ? [<span key={`2-${i}`} className="ticker-label">{label}</span>] : [<span key={`2-d-${i}`} className="ticker-dot">✦</span>, <span key={`2-${i}`} className="ticker-label">{label}</span>]
                )}
              </>
            )
          })()}
        </div>
      </div>
      <div className="dig-page-wrap">
        <div className="dig-app-grid flex flex-col md:grid md:grid-cols-[1fr_280px] dig-lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="flex-1 min-w-0 dig-col lg:min-w-0 w-full max-w-4xl">
            <div className="player-area-card w-full">
            {/* Controls */}
            <div className="controls-bar w-full">
              <div className="flex flex-wrap items-center justify-center gap-4 w-full">
                {previousSample && (
                  <button
                    onClick={handleGoBack}
                    className="w-[52px] h-[52px] min-w-[52px] min-h-[52px] rounded-lg flex items-center justify-center transition hover:opacity-80"
                    style={{ background: "var(--muted-light)", color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                    aria-label="Go back to previous video"
                    title="Go back to previous video"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                )}
                <DiceButton onClick={handleDig} loading={loading} />
                <AutoplayToggle enabled={autoplay} onChange={setAutoplay} />
                <button
                  type="button"
                  onClick={() => setDrumBreak((d) => !d)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full transition"
                  style={{ background: "transparent", color: "var(--foreground)" }}
                  aria-label="Toggle drum break mode"
                >
                  <div className={`toggle-track relative w-12 h-6 rounded-full transition-colors ${drumBreak ? "opacity-100 checked" : "opacity-50"}`} style={{ background: drumBreak ? "var(--primary)" : "var(--muted)" }}>
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform bg-white shadow-sm ${drumBreak ? "translate-x-6" : "translate-x-0"}`}
                    />
                  </div>
                  <span className="toggle-label text-sm font-medium">
                    Drum Break
                  </span>
                </button>
                {/* Sample Packs toggle - commented out for now
                <button
                  type="button"
                  onClick={() => setSamplePacks((r) => !r)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full transition"
                  style={{ background: "transparent", color: "var(--foreground)" }}
                  aria-label="Toggle sample packs mode"
                >
                  <div className={`toggle-track relative w-12 h-6 rounded-full transition-colors ${samplePacks ? "opacity-100 checked" : "opacity-50"}`} style={{ background: samplePacks ? "var(--primary)" : "var(--muted)" }}>
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform bg-white shadow-sm ${samplePacks ? "translate-x-6" : "translate-x-0"}`}
                    />
                  </div>
                  <span className="toggle-label text-sm font-medium">
                    Sample Packs
                  </span>
                </button>
                */}
                <GenreSelect
                  value={genreFilter}
                  onChange={setGenreFilter}
                  options={GENRE_OPTIONS}
                  ariaLabel="Filter samples by genre"
                  className="min-w-[140px]"
                />
                <div className={samplePacks ? "opacity-50 pointer-events-none" : ""} title={samplePacks ? "Era filter disabled — sample packs are mostly from 1990s onward" : undefined}>
                  <GenreSelect
                    value={eraFilter}
                    onChange={setEraFilter}
                    options={ERA_OPTIONS}
                    ariaLabel="Filter samples by era"
                    className="min-w-[120px]"
                  />
                </div>
              </div>
            </div>

            <div className="player-card-scroll">
            {error && (
              <div className="mb-6 p-4 rounded-xl text-center border" style={{ background: "rgba(185,28,28,0.06)", borderColor: "rgba(185,28,28,0.2)", color: "#b91c1c" }}>
                {error}
              </div>
            )}

            {/* Video area - connects to controls bar (same card), track meta + chop below */}
            <div className="video-and-chop-card py-4 min-h-[280px]">
              {sample ? (
                <SamplePlayer
                  key={sample.youtubeId}
                  youtubeId={sample.youtubeId}
                  title={sample.title}
                  channel={sample.channel}
                  genre={sample.genre}
                  era={sample.era}
                  bpm={sample.bpm ?? null}
                  musicalKey={sample.key ?? null}
                  analysisStatus={sample.analysisStatus ?? null}
                  autoplay={autoplay}
                  startTime={sample.startTime}
                  duration={sample.duration}
                  isSaved={isSaved}
                  onSaveToggle={handleSaveToggle}
                  showHeart={!!session}
                  initialChops={sample.chops}
                  initialLoop={sample.loop}
                  sampleId={sample.id}
                  initialNotes={sample.notes}
                  onSavedChopsChange={session ? handleSavedChopsChange : undefined}
                  onVideoError={() => {
                    if (sample?.youtubeId) {
                      addSeenVideo(sample.youtubeId)
                    }
                    console.log("Video unavailable, fetching next sample...")
                    handleDig()
                  }}
                />
              ) : null}
            </div>
            </div>

            {/* Beat loop section commented out for now
            <BeatsPanel videoBpm={sample?.bpm ?? null} />
            */}

            </div>
          </div>

          {session && (
            <div className="samples-panel md:sticky md:top-[102px] md:self-start shrink-0 md:h-[calc(100vh-114px)] flex flex-col min-h-0 w-full md:w-auto">
              <div className="sidebar-dark flex flex-col min-h-0 overflow-hidden rounded-lg">
                <SavedSamplesSidebar
                  onSampleClick={(savedSample) => {
                    // Save current sample as previous before loading new one
                    if (sample) {
                      setPreviousSample(sample)
                    }
                    // Load the saved sample as the current sample (with saved chops and duration if any)
                    setSample({
                      id: savedSample.id,
                      youtubeId: savedSample.youtubeId,
                      title: savedSample.title,
                      channel: savedSample.channel,
                      thumbnailUrl: savedSample.thumbnailUrl,
                      genre: savedSample.genre,
                      era: savedSample.era,
                      bpm: savedSample.bpm,
                      key: savedSample.key,
                      analysisStatus: savedSample.analysisStatus,
                      startTime: savedSample.startTime,
                      duration: savedSample.duration,
                      chops: savedSample.chops,
                      loop: savedSample.loop,
                      notes: savedSample.notes,
                    })
                    setIsSaved(true)
                    // Add to seen list to prevent it from showing again when rolling dice
                    addSeenVideo(savedSample.youtubeId)
                  }}
                  currentSampleId={sample?.id}
                />
              </div>
            </div>
          )}

          </div>

        <footer className="dig-footer mt-10 pt-8 border-t px-2 sm:px-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="footer-title text-lg font-semibold" style={{ fontFamily: "var(--font-bebas), 'Bebas Neue', sans-serif", color: "var(--foreground)" }}>Sample Roll</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace" }}>Helping you find samples that matter.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace" }}>
              <a href="/dig" className="hover:text-[var(--foreground)] transition">Dig</a>
              <a href="/profile" className="hover:text-[var(--foreground)] transition">My Samples</a>
              <a href="/blog" className="hover:text-[var(--foreground)] transition">Blog</a>
              <a href="/login" className="hover:text-[var(--foreground)] transition">Login</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

