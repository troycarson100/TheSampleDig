"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import SamplePlayer from "@/components/SamplePlayer"
import DiceButton from "@/components/DiceButton"
import AutoplayToggle from "@/components/AutoplayToggle"
import SavedSamplesSidebar from "@/components/SavedSamplesSidebar"
import Link from "next/link"

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
      const response = await fetch("/api/samples/dig")
      const responseData = await response.json()
      
      if (!response.ok) {
        throw new Error(responseData.error || `Failed to fetch sample (${response.status})`)
      }
      
      const data = responseData
      // Generate a smart start time for this video
      const smartStartTime = data.duration 
        ? Math.max(15, Math.min(Math.floor(data.duration * 0.3), data.duration - 30))
        : Math.floor(Math.random() * 300) + 30
      
      // Save current sample as previous before setting new one
      if (sample) {
        setPreviousSample(sample)
        console.log("Previous sample saved:", sample.title)
      }
      
      // Set the new sample
      const newSample = {
        ...data,
        startTime: smartStartTime,
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-purple-900">
      <nav className="p-6 flex justify-between items-center">
        <Link href="/dig" className="text-2xl font-bold text-white">
          Sample Roll
        </Link>
        <div className="flex gap-4 items-center">
          {session ? (
            <>
              <Link
                href="/profile"
                className="text-purple-300 hover:text-purple-200 transition"
              >
                My Samples
              </Link>
              <Link
                href="/api/auth/signout"
                className="text-gray-400 hover:text-gray-300 transition"
              >
                Sign Out
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="text-purple-300 hover:text-purple-200 transition"
            >
              Login
            </Link>
          )}
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content area */}
          <div className="flex-1 max-w-4xl">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">
                Discover Rare Vinyl Samples
              </h1>
              <p className="text-gray-400 mb-8">
                Click Dig to find a random rare sample from YouTube
              </p>
              
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-4">
                  {previousSample && (
                    <button
                      onClick={handleGoBack}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 border-2 border-white/30"
                      aria-label="Go back to previous video"
                      title="Go back to previous video"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                  )}
                  <DiceButton onClick={handleDig} loading={loading} />
                </div>
                <AutoplayToggle enabled={autoplay} onChange={setAutoplay} />
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded text-red-300 text-center">
                {error}
              </div>
            )}

            {sample && (
              <div className="bg-black/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/20 relative">
                <SamplePlayer
                  key={sample.youtubeId} // Key based on YouTube ID to prevent remounts when only isSaved changes
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
                    // Video is unavailable, automatically get next one
                    console.log("Video unavailable, fetching next sample...")
                    handleDig()
                  }}
                />
              </div>
            )}

            {!sample && !loading && (
              <div className="text-center text-gray-500 mt-12">
                <p className="text-lg">Click Dig to start discovering samples!</p>
              </div>
            )}
          </div>

          {/* Saved samples sidebar */}
          {session && (
            <div className="lg:w-80 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)]">
              <div className="bg-black/50 backdrop-blur-sm rounded-lg border border-purple-500/20 h-full flex flex-col">
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
                  }}
                  currentSampleId={sample?.id}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
