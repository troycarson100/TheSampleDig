"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import SamplePlayer from "@/components/SamplePlayer"
import DigButton from "@/components/DigButton"
import SaveButton from "@/components/SaveButton"
import AutoplayToggle from "@/components/AutoplayToggle"
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSaved, setIsSaved] = useState(false)
  const [autoplay, setAutoplay] = useState(true)

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
    setLoading(true)
    setError("")
    
    try {
      const response = await fetch("/api/samples/dig")
      const responseData = await response.json()
      
      if (!response.ok) {
        throw new Error(responseData.error || `Failed to fetch sample (${response.status})`)
      }
      
      const data = responseData
      setSample(data)
      
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


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-purple-900">
      <nav className="p-6 flex justify-between items-center">
        <Link href="/dig" className="text-2xl font-bold text-white">
          Sample Dig
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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Discover Rare Vinyl Samples
          </h1>
          <p className="text-gray-400 mb-8">
            Click Dig to find a random rare sample from YouTube
          </p>
          
          <div className="flex flex-col items-center gap-4">
            <DigButton onClick={handleDig} loading={loading} />
            <AutoplayToggle enabled={autoplay} onChange={setAutoplay} />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded text-red-300 text-center">
            {error}
          </div>
        )}

        {sample && (
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/20">
            <SamplePlayer
              youtubeId={sample.youtubeId}
              title={sample.title}
              channel={sample.channel}
              genre={sample.genre}
              era={sample.era}
              autoplay={autoplay}
              startTime={sample.startTime}
              duration={sample.duration}
            />
            {session && (
              <div className="mt-6 flex justify-center">
                <SaveButton
                  sampleId={sample.id}
                  isSaved={isSaved}
                  onSaveChange={setIsSaved}
                />
              </div>
            )}
          </div>
        )}

        {!sample && !loading && (
          <div className="text-center text-gray-500 mt-12">
            <p className="text-lg">Click Dig to start discovering samples!</p>
          </div>
        )}
      </main>
    </div>
  )
}
