"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import HeartToggle from "./HeartToggle"

interface SavedSample {
  id: string
  youtubeId: string
  title: string
  channel: string
  thumbnailUrl: string
  genre?: string | null
  era?: string | null
  savedAt: string
  startTime?: number
}

interface SavedSamplesSidebarProps {
  onSampleClick?: (sample: SavedSample) => void
  currentSampleId?: string
}

export default function SavedSamplesSidebar({
  onSampleClick,
  currentSampleId,
}: SavedSamplesSidebarProps) {
  const { data: session } = useSession()
  const [samples, setSamples] = useState<SavedSample[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) {
      fetchSavedSamples()
    } else {
      setSamples([])
      setLoading(false)
    }
  }, [session])

  // Listen for sample updates
  useEffect(() => {
    const handleUpdate = () => {
      if (session) {
        fetchSavedSamples()
      }
    }
    window.addEventListener('samplesUpdated', handleUpdate)
    return () => window.removeEventListener('samplesUpdated', handleUpdate)
  }, [session])

  const fetchSavedSamples = async () => {
    try {
      const response = await fetch("/api/samples/saved")
      if (response.ok) {
        const data = await response.json()
        setSamples(data)
      }
    } catch (error) {
      console.error("Error fetching saved samples:", error)
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
        // Notify other components
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

  if (!session) {
    return null
  }

  if (loading) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold text-white mb-4">My Samples</h2>
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (samples.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold text-white mb-4">My Samples</h2>
        <div className="text-gray-400 text-sm text-center py-8">
          No saved samples yet
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-bold text-white mb-4 px-4 pt-4">My Samples</h2>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-4">
          {samples.map((sample, index) => (
            <div key={sample.id}>
              <div
                className={`group relative cursor-pointer transition-all duration-200 ${
                  currentSampleId === sample.id
                    ? "opacity-100"
                    : "opacity-90 hover:opacity-100"
                }`}
                onClick={() => onSampleClick?.(sample)}
              >
                {/* Title above thumbnail */}
                <h3 className="text-white text-sm font-medium mb-2 line-clamp-2">
                  {sample.title}
                </h3>
                {/* Thumbnail with timestamp overlay */}
                <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black">
                  <img
                    src={sample.thumbnailUrl}
                    alt={sample.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Timestamp overlay at bottom */}
                  {sample.startTime && (
                    <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-mono">
                      {formatTimestamp(sample.startTime)}
                    </div>
                  )}
                  {/* Heart toggle overlay at top right - always visible for saved samples */}
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
                </div>
              </div>
              {/* Divider line */}
              {index < samples.length - 1 && (
                <div className="border-t border-purple-500/20 my-4"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
