"use client"

import { useEffect, useRef, useMemo, memo, useState, useCallback } from "react"

import HeartToggle from "./HeartToggle"
import ChopPads from "./ChopPads"
import ChopTimelineMarkers from "./ChopTimelineMarkers"
import { useChopMode } from "@/hooks/useChopMode"
import { loadYouTubeIframeAPI, createAdapterFromIframe } from "@/lib/youtube-player-adapter"
import type { YouTubePlayerAdapter, Chop } from "@/hooks/useChopMode"

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
  /** Called when user toggles save. When saving (not unsaving), opts.chops are the active Chop Mode points to store. */
  onSaveToggle?: (opts?: { chops?: Chop[] }) => void
  showHeart?: boolean
  /** Restore saved chops when loading a saved sample. */
  initialChops?: Chop[] | null
  /** When sample is saved, called (debounced) when chops change so parent can persist them. */
  onSavedChopsChange?: (chops: Chop[]) => void
  onVideoError?: () => void // Callback when video is unavailable
}

/**
 * Generate a random start time that's good for sampling
 * Avoids intro (first 15 seconds) and outro (last 20 seconds minimum)
 * Biases toward common sampling areas (30-60s, 90-150s)
 */
function generateSmartStartTime(duration?: number): number {
  const END_BUFFER = 25 // NEVER start within 25 seconds of the end
  
  // If we have duration, use it to calculate safe ranges
  if (duration && duration > 0) {
    const minStart = 15 // Skip first 15 seconds (intro)
    const maxStart = Math.max(duration - END_BUFFER, minStart + 1) // Stay at least 25 seconds from end
    
    if (maxStart <= minStart) {
      // Video is too short, use middle but ensure we're at least 25 seconds from end
      const middleTime = Math.floor(duration / 2)
      return Math.min(middleTime, duration - END_BUFFER)
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
    const randomTime = Math.floor(Math.random() * (selectedRange.max - selectedRange.min + 1)) + selectedRange.min
    
    // Final safety check: Ensure we're NEVER within 25 seconds of the end
    const safeTime = Math.min(randomTime, duration - END_BUFFER)
    
    // Double-check: If somehow we're still too close, use a safe fallback
    if (safeTime > duration - END_BUFFER) {
      console.warn(`[StartTime] Generated time ${safeTime} too close to end (${duration}), using ${duration - END_BUFFER}`)
      return duration - END_BUFFER
    }
    
    return safeTime
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
  initialChops,
  onSavedChopsChange,
}: SamplePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const youtubeIdRef = useRef<string | null>(null)
  const isInitializedRef = useRef(false)
  const adapterRef = useRef<YouTubePlayerAdapter | null>(null)
  const [chopModeEnabled, setChopModeEnabled] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const chopKeysFocusTrapRef = useRef<HTMLDivElement>(null)
  const onAfterChopPlay = useCallback(() => {
    chopKeysFocusTrapRef.current?.focus()
  }, [])
  const { chops, clearChops, removeChop, addChop, slotsFull, onPadKeyPress, updateChopTime, pressedKey } = useChopMode(
    adapterRef,
    chopModeEnabled,
    youtubeId,
    initialChops,
    onAfterChopPlay
  )

  // Auto-save chops when sample is already saved and chops change (debounced)
  const SAVED_CHOPS_DEBOUNCE_MS = 600
  useEffect(() => {
    if (!isSaved || !onSavedChopsChange) return
    const t = setTimeout(() => {
      onSavedChopsChange(chops)
    }, SAVED_CHOPS_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [isSaved, chops, onSavedChopsChange])
  
  // Use a ref to store the initial start time and never change it for this video
  // This prevents the iframe src from changing after initial load
  const startTimeRef = useRef<number | null>(null)
  
  // NEVER start within 25 seconds of the end
  const END_BUFFER = 25
  
  // Reset and set start time when youtubeId changes
  if (youtubeIdRef.current !== youtubeId) {
    youtubeIdRef.current = youtubeId
    const generatedTime = startTime ?? generateSmartStartTime(duration)
    // Final safety check: Ensure generated time is never within 25 seconds of end
    if (duration && generatedTime > duration - END_BUFFER) {
      console.warn(`[SamplePlayer] Generated start time ${generatedTime} too close to end (${duration}), using ${duration - END_BUFFER}`)
      startTimeRef.current = duration - END_BUFFER
    } else {
      startTimeRef.current = generatedTime
    }
    isInitializedRef.current = false // Reset initialization flag
  }
  
  const baseStartTime = startTimeRef.current ?? (startTime ?? generateSmartStartTime(duration))
  
  // AGGRESSIVE safety check: NEVER start within 25 seconds of end
  // If duration is available, enforce strict limits
  let actualStartTime = baseStartTime
  if (duration && duration > 0) {
    const maxSafeStart = duration - END_BUFFER
    if (actualStartTime > maxSafeStart) {
      console.warn(`[SamplePlayer] Start time ${actualStartTime} too close to end (${duration}), clamping to ${maxSafeStart}`)
      actualStartTime = Math.max(15, maxSafeStart) // At least 15s from start, 25s from end
    }
    // Double-check: if still invalid, use safe middle
    if (actualStartTime >= duration - END_BUFFER) {
      const safeMiddle = Math.max(15, Math.floor((duration - END_BUFFER) / 2))
      console.warn(`[SamplePlayer] CRITICAL: Using safe middle ${safeMiddle} for duration ${duration}`)
      actualStartTime = safeMiddle
    }
    // Final validation: ensure it's within bounds
    actualStartTime = Math.max(15, Math.min(actualStartTime, duration - END_BUFFER))
  }

  // Reset iframeLoaded when video changes so we wait for the new iframe to load
  useEffect(() => {
    setIframeLoaded(false)
  }, [youtubeId])

  // YouTube IFrame API: create player adapter only after iframe has loaded so getCurrentTime() returns real time
  const validYoutubeIdForAdapter = youtubeId && String(youtubeId).length === 11
  useEffect(() => {
    if (!validYoutubeIdForAdapter || !iframeLoaded || !iframeRef.current) return
    let teardown: (() => void) | undefined
    loadYouTubeIframeAPI().then(() => {
      if (!iframeRef.current) return
      teardown = createAdapterFromIframe(iframeRef.current, (adapter) => {
        adapterRef.current = adapter
      })
    })
    return () => {
      adapterRef.current = null
      teardown?.()
    }
  }, [youtubeId, validYoutubeIdForAdapter, iframeLoaded])

  // Check if video is available via our API endpoint
  // Only when we have a valid 11-char YouTube ID and onVideoError is provided
  const validYoutubeIdForCheck = youtubeId && String(youtubeId).length === 11
  useEffect(() => {
    if (!onVideoError || !validYoutubeIdForCheck) return
    
    const checkVideoAvailability = async () => {
      try {
        const apiResponse = await fetch(`/api/samples/check-availability?youtubeId=${youtubeId}`)
        const data = await apiResponse.json()
        
        if (!data.available) {
          console.log("Video unavailable, triggering error callback")
          onVideoError()
        }
      } catch (error) {
        console.warn("Could not check video availability:", error)
      }
    }
    
    const timeout = setTimeout(checkVideoAvailability, 5000)
    return () => clearTimeout(timeout)
  }, [youtubeId, onVideoError, validYoutubeIdForCheck])

  // Memoize iframe src to prevent recreation
  // Only recalculate when youtubeId changes - once set, never change src
  // Use ref to store the src so it never changes after initial load
  const iframeSrcRef = useRef<string | null>(null)
  
  // CRITICAL: Final check before creating iframe URL - ensure start time is safe
  // If duration is available, enforce 25-second buffer
  let safeStartTime = actualStartTime
  if (duration && duration > 0) {
    const maxSafeStart = duration - 25
    if (safeStartTime > maxSafeStart) {
      console.warn(`[SamplePlayer] CRITICAL: Start time ${safeStartTime} exceeds safe limit (${maxSafeStart}), clamping to ${maxSafeStart}`)
      safeStartTime = Math.max(15, maxSafeStart) // Ensure at least 15 seconds from start
    }
    // Double-check: if somehow still too close, use middle of safe range
    if (safeStartTime > duration - 25) {
      safeStartTime = Math.max(15, Math.floor((duration - 25) / 2))
      console.warn(`[SamplePlayer] CRITICAL FIX: Using fallback start time ${safeStartTime} for duration ${duration}`)
    }
    // Final validation: ensure it's within bounds
    safeStartTime = Math.max(15, Math.min(safeStartTime, duration - 25))
  }
  
  // Only update src when youtubeId actually changes (not when BPM/key updates)
  const validYoutubeId = youtubeId && String(youtubeId).length === 11
  if (!isInitializedRef.current || youtubeIdRef.current !== youtubeId) {
    // youtubeId changed or first render - update src with SAFE start time
    // Use youtube.com embed (more reliable than nocookie for playback)
    iframeSrcRef.current = validYoutubeId
      ? `https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplay ? "1" : "0"}&start=${safeStartTime}&rel=0&enablejsapi=1`
      : ""
    isInitializedRef.current = true
    console.log(`[SamplePlayer] Set iframe start time: ${safeStartTime} (duration: ${duration || 'unknown'}, safe max: ${duration ? duration - 25 : 'N/A'})`)
  }
  
  // Always use the locked src - never change it after initial load
  const iframeSrc = iframeSrcRef.current ?? ""

  // If we have an invalid YouTube ID (e.g. DB id passed by mistake), ask for next sample once
  const invalidIdReportedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!validYoutubeId && onVideoError && youtubeId && invalidIdReportedRef.current !== youtubeId) {
      invalidIdReportedRef.current = youtubeId
      onVideoError()
    }
  }, [validYoutubeId, onVideoError, youtubeId])

  // CRITICAL: Validate iframe src start parameter matches safe start time
  useEffect(() => {
    if (iframeRef.current && duration && duration > 0 && iframeSrc) {
      const urlParams = new URLSearchParams(iframeRef.current.src.split('?')[1])
      const startParam = parseInt(urlParams.get('start') || '0', 10)
      const maxSafeStart = duration - 25
      if (startParam > maxSafeStart) {
        console.error(`[SamplePlayer] CRITICAL: Iframe src has invalid start time ${startParam} (max safe: ${maxSafeStart})`)
        // Force update with correct start time
        const correctedSrc = iframeSrc.replace(/start=\d+/, `start=${maxSafeStart}`)
        iframeRef.current.src = correctedSrc
        iframeSrcRef.current = correctedSrc
        console.log(`[SamplePlayer] Corrected iframe src start time to ${maxSafeStart}`)
      }
    }
  }, [iframeSrc, duration])
  
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
        {validYoutubeId && iframeSrc ? (
          <>
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
              onLoad={() => setIframeLoaded(true)}
              onError={() => {
                // If iframe fails to load, trigger error callback
                if (onVideoError) {
                  onVideoError()
                }
              }}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center rounded-lg" style={{ background: "var(--muted-light)", color: "var(--muted)" }}>
            <p>Invalid video ID — loading next sample...</p>
          </div>
        )}
        {/* Heart toggle - positioned absolutely, won't affect iframe */}
        {showHeart && onSaveToggle && (
          <div className="absolute top-4 right-4 z-10 pointer-events-auto">
            <HeartToggle
              isSaved={isSaved}
              onToggle={() => onSaveToggle(isSaved ? undefined : { chops: chops.length > 0 ? chops : undefined })}
              size="lg"
              className="rounded-full p-2 shadow-sm"
              style={{ background: "var(--card)" }}
            />
          </div>
        )}
        {/* Chop Mode: timeline markers at playhead positions (draggable) */}
        {chopModeEnabled && chops.length > 0 && duration != null && duration > 0 && (
          <ChopTimelineMarkers
            chops={chops}
            duration={duration}
            onUpdateChopTime={updateChopTime}
            onRemoveChop={removeChop}
            pressedKey={pressedKey}
          />
        )}
      </div>

      {/* Chop Mode: focus trap so chop keys (A–L) work after playing from iframe; clicking this area refocuses the page */}
      <div
        className="mt-4 flex flex-col gap-3"
        onMouseDown={() => chopKeysFocusTrapRef.current?.focus()}
      >
        <div
          ref={chopKeysFocusTrapRef}
          tabIndex={-1}
          className="sr-only"
          aria-label="Focus for chop keys"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Chop Mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={chopModeEnabled}
              onClick={() => setChopModeEnabled((v) => !v)}
              className="relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1"
              style={{
                background: chopModeEnabled ? "var(--primary)" : "var(--muted-light)",
              }}
            >
              <span
                className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                style={{ transform: chopModeEnabled ? "translateX(1.25rem)" : "translateX(0)" }}
              />
            </button>
          </label>
          {chopModeEnabled && (
            <>
              <button
                type="button"
                onClick={clearChops}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border transition hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={addChop}
                disabled={slotsFull}
                className="md:hidden text-sm font-medium px-3 py-1.5 rounded-lg border transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)", borderColor: "var(--primary)" }}
                aria-label="Add chop at current time (same as space bar)"
              >
                Chop
              </button>
              {slotsFull && (
                <span className="text-sm" style={{ color: "var(--muted)" }}>Chop slots full</span>
              )}
            </>
          )}
        </div>
        {chopModeEnabled && (
          <ChopPads chops={chops} onPadKeyPress={onPadKeyPress} onRemoveChop={removeChop} pressedKey={pressedKey} />
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{title}</h3>
        <p className="mb-2 text-sm" style={{ color: "var(--muted)" }}>{channel}</p>
        {(genre || era || bpm || musicalKey || analysisStatus === "processing" || analysisStatus === "pending") && (
          <div className="flex gap-2 flex-wrap">
            {genre && <span className="px-3 py-1.5 rounded-lg text-sm border" style={{ background: "#FFF", color: "var(--foreground)", borderColor: "var(--border)" }}>{genre}</span>}
            {era && <span className="px-3 py-1.5 rounded-lg text-sm border" style={{ background: "#FFF", color: "var(--foreground)", borderColor: "var(--border)" }}>{era}</span>}
            {bpm && <span className="px-3 py-1.5 rounded-lg text-sm font-mono border" style={{ background: "#FFF", color: "var(--foreground)", borderColor: "var(--border)" }}>{bpm} BPM</span>}
            {musicalKey && <span className="px-3 py-1.5 rounded-lg text-sm font-mono border" style={{ background: "#FFF", color: "var(--foreground)", borderColor: "var(--border)" }}>{musicalKey}</span>}
            {(analysisStatus === "processing" || analysisStatus === "pending") && !bpm && !musicalKey && (
              <span className="px-3 py-1.5 rounded-lg text-sm border" style={{ background: "#FFF", color: "var(--foreground)", borderColor: "var(--border)" }}>Analyzing...</span>
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
    prevProps.onVideoError === nextProps.onVideoError &&
    prevProps.initialChops === nextProps.initialChops &&
    prevProps.onSavedChopsChange === nextProps.onSavedChopsChange
  )
  
  // onSaveToggle comparison - use reference equality
  const callbackEqual = prevProps.onSaveToggle === nextProps.onSaveToggle
  
  // Return true if props are equal (no re-render needed)
  // bpm, key, analysisStatus, and isSaved changes won't trigger iframe re-render
  // Only youtubeId, autoplay, startTime, duration, initialChops changes will trigger iframe/player update
  return iframePropsEqual && displayMetadataEqual && otherPropsEqual && callbackEqual
})
