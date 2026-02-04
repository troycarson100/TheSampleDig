"use client"

import { useState, useEffect } from "react"
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
      setSample({
        ...data,
        startTime: smartStartTime,
      })
      
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
                  youtubeId={sample.youtubeId}
                  title={sample.title}
                  channel={sample.channel}
                  genre={sample.genre}
                  era={sample.era}
                  autoplay={autoplay}
                  startTime={sample.startTime}
                  duration={sample.duration}
                  isSaved={isSaved}
                  onSaveToggle={async () => {
                    if (session && sample) {
                      const endpoint = isSaved ? "/api/samples/unsave" : "/api/samples/save"
                      try {
                        const response = await fetch(endpoint, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ 
                            sampleId: sample.id,
                            startTime: sample.startTime || Math.floor(Math.random() * 300) + 30 // Use current startTime or generate one
                          }),
                        })
                        
                        const data = await response.json()
                        
                        if (response.ok) {
                          setIsSaved(!isSaved)
                          // Trigger sidebar refresh by dispatching a custom event
                          window.dispatchEvent(new CustomEvent('samplesUpdated'))
                        } else {
                          // Show error to user
                          console.error("Save error:", data.error)
                          alert(data.error || "Failed to save sample. Please try again.")
                        }
                      } catch (error) {
                        console.error("Error saving/unsaving:", error)
                        alert("Failed to save sample. Please try again.")
                      }
                    }
                  }}
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
