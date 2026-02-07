"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import SamplePlayer from "@/components/SamplePlayer"
import DiceButton from "@/components/DiceButton"
import AutoplayToggle from "@/components/AutoplayToggle"
import SavedSamplesSidebar from "@/components/SavedSamplesSidebar"
import SiteNav from "@/components/SiteNav"

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
  { value: "library", label: "Library" },
  { value: "soundtrack", label: "Soundtrack" },
  { value: "exotica", label: "Exotica" },
  { value: "folk", label: "Folk" },
  { value: "world", label: "World" },
]

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
}

export default function DigPage() {
  const { data: session, status } = useSession()
  const [sample, setSample] = useState<Sample | null>(null)
  const [previousSample, setPreviousSample] = useState<Sample | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSaved, setIsSaved] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const [genreFilter, setGenreFilter] = useState("")
  const [sampleLoadTime, setSampleLoadTime] = useState<number | null>(null)
  const isSavedRef = useRef(isSaved)
  const sampleRef = useRef(sample)
  const sessionRef = useRef(session)
  
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
      const url = params.toString() ? `/api/samples/dig?${params.toString()}` : "/api/samples/dig"

      const response = await fetch(url)
      const responseData = await response.json()
      
      if (!response.ok) {
        throw new Error(responseData.error || `Failed to fetch sample (${response.status})`)
      }
      
      const data = responseData
      // Generate a smart start time for this video
      // NEVER start within 25 seconds of the end
      const END_BUFFER = 25
      const smartStartTime = data.duration 
        ? Math.max(15, Math.min(Math.floor(data.duration * 0.3), data.duration - END_BUFFER))
        : Math.floor(Math.random() * 300) + 30
      
      // AGGRESSIVE safety check: Ensure we're NEVER within 25 seconds of the end
      let finalStartTime = smartStartTime
      if (data.duration && data.duration > 0) {
        const maxSafeStart = data.duration - END_BUFFER
        if (finalStartTime > maxSafeStart) {
          console.warn(`[Dig] Start time ${finalStartTime} too close to end (${data.duration}), adjusting to ${maxSafeStart}`)
          finalStartTime = Math.max(15, maxSafeStart) // At least 15s from start
        }
        // Double-check: if still invalid, use safe middle
        if (finalStartTime >= data.duration - END_BUFFER) {
          const safeMiddle = Math.max(15, Math.floor((data.duration - END_BUFFER) / 2))
          console.warn(`[Dig] CRITICAL: Using safe middle ${safeMiddle} for duration ${data.duration}`)
          finalStartTime = safeMiddle
        }
        // Final validation
        finalStartTime = Math.max(15, Math.min(finalStartTime, data.duration - END_BUFFER))
        console.log(`[Dig] Final start time: ${finalStartTime} (duration: ${data.duration}, safe max: ${data.duration - END_BUFFER})`)
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

  // Poll for analysis updates if status is processing or pending (with shorter timeout)
  useEffect(() => {
    if (sample?.id && (sample.analysisStatus === "processing" || sample.analysisStatus === "pending")) {
      let pollCount = 0
      const maxPolls = 8 // Stop after 8 polls (40 seconds) - analysis should complete in 30s
      
      const pollInterval = setInterval(async () => {
        pollCount++
        
        // Stop polling after max attempts
        if (pollCount > maxPolls) {
          console.warn(`[Poll] Timeout after ${pollCount} polls - marking as failed`)
          setSample(prev => prev ? {
            ...prev,
            analysisStatus: "failed"
          } : null)
          clearInterval(pollInterval)
          return
        }
        
        try {
          const response = await fetch(`/api/samples/get?sampleId=${sample.id}`)
          if (response.ok) {
            const data = await response.json()
            console.log(`[Poll ${pollCount}] Status:`, data.analysisStatus, "BPM:", data.bpm, "Key:", data.key)
            
            // Update if analysis completed or we have BPM/key data
            // Use functional update to preserve object reference when possible
            if (data.analysisStatus === "completed" || data.analysisStatus === "failed" || data.bpm || data.key) {
              setSample(prev => {
                if (!prev) return null
                // Only update if values actually changed to prevent unnecessary re-renders
                const hasChanges = (
                  prev.bpm !== data.bpm ||
                  prev.key !== data.key ||
                  prev.analysisStatus !== data.analysisStatus
                )
                if (!hasChanges) return prev // Return same reference if no changes
                return {
                  ...prev,
                  bpm: data.bpm ?? prev.bpm,
                  key: data.key ?? prev.key,
                  analysisStatus: data.analysisStatus ?? prev.analysisStatus
                }
              })
              if (data.analysisStatus === "completed" || data.analysisStatus === "failed") {
                console.log(`[Poll] Stopping - analysis ${data.analysisStatus}`)
                clearInterval(pollInterval)
              }
            }
          } else {
            console.warn(`[Poll ${pollCount}] Response not OK:`, response.status)
          }
        } catch (error) {
          console.error(`[Poll ${pollCount}] Error:`, error)
          // Stop polling on repeated errors
          if (pollCount > 3) {
            console.warn(`[Poll] Stopping after ${pollCount} errors`)
            clearInterval(pollInterval)
          }
        }
      }, 5000) // Poll every 5 seconds

      return () => clearInterval(pollInterval)
    }
  }, [sample?.id, sample?.analysisStatus])

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
  const handleSaveToggle = useCallback(async () => {
    const currentSample = sampleRef.current
    const currentSession = sessionRef.current
    if (currentSession && currentSample) {
      const currentlySaved = isSavedRef.current
      const endpoint = currentlySaved ? "/api/samples/unsave" : "/api/samples/save"
      console.log("[Frontend] Saving sample:", {
        sampleId: currentSample.id,
        youtubeId: currentSample.youtubeId,
        title: currentSample.title,
        channel: currentSample.channel,
        isSaved: currentlySaved
      })
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            sampleId: currentSample.id,
            startTime: currentSample.startTime || Math.floor(Math.random() * 300) + 30,
            youtubeId: currentSample.youtubeId,
            title: currentSample.title,
            channel: currentSample.channel,
            thumbnailUrl: currentSample.thumbnailUrl,
          }),
        })
    
        const data = await response.json()
        console.log("[Frontend] Save response:", { status: response.status, data })
    
        if (response.ok) {
          // Update state - memoized SamplePlayer will prevent iframe re-render
          setIsSaved(!currentlySaved)
          
          // CRITICAL: If saving (not unsaving), add to seen list immediately
          // This ensures saved videos never show up again in dice rolls
          if (!currentlySaved && currentSample.youtubeId) {
            addSeenVideo(currentSample.youtubeId)
            console.log(`[Save] Added ${currentSample.youtubeId} to seen list to prevent repeats`)
          }
          
          // Trigger sidebar refresh
          window.dispatchEvent(new CustomEvent('samplesUpdated'))
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
    }
  }, []) // No dependencies - callback is completely stable


  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="w-full py-1" style={{ background: "#F6F0E8" }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <SiteNav />
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            {/* Controls */}
            <div className="rounded-2xl p-4 w-full mb-4" style={{ background: "#F6F0E9" }}>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {previousSample && (
                  <button
                    onClick={handleGoBack}
                    className="rounded-[var(--radius-button)] py-3 px-4 border transition hover:opacity-80"
                    style={{ background: "var(--background)", borderColor: "var(--foreground)", color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                    aria-label="Go back to previous video"
                    title="Go back to previous video"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                )}
                <DiceButton onClick={handleDig} loading={loading} />
                <AutoplayToggle enabled={autoplay} onChange={setAutoplay} />
                <label className="flex items-center gap-2">
                  <select
                    value={genreFilter}
                    onChange={(e) => setGenreFilter(e.target.value)}
                    className="rounded-[var(--radius-button)] py-2.5 pl-3 pr-10 border text-sm min-w-[140px]"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                    aria-label="Filter samples by genre"
                  >
                    {GENRE_OPTIONS.map((opt) => (
                      <option key={opt.value || "any"} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl text-center border" style={{ background: "rgba(185,28,28,0.06)", borderColor: "rgba(185,28,28,0.2)", color: "#b91c1c" }}>
                {error}
              </div>
            )}

            {/* Video area - always visible, empty when no sample */}
            <div className="rounded-2xl p-4 min-h-[280px]" style={{ background: "#F6F0E9" }}>
              {sample ? (
                <SamplePlayer
                  key={sample.youtubeId}
                  youtubeId={sample.youtubeId}
                  title={sample.title}
                  channel={sample.channel}
                  genre={sample.genre}
                  era={sample.era}
                  bpm={sample.bpm}
                  musicalKey={sample.key}
                  analysisStatus={sample.analysisStatus}
                  autoplay={autoplay}
                  startTime={sample.startTime}
                  duration={sample.duration}
                  isSaved={isSaved}
                  onSaveToggle={handleSaveToggle}
                  showHeart={!!session}
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

          {session && (
            <div className="lg:w-72 xl:w-80 lg:sticky lg:top-8 lg:self-start shrink-0 lg:max-h-[calc(100vh-6rem)] flex flex-col min-h-0">
              <div className="rounded-2xl flex flex-col min-h-0 overflow-hidden" style={{ background: "#F6F0E9" }}>
                <SavedSamplesSidebar
                  onSampleClick={(savedSample) => {
                    // Save current sample as previous before loading new one
                    if (sample) {
                      setPreviousSample(sample)
                    }
                    // Load the saved sample as the current sample
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
                      duration: undefined,
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

        {/* Claura-style gradient strip with dot grid */}
        <div
          className="w-full mt-12 rounded-[40px] h-28 overflow-hidden relative"
          style={{ background: "linear-gradient(90deg, #e07c4a 0%, #d4a574 35%, #c9b8a8 65%, #9b9bb5 100%)" }}
        >
          <div
            className="absolute inset-0 opacity-95"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.85) 2px, transparent 2px)",
              backgroundSize: "20px 20px",
            }}
          />
        </div>

        <footer className="mt-10 pt-8 border-t px-2 sm:px-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="text-lg font-semibold" style={{ fontFamily: "var(--font-halant), Georgia, serif", color: "var(--foreground)" }}>Sample Roll</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Helping you find samples that matter.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm" style={{ color: "var(--muted)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
              <a href="/dig" className="hover:text-[var(--foreground)] transition">Dig</a>
              <a href="/profile" className="hover:text-[var(--foreground)] transition">My Samples</a>
              <a href="/login" className="hover:text-[var(--foreground)] transition">Login</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

