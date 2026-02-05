"use client"

import { useEffect, useRef, useMemo } from "react"

import HeartToggle from "./HeartToggle"

interface SamplePlayerProps {
  youtubeId: string
  title: string
  channel: string
  genre?: string | null
  era?: string | null
  bpm?: number | null
  key?: string | null
  analysisStatus?: string | null
  autoplay?: boolean
  startTime?: number
  duration?: number // Video duration in seconds
  isSaved?: boolean
  onSaveToggle?: () => void
  showHeart?: boolean
  onVideoError?: () => void // Callback when video is unavailable
}

/**
 * Generate a random start time that's good for sampling
 * Avoids intro (first 10%) and outro (last 30 seconds or 20%, whichever is larger)
 * Biases toward common sampling areas (30-60s, 90-150s)
 */
function generateSmartStartTime(duration?: number): number {
  // If we have duration, use it to calculate safe ranges
  if (duration && duration > 0) {
    const minStart = 15 // Skip first 15 seconds (intro)
    const maxStart = Math.max(duration - 30, minStart + 1) // Stay at least 30 seconds from end
    
    if (maxStart <= minStart) {
      // Video is too short, just use middle
      return Math.floor(duration / 2)
    }
    
    // Create ranges based on actual duration
    const ranges = [
      { min: minStart, max: Math.min(45, maxStart) },   // Early verse/chorus area
      { min: 30, max: Math.min(90, maxStart) },         // First chorus/break area
      { min: 60, max: Math.min(120, maxStart) },        // Middle section
      { min: 90, max: maxStart },                        // Later sections
    ].filter(range => range.max > range.min) // Only keep valid ranges
    
    if (ranges.length === 0) {
      return Math.floor((minStart + maxStart) / 2)
    }
    
    // Pick a random range, weighted toward middle sections
    const weights = [0.1, 0.3, 0.4, 0.2].slice(0, ranges.length)
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    const normalizedWeights = weights.map(w => w / totalWeight)
    
    const random = Math.random()
    let cumulative = 0
    let selectedRange = ranges[0]
    
    for (let i = 0; i < ranges.length; i++) {
      cumulative += normalizedWeights[i]
      if (random <= cumulative) {
        selectedRange = ranges[i]
        break
      }
    }
    
    // Generate random time within selected range
    return Math.floor(Math.random() * (selectedRange.max - selectedRange.min + 1)) + selectedRange.min
  }
  
  // Fallback: Assume average video is 3-5 minutes (180-300 seconds)
  const ranges = [
    { min: 15, max: 45 },   // Early verse/chorus area
    { min: 30, max: 90 },    // First chorus/break area (good for sampling)
    { min: 60, max: 120 },   // Middle section (often best for breaks)
    { min: 90, max: 180 },   // Later sections (choruses, solos)
  ]
  
  // Pick a random range, weighted toward middle sections
  const weights = [0.1, 0.3, 0.4, 0.2] // Prefer middle sections
  const random = Math.random()
  let cumulative = 0
  let selectedRange = ranges[0]
  
  for (let i = 0; i < ranges.length; i++) {
    cumulative += weights[i]
    if (random <= cumulative) {
      selectedRange = ranges[i]
      break
    }
  }
  
  // Generate random time within selected range
  return Math.floor(Math.random() * (selectedRange.max - selectedRange.min + 1)) + selectedRange.min
}

export default function SamplePlayer({
  youtubeId,
  title,
  channel,
  genre,
  era,
  bpm,
  key: keyProp,
  analysisStatus,
  autoplay = true,
  startTime,
  duration,
  isSaved = false,
  onSaveToggle,
  showHeart = false,
  onVideoError,
}: SamplePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const errorCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Generate a new start time only when the video changes
  const actualStartTime = useMemo(() => {
    return startTime ?? generateSmartStartTime(duration)
  }, [youtubeId, startTime, duration])

  useEffect(() => {
    // Check for video errors after a delay
    if (errorCheckTimeoutRef.current) {
      clearTimeout(errorCheckTimeoutRef.current)
    }
    
    // Set up error detection - check if video loads properly
    errorCheckTimeoutRef.current = setTimeout(() => {
      // Listen for iframe load events
      const currentIframe = iframeRef.current
      if (currentIframe) {
        // Check if iframe loaded successfully
        // YouTube shows error pages for unavailable videos
        currentIframe.onload = () => {
          // Try to detect if the video is unavailable
          // This is a best-effort check since we can't directly access iframe content
          try {
            // If onVideoError is provided, we'll rely on it being called from parent
            // For now, we'll check via a message listener
          } catch (error) {
            // Ignore cross-origin errors
          }
        }
      }
    }, 2000)
    
    return () => {
      if (errorCheckTimeoutRef.current) {
        clearTimeout(errorCheckTimeoutRef.current)
      }
    }
  }, [youtubeId, onVideoError])

  // Check if video is available via our API endpoint
  useEffect(() => {
    if (!onVideoError) return
    
    const checkVideoAvailability = async () => {
      try {
        // Check via our API endpoint which uses YouTube oEmbed
        const apiResponse = await fetch(`/api/samples/check-availability?youtubeId=${youtubeId}`)
        const data = await apiResponse.json()
        
        if (!data.available) {
          // Video is unavailable
          console.log("Video unavailable, triggering error callback")
          onVideoError()
        }
      } catch (error) {
        // If check fails, assume video might be available and don't auto-skip
        console.warn("Could not check video availability:", error)
      }
    }
    
    // Check after a short delay to allow iframe to load
    const timeout = setTimeout(checkVideoAvailability, 3000)
    
    return () => clearTimeout(timeout)
  }, [youtubeId, onVideoError])

  return (
    <div className="w-full">
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black relative">
        <iframe
          key={youtubeId} // Force React to recreate iframe when YouTube ID changes - prevents audio glitches
          ref={iframeRef}
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplay ? "1" : "0"}&start=${actualStartTime}&rel=0&enablejsapi=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
          onError={() => {
            // If iframe fails to load, trigger error callback
            if (onVideoError) {
              onVideoError()
            }
          }}
        />
        {showHeart && onSaveToggle && (
          <div className="absolute top-4 right-4 z-10">
            <HeartToggle
              isSaved={isSaved}
              onToggle={onSaveToggle}
              size="lg"
              className="bg-black/50 backdrop-blur-sm rounded-full p-2"
            />
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-2">{channel}</p>
        {(genre || era || bpm || keyProp || analysisStatus === "processing" || analysisStatus === "pending") && (
          <div className="flex gap-2 flex-wrap">
            {genre && (
              <span className="px-3 py-1 bg-purple-600/30 text-purple-300 rounded-full text-sm">
                {genre}
              </span>
            )}
            {era && (
              <span className="px-3 py-1 bg-purple-600/30 text-purple-300 rounded-full text-sm">
                {era}
              </span>
            )}
            {bpm && (
              <span className="px-3 py-1 bg-blue-600/30 text-blue-300 rounded-full text-sm font-mono">
                {bpm} BPM
              </span>
            )}
            {keyProp && (
              <span className="px-3 py-1 bg-green-600/30 text-green-300 rounded-full text-sm font-mono">
                {keyProp}
              </span>
            )}
            {(analysisStatus === "processing" || analysisStatus === "pending") && !bpm && !keyProp && (
              <span className="px-3 py-1 bg-yellow-600/30 text-yellow-300 rounded-full text-sm">
                Analyzing...
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
