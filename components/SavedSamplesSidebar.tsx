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
  bpm?: number | null
  key?: string | null
  analysisStatus?: string | null
  savedAt: string
  startTime?: number
  duration?: number
  chops?: { key: string; time: number; color: string; index: number }[]
  loop?: { sequence: { key: string; timeMs: number }[]; loopStartMs: number; loopEndMs: number; fullLengthMs?: number }
  notes?: string | null
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

  const SidebarHeader = ({ count }: { count: number }) => (
    <header className="samples-panel-header flex items-center justify-between w-full max-w-full box-border px-5 py-5">
      <h2 className="sidebar-title uppercase text-white text-lg tracking-widest font-normal shrink-0">
        My Samples
      </h2>
      <span className="sidebar-count text-[10px] tracking-wide text-white/60 shrink-0 tabular-nums">
        {count} saved
      </span>
    </header>
  )

  if (loading) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <SidebarHeader count={0} />
        <div className="samples-list-inner flex-1 px-4 pb-4">
          <div className="text-sm pt-4 text-white" style={{ fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace" }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (samples.length === 0) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <SidebarHeader count={0} />
        <div className="samples-list-inner flex-1 px-4 pb-4">
          <div className="text-sm text-center py-8 text-white" style={{ fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace" }}>
            No saved samples yet
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <SidebarHeader count={samples.length} />
      <div className="samples-list-inner flex-1 min-h-0 pl-5 pr-4 pb-4">
        <div>
          {samples.map((sample, index) => (
            <div key={sample.id}>
              <div
                className={`sample-card group relative cursor-pointer transition-all duration-200 ${
                  currentSampleId === sample.id ? "opacity-100" : "opacity-90 hover:opacity-100"
                }`}
                onClick={() => onSampleClick?.(sample)}
              >
                <h3 className="sample-title text-sm font-medium mb-2 line-clamp-2 text-white">
                  {sample.title}
                </h3>
                <div className="sample-thumb relative aspect-video w-full rounded-xl overflow-hidden bg-black/10">
                  <img src={sample.thumbnailUrl} alt={sample.title} className="w-full h-full object-cover" />
                  {sample.startTime && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-mono">
                      {formatTimestamp(sample.startTime)}
                    </div>
                  )}
                  <div
                    className="absolute top-2 right-2"
                    onClick={(e) => { e.stopPropagation(); handleUnsave(sample.id) }}
                  >
                    <HeartToggle isSaved={true} onToggle={() => handleUnsave(sample.id)} size="sm" className="bg-white/90 rounded-full p-1 shadow-sm" />
                  </div>
                  {(sample.genre || sample.bpm != null || sample.key) && (
                    <div className="sample-meta absolute bottom-2 left-2 right-12 flex flex-wrap gap-1">
                      {sample.genre && (
                        <span className="genre-badge bg-black/70 text-white px-1.5 py-0.5 rounded text-[10px] font-medium">
                          {sample.genre}
                        </span>
                      )}
                      {sample.bpm != null && (
                        <span className="sample-bpm bg-black/70 text-white px-1.5 py-0.5 rounded text-[10px] font-mono">
                          {sample.bpm} BPM
                        </span>
                      )}
                      {sample.key && (
                        <span className="bg-black/70 text-white px-1.5 py-0.5 rounded text-[10px] font-mono">
                          {sample.key}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {index < samples.length - 1 && (
                <div className="py-3 flex flex-col">
                  <div className="border-t w-full" style={{ borderColor: "#393734" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
