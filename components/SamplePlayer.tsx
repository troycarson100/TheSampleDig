"use client"

import { useEffect, useRef, useMemo, memo } from "react"

import HeartToggle from "./HeartToggle"

interface SamplePlayerProps {
  youtubeId: string
  title: string
  channel: string
  genre?: string | null
  era?: string | null
  bpm?: number | null
  musicalKey?: string | null // Renamed from 'key' to avoid React reserved prop
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

function SamplePlayer({
  youtubeId,
  title,
  channel,
  genre,
  era,
  bpm,
  musicalKey,
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
  const youtubeIdRef = useRef<string | null>(null)
  const isInitializedRef = useRef(false)
  
  // Use a ref to store the initial start time and never change it for this video
  // This prevents the iframe src from changing after initial load
  const startTimeRef = useRef<number | null>(null)
  
  // Reset and set start time when youtubeId changes
  if (youtubeIdRef.current !== youtubeId) {
    youtubeIdRef.current = youtubeId
    startTimeRef.current = startTime ?? generateSmartStartTime(duration)
    isInitializedRef.current = false // Reset initialization flag
  }
  
  const actualStartTime = startTimeRef.current ?? (startTime ?? generateSmartStartTime(duration))

  // Check if video is available via our API endpoint
  // Only check once when youtubeId changes, and only if onVideoError is provided
  // Increased delay to prevent interfering with video playback
  useEffect(() => {
    if (!onVideoError) return
    
    const checkVideoAvailability = async () => {
      try {
        // Check via our API endpoint which uses YouTube oEmbed
        const apiResponse = await fetch(`/api/samples/check-availability?youtubeId=${youtubeId}`)
        const data = await apiResponse.json()
        
        if (!data.available) {
          // Video is unavailable - only trigger callback, don't reload iframe
          console.log("Video unavailable, triggering error callback")
          onVideoError()
        }
      } catch (error) {
        // If check fails, assume video might be available and don't auto-skip
        console.warn("Could not check video availability:", error)
      }
    }
    
    // Check after a longer delay to avoid interfering with initial video load
    // Only check when youtubeId actually changes
    const timeout = setTimeout(checkVideoAvailability, 5000) // Increased from 3000 to 5000ms
    
    return () => clearTimeout(timeout)
  }, [youtubeId, onVideoError]) // Only re-run when youtubeId or onVideoError changes

  // Memoize iframe src to prevent recreation
  // Only recalculate when youtubeId changes - once set, never change src
  // Use ref to store the src so it never changes after initial load
  const iframeSrcRef = useRef<string | null>(null)
  
  // Only update src when youtubeId actually changes (not when BPM/key updates)
  if (!isInitializedRef.current || youtubeIdRef.current !== youtubeId) {
    // youtubeId changed or first render - update src
    iframeSrcRef.current = `https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplay ? "1" : "0"}&start=${actualStartTime}&rel=0&enablejsapi=1`
    isInitializedRef.current = true
  }
  
  // Always use the locked src - never change it after initial load
  const iframeSrc = iframeSrcRef.current!
  
  // CRITICAL: Use useEffect to ensure iframe src never changes after mount
  // This prevents React from updating the src attribute even if component re-renders
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe && iframeSrcRef.current) {
      // Lock the src - if it changed (shouldn't happen), restore it
      if (iframe.src !== iframeSrcRef.current && iframe.src.includes(youtubeId)) {
        // Only restore if youtubeId matches (prevents updating wrong video)
        iframe.src = iframeSrcRef.current
      }
    }
  }, [youtubeId, iframeSrc]) // Only run when youtubeId changes, not on every render
  
  // Additional safety: prevent src updates on any re-render
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe && iframeSrcRef.current && isInitializedRef.current) {
      // If src changed after initialization, restore it
      // This catches any React updates that might have changed the src
      if (iframe.src !== iframeSrcRef.current) {
        const currentSrc = iframe.src
        // Only restore if the current src is for the same video
        if (currentSrc.includes(youtubeId)) {
          iframe.src = iframeSrcRef.current
        }
      }
    }
  }) // Run on every render to catch any src changes

  // Separate the iframe from the heart toggle to prevent re-renders
  // The iframe will only re-render when youtubeId changes, not when isSaved changes
  return (
    <div className="w-full">
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black relative">
        {/* Iframe - only re-renders when youtubeId changes due to key prop */}
        {/* BPM/key updates will NOT cause this iframe to reload */}
        <iframe
          key={youtubeId} // Force React to recreate iframe when YouTube ID changes - prevents audio glitches
          ref={(el) => {
            iframeRef.current = el
            // CRITICAL: Lock the src directly on the DOM element to prevent React from updating it
            if (el && iframeSrcRef.current) {
              // Only set src if it's different (prevents reloads)
              if (el.src !== iframeSrcRef.current) {
                el.src = iframeSrcRef.current
              }
            }
          }}
          width="100%"
          height="100%"
          src={iframeSrc}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
          style={{ pointerEvents: 'auto' }} // Ensure iframe is interactive
          onError={() => {
            // If iframe fails to load, trigger error callback
            if (onVideoError) {
              onVideoError()
            }
          }}
        />
        {/* Heart toggle - positioned absolutely, won't affect iframe */}
        {showHeart && onSaveToggle && (
          <div className="absolute top-4 right-4 z-10 pointer-events-auto">
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
        {(genre || era || bpm || musicalKey || analysisStatus === "processing" || analysisStatus === "pending") && (
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
            {musicalKey && (
              <span className="px-3 py-1 bg-green-600/30 text-green-300 rounded-full text-sm font-mono">
                {musicalKey}
              </span>
            )}
            {(analysisStatus === "processing" || analysisStatus === "pending") && !bpm && !musicalKey && (
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

// Memoize the component to prevent re-renders when only metadata (BPM/key) changes
// This prevents the iframe from being recreated when BPM/key analysis completes
export default memo(SamplePlayer, (prevProps, nextProps) => {
  // CRITICAL: Only re-render if props that affect the IFRAME change
  // IGNORE bpm, key, analysisStatus changes - these should only update the display, not the iframe
  const iframePropsEqual = (
    prevProps.youtubeId === nextProps.youtubeId &&
    prevProps.autoplay === nextProps.autoplay &&
    prevProps.startTime === nextProps.startTime &&
    prevProps.duration === nextProps.duration
  )
  
  // Metadata that affects display but NOT iframe
  // These can change without reloading the iframe
  const displayMetadataEqual = (
    prevProps.title === nextProps.title &&
    prevProps.channel === nextProps.channel &&
    prevProps.genre === nextProps.genre &&
    prevProps.era === nextProps.era
    // NOTE: bpm, key, analysisStatus are intentionally NOT compared here
    // They can change without causing a re-render of the iframe
  )
  
  const otherPropsEqual = (
    prevProps.showHeart === nextProps.showHeart &&
    prevProps.onVideoError === nextProps.onVideoError
  )
  
  // onSaveToggle comparison - use reference equality
  const callbackEqual = prevProps.onSaveToggle === nextProps.onSaveToggle
  
  // Return true if props are equal (no re-render needed)
  // bpm, key, analysisStatus, and isSaved changes won't trigger iframe re-render
  // Only youtubeId, autoplay, startTime, duration changes will trigger iframe update
  return iframePropsEqual && displayMetadataEqual && otherPropsEqual && callbackEqual
})
