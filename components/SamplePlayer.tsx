"use client"

import { useEffect, useRef, useMemo } from "react"

interface SamplePlayerProps {
  youtubeId: string
  title: string
  channel: string
  genre?: string | null
  era?: string | null
  autoplay?: boolean
  startTime?: number
  duration?: number // Video duration in seconds
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
  autoplay = true,
  startTime,
  duration,
}: SamplePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  // Generate a new start time only when the video changes
  const actualStartTime = useMemo(() => {
    return startTime ?? generateSmartStartTime(duration)
  }, [youtubeId, startTime, duration])

  useEffect(() => {
    // Update iframe src when autoplay or startTime changes
    if (iframeRef.current) {
      const autoplayParam = autoplay ? "1" : "0"
      iframeRef.current.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplayParam}&start=${actualStartTime}&rel=0&enablejsapi=1`
    }
  }, [youtubeId, autoplay, actualStartTime])

  return (
    <div className="w-full">
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <iframe
          ref={iframeRef}
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplay ? "1" : "0"}&start=${actualStartTime}&rel=0&enablejsapi=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
      <div className="mt-4">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-2">{channel}</p>
        {(genre || era) && (
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
          </div>
        )}
      </div>
    </div>
  )
}
