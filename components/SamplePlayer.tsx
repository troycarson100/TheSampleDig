"use client"

import { useEffect, useRef, useMemo, memo, useState, useCallback } from "react"

import HeartToggle from "./HeartToggle"
import ChopPads, { CHOP_KEYBOARD_WIDTH_REM } from "./ChopPads"
import ChopTimelineMarkers from "./ChopTimelineMarkers"
import { useChopMode } from "@/hooks/useChopMode"
import { loadYouTubeIframeAPI, createAdapterFromIframe } from "@/lib/youtube-player-adapter"
import { KEY_COLORS, type YouTubePlayerAdapter, type Chop, type RecordedChopEvent, type SavedLoopData } from "@/hooks/useChopMode"
import { playMetronomeBeep } from "@/lib/audio/metronome"
import { getSavedLoops, saveLoop, deleteSavedLoop, type SavedLoopEntry } from "@/lib/saved-loops-storage"

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
  /** Called when user toggles save. When saving (not unsaving), opts.chops and opts.loop are stored. */
  onSaveToggle?: (opts?: { chops?: Chop[]; loop?: SavedLoopData }) => void
  showHeart?: boolean
  /** Restore saved chops when loading a saved sample. */
  initialChops?: Chop[] | null
  /** Restore saved recorded loop when loading a saved sample (play loop button). */
  initialLoop?: SavedLoopData | null
  /** When sample is saved, called (debounced) when chops or loop change so parent can persist them. */
  onSavedChopsChange?: (chops: Chop[], loop?: SavedLoopData | null) => void
  onVideoError?: () => void // Callback when video is unavailable
}

const TAP_MAX_TAPS = 8
const TAP_BPM_MIN = 40
const TAP_BPM_MAX = 240
const TAP_RESET_MS = 2500

/** Eighth note (quaver) icon for BPM/Key meta boxes */
function EighthNoteIcon({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden style={{ fontSize: "14px", lineHeight: 1, color: "inherit" }}>
      ♪
    </span>
  )
}

/* Match HTML .tag: 3px radius, brown text, light border */
const META_BOX_STYLE = {
  background: "rgba(74, 55, 40, 0.04)",
  border: "1px solid rgba(74, 55, 40, 0.14)",
  color: "var(--brown)",
  borderRadius: "3px",
  padding: "6px 14px",
  fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace",
  fontSize: "9px",
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
} as const

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
  initialLoop,
  onSavedChopsChange,
}: SamplePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const tapResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const youtubeIdRef = useRef<string | null>(null)
  const isInitializedRef = useRef(false)
  const adapterRef = useRef<YouTubePlayerAdapter | null>(null)
  const [chopModeEnabled, setChopModeEnabled] = useState(false)
  const [tapTempoEnabled, setTapTempoEnabled] = useState(false)
  const [tapTimes, setTapTimes] = useState<number[]>([])
  const [tapBpm, setTapBpm] = useState<number | null>(null)
  const [tapButtonFlash, setTapButtonFlash] = useState(false)
  const [bpmOverride, setBpmOverride] = useState<number | null>(null)
  const [bpmEditing, setBpmEditing] = useState(false)
  const [bpmEditInput, setBpmEditInput] = useState("")
  const [metronomeDuringRecording, setMetronomeDuringRecording] = useState(false)
  const [loopStartMs, setLoopStartMs] = useState(0)
  const [loopEndMs, setLoopEndMs] = useState(0)
  const [recordingFullLengthMs, setRecordingFullLengthMs] = useState(0)
  const recordingFullLengthRef = useRef(0)
  const [draggingLoopEdge, setDraggingLoopEdge] = useState<"start" | "end" | null>(null)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [videoDurationFromPlayer, setVideoDurationFromPlayer] = useState(0)
  const chopKeysFocusTrapRef = useRef<HTMLDivElement>(null)
  const loopBarRef = useRef<HTMLDivElement>(null)
  const loopBoundsRef = useRef({ start: 0, end: 0 })
  const playbackBoundsRef = useRef<{ start: number; end: number } | null>(null)
  const chopOverlayRef = useRef<HTMLDivElement>(null)
  const bpmArrowIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bpmArrowDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bpmDragStartRef = useRef<{ startX: number; startBpm: number } | null>(null)
  const bpmDragMouseXRef = useRef(0)
  const bpmDragRafRef = useRef<number | null>(null)
  const bpmDragLastRenderedRef = useRef<number | null>(null)
  const onAfterChopPlay = useCallback(() => {
    chopKeysFocusTrapRef.current?.focus()
  }, [])

  // BPM/key come from DB only (metadata backfill). We do not use yt-dlp/analyzer on dig.
  const analyzedBpm = typeof bpm === "number" && bpm > 0 ? bpm : null
  const effectiveBpm = bpmOverride ?? analyzedBpm
  const isBpmOverridden = bpmOverride != null

  const clampBpm = useCallback((n: number) => Math.max(TAP_BPM_MIN, Math.min(TAP_BPM_MAX, Math.round(n))), [])

  const applyBpmOverride = useCallback(
    (value: number) => {
      const c = clampBpm(value)
      setBpmOverride(analyzedBpm != null && c === analyzedBpm ? null : c)
    },
    [clampBpm, analyzedBpm]
  )

  const startBpmArrowRepeat = useCallback(
    (delta: number) => {
      if (bpmArrowIntervalRef.current || bpmArrowDelayRef.current) return
      const current = effectiveBpm ?? 60
      // Don't apply here — button onMouseDown already applied one step. Delay before repeat so one click = one step.
      bpmArrowDelayRef.current = setTimeout(() => {
        bpmArrowDelayRef.current = null
        bpmArrowIntervalRef.current = setInterval(() => {
          setBpmOverride((prev) => {
            const next = clampBpm((prev ?? current) + delta)
            return analyzedBpm != null && next === analyzedBpm ? null : next
          })
        }, 100)
      }, 400)
    },
    [effectiveBpm, clampBpm, analyzedBpm]
  )

  const stopBpmArrowRepeat = useCallback(() => {
    if (bpmArrowDelayRef.current) {
      clearTimeout(bpmArrowDelayRef.current)
      bpmArrowDelayRef.current = null
    }
    if (bpmArrowIntervalRef.current) {
      clearInterval(bpmArrowIntervalRef.current)
      bpmArrowIntervalRef.current = null
    }
  }, [])

  const handleBpmDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (bpmEditing) return
      e.preventDefault()
      const startBpm = effectiveBpm ?? 60
      const startX = e.clientX
      const pixelsPerBpm = 6
      bpmDragStartRef.current = { startX, startBpm }
      bpmDragMouseXRef.current = startX
      bpmDragLastRenderedRef.current = null
      let dragStarted = false
      const tick = () => {
        const start = bpmDragStartRef.current
        if (!start) return
        const totalDeltaPx = bpmDragMouseXRef.current - start.startX
        const next = clampBpm(start.startBpm + totalDeltaPx / pixelsPerBpm)
        if (next !== bpmDragLastRenderedRef.current) {
          bpmDragLastRenderedRef.current = next
          setBpmOverride(analyzedBpm != null && next === analyzedBpm ? null : next)
        }
        bpmDragRafRef.current = requestAnimationFrame(tick)
      }
      const onMove = (ev: MouseEvent) => {
        const start = bpmDragStartRef.current
        if (!start) return
        if (!dragStarted && Math.abs(ev.clientX - startX) < 4) return
        if (!dragStarted) {
          dragStarted = true
          bpmDragRafRef.current = requestAnimationFrame(tick)
        }
        bpmDragMouseXRef.current = ev.clientX
      }
      const onUp = () => {
        if (bpmDragRafRef.current != null) {
          cancelAnimationFrame(bpmDragRafRef.current)
          bpmDragRafRef.current = null
        }
        bpmDragStartRef.current = null
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
      }
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [effectiveBpm, clampBpm, bpmEditing, analyzedBpm]
  )

  const handleTapTempo = useCallback(() => {
    setTapButtonFlash(true)
    setTimeout(() => setTapButtonFlash(false), 120)
    if (tapResetTimeoutRef.current) {
      clearTimeout(tapResetTimeoutRef.current)
      tapResetTimeoutRef.current = null
    }
    const now = Date.now()
    setTapTimes((prev) => {
      const next = [...prev, now].slice(-TAP_MAX_TAPS)
      if (next.length >= 2) {
        const intervals: number[] = []
        for (let i = 1; i < next.length; i++) {
          intervals.push((next[i]! - next[i - 1]!) / 1000)
        }
        const avgSec = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const bpmVal = avgSec > 0 ? Math.round(60 / avgSec) : 0
        const clamped = Math.max(TAP_BPM_MIN, Math.min(TAP_BPM_MAX, bpmVal))
        setTapBpm(clamped)
        setBpmOverride(clamped)
      }
      return next
    })
    tapResetTimeoutRef.current = setTimeout(() => {
      setTapTimes([])
      tapResetTimeoutRef.current = null
    }, TAP_RESET_MS)
  }, [])

  // When Chop Mode is on, focus the video overlay so Space and chop keys work without clicking out
  useEffect(() => {
    if (chopModeEnabled) {
      chopOverlayRef.current?.focus()
    }
  }, [chopModeEnabled])

  type RecordPhase = "idle" | "countin" | "recording"
  const [recordPhase, setRecordPhase] = useState<RecordPhase>("idle")
  const [recordedSequence, setRecordedSequence] = useState<RecordedChopEvent[]>([])
  const recordStartTimeRef = useRef(0)
  const recordStopTimeRef = useRef(0)
  const recordEventsRef = useRef<RecordedChopEvent[]>([])
  const playbackTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const playChopByKeyRef = useRef<(key: string) => void>(() => {})
  const [isPlayingLoop, setIsPlayingLoop] = useState(false)
  const [clearLoopFlash, setClearLoopFlash] = useState(false)
  const [spaceBarFlash, setSpaceBarFlash] = useState(false)
  const spaceBarFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [savedLoopsList, setSavedLoopsList] = useState<SavedLoopEntry[]>([])
  const [liveRecordedEvents, setLiveRecordedEvents] = useState<RecordedChopEvent[]>([])
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0)
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0)
  const loopStartTimeRef = useRef(0)
  const loopLengthMsRef = useRef(0)
  const metronomeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopLoopPlayback = useCallback(() => {
    playbackTimeoutsRef.current.forEach((t) => clearTimeout(t))
    playbackTimeoutsRef.current = []
    playbackBoundsRef.current = null
    setIsPlayingLoop(false)
    setPlaybackPositionMs(0)
  }, [])

  const clearRecordedLoop = useCallback(() => {
    stopLoopPlayback()
    setRecordedSequence([])
    setLoopStartMs(0)
    setLoopEndMs(0)
    setRecordingFullLengthMs(0)
    recordingFullLengthRef.current = 0
    setClearLoopFlash(true)
    setTimeout(() => setClearLoopFlash(false), 280)
  }, [stopLoopPlayback])

  const startLoopPlayback = useCallback((
    events: RecordedChopEvent[],
    startMs?: number,
    endMs?: number
  ) => {
    if (events.length === 0) return
    const lastMs = Math.max(...events.map((e) => e.timeMs))
    const defaultEnd = lastMs + 500
    const totalMs = (endMs != null && endMs >= defaultEnd) ? endMs : defaultEnd
    const s = startMs ?? 0
    const e = endMs ?? totalMs
    playbackBoundsRef.current = { start: s, end: e }
    const minSpanMs = 20
    const clampedStart = Math.max(0, Math.min(s, e - minSpanMs))
    const clampedEnd = Math.min(totalMs, Math.max(e, clampedStart + minSpanMs))
    const filtered = events
      .filter((ev) => ev.timeMs >= clampedStart && ev.timeMs <= clampedEnd)
      .map((ev) => ({ ...ev, timeMs: ev.timeMs - clampedStart }))
      .sort((a, b) => a.timeMs - b.timeMs)
    const loopLengthMs = clampedEnd - clampedStart
    if (filtered.length === 0) return
    playbackTimeoutsRef.current.forEach((t) => clearTimeout(t))
    playbackTimeoutsRef.current = []
    const baseTime = performance.now()
    loopStartTimeRef.current = baseTime
    loopLengthMsRef.current = loopLengthMs
    setIsPlayingLoop(true)
    const play = playChopByKeyRef.current
    const runLoop = (iteration: number) => {
      playbackTimeoutsRef.current.forEach((t) => clearTimeout(t))
      playbackTimeoutsRef.current = []
      const now = performance.now()
      const iterationStart = baseTime + iteration * loopLengthMs
      const delayToNext = iterationStart + loopLengthMs - now
      filtered.forEach((ev) => {
        const delay = iterationStart + ev.timeMs - now
        const t = setTimeout(() => play(ev.key), Math.max(0, delay))
        playbackTimeoutsRef.current.push(t)
      })
      if (delayToNext > 0) {
        const loopT = setTimeout(() => runLoop(iteration + 1), delayToNext)
        playbackTimeoutsRef.current.push(loopT)
      }
    }
    runLoop(0)
  }, [])

  const stopRecordAndStartPlayback = useCallback(() => {
    if (metronomeIntervalRef.current) {
      clearInterval(metronomeIntervalRef.current)
      metronomeIntervalRef.current = null
    }
    setRecordPhase("idle")
    setLiveRecordedEvents([])
    setRecordingElapsedMs(0)
    const events = [...recordEventsRef.current]
    setRecordedSequence(events)
    recordEventsRef.current = []
    const lastEventMs = events.length ? Math.max(...events.map((e) => e.timeMs)) : 0
    const stopTime = recordStopTimeRef.current || performance.now()
    const elapsedMs = recordStartTimeRef.current
      ? Math.max(0, stopTime - recordStartTimeRef.current)
      : 0
    const totalMs = Math.max(lastEventMs + 50, elapsedMs)
    recordingFullLengthRef.current = totalMs
    setLoopStartMs(0)
    setLoopEndMs(totalMs)
    setRecordingFullLengthMs(totalMs)
    if (events.length > 0) startLoopPlayback(events, 0, totalMs)
  }, [startLoopPlayback])

  const onRecordPad = useCallback((key: string, timeMs: number) => {
    const ev = { key, timeMs }
    recordEventsRef.current.push(ev)
    setLiveRecordedEvents((prev) => [...prev, ev])
  }, [])

  const onRKey = useCallback(() => {
    if (recordPhase === "recording") {
      recordStopTimeRef.current = performance.now()
      stopRecordAndStartPlayback()
      return
    }
    if (recordPhase !== "idle") return
    // If a loop is playing or exists, clear it so we record a fresh loop
    clearRecordedLoop()
    // Pause video; recording starts on first chop key press
    const adapter = adapterRef.current
    if (adapter?.pause && adapter.getPlayerState?.() !== 2) {
      adapter.pause()
    }
    setRecordPhase("recording")
    recordStartTimeRef.current = 0
    recordStopTimeRef.current = 0
    recordEventsRef.current = []
    setLiveRecordedEvents([])
    setRecordingElapsedMs(0)
    if (metronomeDuringRecording) {
      const bpmNum = typeof effectiveBpm === "number" && effectiveBpm > 0 ? effectiveBpm : 60
      const intervalMs = Math.round(60000 / bpmNum)
      metronomeIntervalRef.current = setInterval(() => {
        playMetronomeBeep()
      }, intervalMs)
    }
  }, [recordPhase, stopRecordAndStartPlayback, effectiveBpm, metronomeDuringRecording, clearRecordedLoop])

  const onSpaceWhenRecording = useCallback(() => {
    if (recordPhase === "recording") {
      recordStopTimeRef.current = performance.now()
      stopRecordAndStartPlayback()
    }
  }, [recordPhase, stopRecordAndStartPlayback])

  // When user turns off metronome during recording, stop the beeps immediately
  useEffect(() => {
    if (recordPhase === "recording" && !metronomeDuringRecording) {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current)
        metronomeIntervalRef.current = null
      }
    }
  }, [recordPhase, metronomeDuringRecording])

  // Update recording elapsed for live timeline + playhead (0 until first key starts the clock)
  useEffect(() => {
    if (recordPhase !== "recording") return
    const tick = () => {
      setRecordingElapsedMs(
        recordStartTimeRef.current === 0 ? 0 : performance.now() - recordStartTimeRef.current
      )
    }
    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [recordPhase])

  // Update playback position for playhead during loop playback
  useEffect(() => {
    if (!isPlayingLoop) return
    const tick = () => {
      setPlaybackPositionMs((performance.now() - loopStartTimeRef.current) % loopLengthMsRef.current)
    }
    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [isPlayingLoop])

  loopBoundsRef.current = { start: loopStartMs, end: loopEndMs }

  // Drag loop start/end edges on the timeline bar (use fixed full length so scale doesn't change)
  useEffect(() => {
    if (!draggingLoopEdge) return
    const bar = loopBarRef.current
    if (!bar) return
    const totalMs = recordingFullLengthMs || recordingFullLengthRef.current || (recordedSequence.length > 0
      ? Math.max(...recordedSequence.map((e) => e.timeMs)) + 500
      : 1)
    const minSpanMs = 20
    const onMove = (e: MouseEvent) => {
      const rect = bar.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = Math.max(0, Math.min(1, x / rect.width))
      const ms = Math.round(pct * totalMs)
      const { start, end } = loopBoundsRef.current
      const maxEnd = end || totalMs
      if (draggingLoopEdge === "start") {
        setLoopStartMs(Math.max(0, Math.min(ms, maxEnd - minSpanMs)))
      } else {
        setLoopEndMs(Math.min(totalMs, Math.max(ms, start + minSpanMs)))
      }
    }
    const onUp = () => setDraggingLoopEdge(null)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [draggingLoopEdge, recordedSequence.length, recordingFullLengthMs])

  // When loop start/end change while playing, restart playback with new bounds (only when not dragging, so playback stays smooth during drag)
  useEffect(() => {
    if (!isPlayingLoop || recordedSequence.length === 0 || draggingLoopEdge !== null) return
    const fullMs = recordingFullLengthMs || recordingFullLengthRef.current || Math.max(...recordedSequence.map((e) => e.timeMs)) + 500
    const requestedStart = loopStartMs
    const requestedEnd = loopEndMs || fullMs
    const current = playbackBoundsRef.current
    if (current && (current.start !== requestedStart || current.end !== requestedEnd)) {
      stopLoopPlayback()
      startLoopPlayback(recordedSequence, requestedStart, requestedEnd)
    }
  }, [isPlayingLoop, loopStartMs, loopEndMs, draggingLoopEdge, recordedSequence, recordingFullLengthMs, startLoopPlayback, stopLoopPlayback])

  useEffect(() => {
    return () => {
      stopLoopPlayback()
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current)
        metronomeIntervalRef.current = null
      }
      if (bpmArrowDelayRef.current) {
        clearTimeout(bpmArrowDelayRef.current)
        bpmArrowDelayRef.current = null
      }
      if (bpmArrowIntervalRef.current) {
        clearInterval(bpmArrowIntervalRef.current)
        bpmArrowIntervalRef.current = null
      }
      if (tapResetTimeoutRef.current) {
        clearTimeout(tapResetTimeoutRef.current)
        tapResetTimeoutRef.current = null
      }
    }
  }, [stopLoopPlayback])

  const onAddChopFlash = useCallback(() => {
    setSpaceBarFlash(true)
    if (spaceBarFlashTimeoutRef.current) clearTimeout(spaceBarFlashTimeoutRef.current)
    spaceBarFlashTimeoutRef.current = setTimeout(() => {
      setSpaceBarFlash(false)
      spaceBarFlashTimeoutRef.current = null
    }, 150)
  }, [])

  useEffect(() => {
    return () => {
      if (spaceBarFlashTimeoutRef.current) clearTimeout(spaceBarFlashTimeoutRef.current)
    }
  }, [])

  const { chops, clearChops, removeChop, addChop, slotsFull, onPadKeyPress, updateChopTime, pressedKey } = useChopMode(
    adapterRef,
    chopModeEnabled,
    youtubeId,
    initialChops,
    onAfterChopPlay,
    chopModeEnabled
      ? {
          isRecording: recordPhase === "recording",
          recordStartTimeRef,
          onRecordPad,
          onSpaceWhenRecording,
          onRKey,
          onAddChop: onAddChopFlash,
        }
      : undefined
  )

  playChopByKeyRef.current = onPadKeyPress

  // Restore saved loop when loading a saved sample (initialLoop / youtubeId change).
  // Use a serialized signature so that when we switch back to a saved sample (e.g. same
  // object reference), the effect still runs and repopulates the loop bar.
  const initialLoopSignature =
    initialLoop?.sequence?.length != null
      ? `${youtubeId}-${initialLoop.sequence.length}-${initialLoop.loopStartMs}-${initialLoop.loopEndMs}`
      : ""
  useEffect(() => {
    if (!youtubeId) return
    if (initialLoop?.sequence?.length) {
      setRecordedSequence(initialLoop.sequence)
      setLoopStartMs(initialLoop.loopStartMs)
      setLoopEndMs(initialLoop.loopEndMs)
      const fullMs =
        initialLoop.fullLengthMs != null && initialLoop.fullLengthMs > 0
          ? initialLoop.fullLengthMs
          : Math.max(...initialLoop.sequence.map((e) => e.timeMs)) + 500
      setRecordingFullLengthMs(fullMs)
      recordingFullLengthRef.current = fullMs
    } else {
      setRecordedSequence([])
      setLoopStartMs(0)
      setLoopEndMs(0)
      setRecordingFullLengthMs(0)
      recordingFullLengthRef.current = 0
    }
  }, [youtubeId, initialLoopSignature, initialLoop])

  // Load saved loops from localStorage when video changes
  useEffect(() => {
    if (!youtubeId) {
      setSavedLoopsList([])
      return
    }
    setSavedLoopsList(getSavedLoops(youtubeId))
  }, [youtubeId])

  // Auto-save chops and loop when sample is already saved and either change (debounced)
  const SAVED_CHOPS_DEBOUNCE_MS = 600
  useEffect(() => {
    if (!isSaved || !onSavedChopsChange) return
    const t = setTimeout(() => {
      const loopPayload: SavedLoopData | null =
        recordedSequence.length > 0
          ? {
              sequence: recordedSequence,
              loopStartMs,
              loopEndMs: loopEndMs || recordingFullLengthMs || Math.max(...recordedSequence.map((e) => e.timeMs)) + 500,
              fullLengthMs: recordingFullLengthMs || undefined,
            }
          : null
      onSavedChopsChange(chops, loopPayload)
    }, SAVED_CHOPS_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [isSaved, chops, recordedSequence, loopStartMs, loopEndMs, recordingFullLengthMs, onSavedChopsChange])
  
  // Use a ref to store the initial start time and never change it for this video
  // This prevents the iframe src from changing after initial load
  const startTimeRef = useRef<number | null>(null)
  
  // NEVER start within 25 seconds of the end
  const END_BUFFER = 25
  
  // Explicit start at 0 (e.g. drum break mode) must be respected and never overwritten
  const isExplicitStartAtZero = startTime === 0

  // Reset and set start time when youtubeId changes
  if (youtubeIdRef.current !== youtubeId) {
    youtubeIdRef.current = youtubeId
    const generatedTime = startTime ?? generateSmartStartTime(duration)
    if (isExplicitStartAtZero) {
      startTimeRef.current = 0
    } else if (duration && generatedTime > duration - END_BUFFER) {
      console.warn(`[SamplePlayer] Generated start time ${generatedTime} too close to end (${duration}), using ${duration - END_BUFFER}`)
      startTimeRef.current = duration - END_BUFFER
    } else {
      startTimeRef.current = generatedTime
    }
    isInitializedRef.current = false // Reset initialization flag
  }

  const baseStartTime = startTimeRef.current ?? (startTime ?? generateSmartStartTime(duration))

  // When parent explicitly requests start at 0 (drum break), use 0 and skip safety clamping
  let actualStartTime = baseStartTime
  if (isExplicitStartAtZero) {
    actualStartTime = 0
  } else if (duration && duration > 0) {
    const maxSafeStart = duration - END_BUFFER
    if (actualStartTime > maxSafeStart) {
      console.warn(`[SamplePlayer] Start time ${actualStartTime} too close to end (${duration}), clamping to ${maxSafeStart}`)
      actualStartTime = Math.max(15, maxSafeStart)
    }
    if (actualStartTime >= duration - END_BUFFER) {
      const safeMiddle = Math.max(15, Math.floor((duration - END_BUFFER) / 2))
      console.warn(`[SamplePlayer] CRITICAL: Using safe middle ${safeMiddle} for duration ${duration}`)
      actualStartTime = safeMiddle
    }
    actualStartTime = Math.max(15, Math.min(actualStartTime, duration - END_BUFFER))
  }

  // Reset iframeLoaded and video position when video changes so we wait for the new iframe to load
  useEffect(() => {
    setIframeLoaded(false)
    setVideoCurrentTime(0)
    setVideoDurationFromPlayer(0)
  }, [youtubeId])

  // Stop loop playback and clear recorded loop when video changes so old timeouts don't fire seeks on the new video (prevents glitchy noises on load)
  useEffect(() => {
    clearRecordedLoop()
    setRecordPhase("idle")
    setLiveRecordedEvents([])
    setRecordingElapsedMs(0)
    recordStartTimeRef.current = 0
    recordStopTimeRef.current = 0
    recordEventsRef.current = []
    if (metronomeIntervalRef.current) {
      clearInterval(metronomeIntervalRef.current)
      metronomeIntervalRef.current = null
    }
  }, [youtubeId, clearRecordedLoop])

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

  // Poll video current time and duration for timeline (when adapter is ready)
  useEffect(() => {
    if (!validYoutubeIdForAdapter || !iframeLoaded) return
    const tick = () => {
      const adapter = adapterRef.current
      if (adapter) {
        try {
          const t = adapter.getCurrentTime()
          if (typeof t === "number" && t >= 0) setVideoCurrentTime(t)
          const d = adapter.getDuration?.()
          if (typeof d === "number" && d > 0) setVideoDurationFromPlayer(d)
        } catch (_) {}
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [validYoutubeIdForAdapter, iframeLoaded])

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
  
  // Respect explicit start at 0 (drum break); otherwise enforce 25s buffer from end
  let safeStartTime = actualStartTime
  if (isExplicitStartAtZero) {
    safeStartTime = 0
  } else if (duration && duration > 0) {
    const maxSafeStart = duration - 25
    if (safeStartTime > maxSafeStart) {
      console.warn(`[SamplePlayer] CRITICAL: Start time ${safeStartTime} exceeds safe limit (${maxSafeStart}), clamping to ${maxSafeStart}`)
      safeStartTime = Math.max(15, maxSafeStart)
    }
    if (safeStartTime > duration - 25) {
      safeStartTime = Math.max(15, Math.floor((duration - 25) / 2))
      console.warn(`[SamplePlayer] CRITICAL FIX: Using fallback start time ${safeStartTime} for duration ${duration}`)
    }
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

  // Validate iframe src start parameter only when we're not explicitly starting at 0 (drum break)
  useEffect(() => {
    if (isExplicitStartAtZero) return
    if (iframeRef.current && duration && duration > 0 && iframeSrc) {
      const urlParams = new URLSearchParams(iframeRef.current.src.split('?')[1])
      const startParam = parseInt(urlParams.get('start') || '0', 10)
      const maxSafeStart = duration - 25
      if (startParam > maxSafeStart) {
        console.error(`[SamplePlayer] CRITICAL: Iframe src has invalid start time ${startParam} (max safe: ${maxSafeStart})`)
        const correctedSrc = iframeSrc.replace(/start=\d+/, `start=${maxSafeStart}`)
        iframeRef.current.src = correctedSrc
        iframeSrcRef.current = correctedSrc
        console.log(`[SamplePlayer] Corrected iframe src start time to ${maxSafeStart}`)
      }
    }
  }, [iframeSrc, duration, isExplicitStartAtZero])
  
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

  const effectiveTimelineDuration = (duration != null && duration > 0) ? duration : videoDurationFromPlayer

  // Separate the iframe from the heart toggle to prevent re-renders
  // The iframe will only re-render when youtubeId changes, not when isSaved changes
  return (
    <div className="w-full min-w-0">
      <div className="player-wrap aspect-video w-full max-w-full rounded-lg overflow-hidden bg-black relative">
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
              style={{ pointerEvents: chopModeEnabled ? "none" : "auto" }}
              onLoad={() => setIframeLoaded(true)}
              onError={() => {
                // If iframe fails to load, trigger error callback
                if (onVideoError) {
                  onVideoError()
                }
              }}
            />
            {/* When Chop Mode is on, overlay keeps focus so Space and chop keys work; click toggles play/pause via API */}
            {chopModeEnabled && (
              <div
                ref={chopOverlayRef}
                tabIndex={0}
                className="absolute inset-0 z-[5] cursor-pointer focus:outline-none"
                aria-label="Video area: click to play or pause; use Space and letter keys for chops"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const adapter = adapterRef.current
                  if (!adapter) return
                  const state = adapter.getPlayerState?.()
                  if (state === 2) adapter.play()
                  else if (adapter.pause) adapter.pause()
                }}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center rounded-lg" style={{ background: "var(--muted-light)", color: "var(--muted)" }}>
            <p>Invalid video ID — loading next sample...</p>
          </div>
        )}
        {/* Heart toggle - perfect circle: fixed equal width/height so it stays round */}
        {showHeart && onSaveToggle && (
          <div className={`heart-btn absolute top-4 right-4 z-20 pointer-events-auto flex items-center justify-center w-11 h-11 rounded-full shadow-md ${isSaved ? "saved" : ""}`}>
            <HeartToggle
              isSaved={isSaved}
              onToggle={() => {
                if (isSaved) {
                  onSaveToggle(undefined)
                  return
                }
                const hasLoop = recordedSequence.length > 0
                onSaveToggle({
                  chops: chops.length > 0 ? chops : undefined,
                  loop: hasLoop
                    ? {
                        sequence: recordedSequence,
                        loopStartMs,
                        loopEndMs: loopEndMs || (recordingFullLengthMs || Math.max(...recordedSequence.map((e) => e.timeMs)) + 500),
                        fullLengthMs: recordingFullLengthMs || undefined,
                      }
                    : undefined,
                })
              }}
              size="md"
              className=""
            />
          </div>
        )}
        {/* Chop Mode: video timeline with playhead (and chop markers when present). Use duration from props or from player. */}
        {chopModeEnabled && effectiveTimelineDuration > 0 && (
          <ChopTimelineMarkers
            chops={chops}
            duration={effectiveTimelineDuration}
            currentTime={videoCurrentTime}
            onSeek={(time) => {
              const adapter = adapterRef.current
              if (adapter) adapter.seekTo(time)
            }}
            onUpdateChopTime={updateChopTime}
            onRemoveChop={removeChop}
            pressedKey={pressedKey}
          />
        )}
      </div>

      <div className="track-meta-bar mt-0 p-5 w-full" style={{ background: "var(--warm)" }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h3 className="track-title text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{title}</h3>
          {(genre || era || effectiveBpm != null || musicalKey) && (
            <div className="flex gap-2 flex-wrap items-stretch">
              {genre && <span className="tag-genre meta-tag-box inline-flex items-center min-h-[32px] px-3 py-0 rounded-lg text-sm border" style={{ background: "transparent", color: "var(--rust)", borderColor: "var(--rust)" }}>{genre}</span>}
              {era && <span className="tag-era meta-tag-box inline-flex items-center min-h-[32px] px-3 py-0 rounded-lg text-sm border" style={{ background: "transparent", color: "var(--olive)", borderColor: "var(--olive)" }}>{era}</span>}
              {effectiveBpm != null && (
                <div
                  className="meta-tag-box relative inline-flex items-center min-h-[32px] rounded-xl border select-none gap-0"
                  style={{
                    ...META_BOX_STYLE,
                    padding: 0,
                  }}
                >
                  <span className="pl-3 pr-1.5 flex items-center" style={{ color: META_BOX_STYLE.color }}>
                    <EighthNoteIcon />
                  </span>
                  <button
                    type="button"
                    className="p-1.5 hover:opacity-70 transition-opacity"
                    style={{ color: META_BOX_STYLE.color }}
                    aria-label="Decrease BPM"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      applyBpmOverride((effectiveBpm ?? 60) - 1)
                      startBpmArrowRepeat(-1)
                    }}
                    onMouseUp={stopBpmArrowRepeat}
                    onMouseLeave={stopBpmArrowRepeat}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    </svg>
                  </button>
                  <div
                    className="flex items-center justify-center gap-0.5 py-2 px-1.5 min-w-[3.5rem] cursor-ew-resize font-mono"
                    style={{ color: META_BOX_STYLE.color }}
                    onDoubleClick={(e) => {
                      e.preventDefault()
                      setBpmEditing(true)
                      setBpmEditInput(String(effectiveBpm))
                    }}
                    onMouseDown={handleBpmDragStart}
                  >
                    {bpmEditing ? (
                      <input
                        type="number"
                        min={TAP_BPM_MIN}
                        max={TAP_BPM_MAX}
                        className="w-full bg-transparent border-none text-center focus:outline-none focus:ring-0 p-0 font-mono"
                        style={{ color: META_BOX_STYLE.color }}
                        value={bpmEditInput}
                        onChange={(e) => setBpmEditInput(e.target.value)}
                        onBlur={() => {
                          const n = parseInt(bpmEditInput, 10)
                          if (!Number.isNaN(n)) {
                            const c = clampBpm(n)
                            setBpmOverride(analyzedBpm != null && c === analyzedBpm ? null : c)
                          }
                          setBpmEditing(false)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const n = parseInt(bpmEditInput, 10)
                            if (!Number.isNaN(n)) {
                              const c = clampBpm(n)
                              setBpmOverride(analyzedBpm != null && c === analyzedBpm ? null : c)
                            }
                            setBpmEditing(false)
                            ;(e.target as HTMLInputElement).blur()
                          }
                          if (e.key === "Escape") {
                            setBpmEditing(false)
                            setBpmEditInput(String(effectiveBpm))
                            ;(e.target as HTMLInputElement).blur()
                          }
                        }}
                        autoFocus
                        aria-label="BPM value"
                      />
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-0.5">
                          <span>{effectiveBpm}</span>
                          {isBpmOverridden && (
                            <span
                              className="w-1 h-1 rounded-full shrink-0 opacity-70"
                              style={{ backgroundColor: "currentColor" }}
                              aria-hidden
                            />
                          )}
                        </span>
                        <span className="text-inherit"> BPM</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="p-1.5 hover:opacity-70 transition-opacity"
                    style={{ color: META_BOX_STYLE.color }}
                    aria-label="Increase BPM"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      applyBpmOverride((effectiveBpm ?? 60) + 1)
                      startBpmArrowRepeat(1)
                    }}
                    onMouseUp={stopBpmArrowRepeat}
                    onMouseLeave={stopBpmArrowRepeat}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                    </svg>
                  </button>
                </div>
              )}
              {musicalKey && (
                <span className="meta-tag-box inline-flex items-center min-h-[32px] gap-2 rounded-xl border box-border" style={{ ...META_BOX_STYLE }}>
                  <EighthNoteIcon className="shrink-0" />
                  <span className="font-mono">{musicalKey}</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0" style={{ color: "var(--foreground)" }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Tap tempo</span>
            <button
              type="button"
              role="switch"
              aria-checked={tapTempoEnabled}
              onClick={() => {
                setTapTempoEnabled((v) => !v)
                if (tapTempoEnabled) {
                  setTapTimes([])
                  setTapBpm(null)
                  setBpmOverride(null)
                  if (tapResetTimeoutRef.current) {
                    clearTimeout(tapResetTimeoutRef.current)
                    tapResetTimeoutRef.current = null
                  }
                }
              }}
              className="relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1"
              style={{
                background: tapTempoEnabled ? "var(--primary)" : "var(--muted-light)",
              }}
              title={tapTempoEnabled ? "Tap tempo on – BPM updates from your taps" : "Tap tempo off – use analyzed BPM"}
            >
              <span
                className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                style={{ transform: tapTempoEnabled ? "translateX(1.25rem)" : "translateX(0)" }}
              />
            </button>
            {tapTempoEnabled && (
              <button
                type="button"
                onClick={handleTapTempo}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border transition"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                  background: tapButtonFlash ? "var(--muted-light)" : "#FFF",
                }}
                title="Tap in time with the music to set BPM"
              >
                Tap
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Metronome (recording)</span>
            <button
              type="button"
              role="switch"
              aria-checked={metronomeDuringRecording}
              onClick={() => setMetronomeDuringRecording((v) => !v)}
              className="relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1"
              style={{
                background: metronomeDuringRecording ? "var(--primary)" : "var(--muted-light)",
              }}
              title="Play metronome during recording (count-in always plays)"
            >
              <span
                className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                style={{ transform: metronomeDuringRecording ? "translateX(1.25rem)" : "translateX(0)" }}
              />
            </button>
          </div>
        </div>
        </div>
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
        <div className="chop-row flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-8">
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <span className="text-sm font-medium toggle-label" style={{ color: "var(--foreground)" }}>Chop Mode</span>
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
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={onRKey}
                className="chop-icon-btn flex items-center justify-center w-8 h-8 rounded-full border transition hover:opacity-90"
                style={{
                  borderColor: "var(--border)",
                  background: recordPhase === "recording" ? "#dc2626" : "var(--muted-light)",
                  color: recordPhase === "recording" ? "#fff" : "var(--muted)",
                }}
                aria-label={recordPhase === "recording" ? "Stop recording (R)" : "Record (R); first key starts the clock"}
                title={recordPhase === "recording" ? "Stop recording (R or Space)" : "Record; first chop key starts the clock (R)"}
              >
                <span className="text-xs font-bold">R</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isPlayingLoop) {
                    stopLoopPlayback()
                  } else if (recordedSequence.length > 0) {
                    const totalMs = recordingFullLengthMs || recordingFullLengthRef.current || Math.max(...recordedSequence.map((e) => e.timeMs)) + 500
                    startLoopPlayback(recordedSequence, loopStartMs, loopEndMs || totalMs)
                  }
                }}
                disabled={recordedSequence.length === 0}
                className="chop-icon-btn flex items-center justify-center w-8 h-8 rounded-full border transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--border)",
                  background: isPlayingLoop ? "#16a34a" : "var(--muted-light)",
                  color: isPlayingLoop ? "#fff" : recordedSequence.length > 0 ? "var(--foreground)" : "var(--muted)",
                }}
                aria-label={isPlayingLoop ? "Stop playback" : "Play recorded chop sequence"}
                title={isPlayingLoop ? "Stop playback" : "Play recorded sequence on loop"}
              >
                {isPlayingLoop ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              {/* Mini timeline: grey bar with colored ticks; draggable start/end edges; playhead */}
              <div
                ref={loopBarRef}
                className="chop-scrubber flex items-center flex-1 min-w-[200px] max-w-[420px] h-3 rounded-sm select-none overflow-visible"
                style={{ background: "var(--muted-light)" }}
                aria-label="Recorded sequence"
              >
                {(() => {
                  const isRecording = recordPhase === "recording"
                  const events = isRecording ? liveRecordedEvents : recordedSequence
                  const lastEventMs = events.length > 0
                    ? Math.max(...events.map((e) => e.timeMs))
                    : 0
                  const fullLengthMs = recordingFullLengthMs || recordingFullLengthRef.current || lastEventMs + 500
                  const totalLengthMs =
                    isRecording
                      ? Math.max(recordingElapsedMs, lastEventMs + 400, 800)
                      : Math.max(fullLengthMs, loopEndMs || 0)
                  const hasLoopRange = !isRecording && recordedSequence.length > 0 && totalLengthMs > 0
                  const endMs = loopEndMs || totalLengthMs
                  const startPct = hasLoopRange ? (loopStartMs / totalLengthMs) * 100 : 0
                  const endPct = hasLoopRange ? (endMs / totalLengthMs) * 100 : 100
                  const playheadPositionMs = isRecording
                    ? recordingElapsedMs
                    : isPlayingLoop
                      ? loopStartMs + (playbackPositionMs % loopLengthMsRef.current)
                      : -1
                  const playheadPercent = totalLengthMs > 0 && playheadPositionMs >= 0
                    ? (playheadPositionMs / totalLengthMs) * 100
                    : -1
                  const showPlayhead =
                    (isRecording && totalLengthMs > 0) || (isPlayingLoop && loopLengthMsRef.current > 0)
                  return (
                    <div className="relative w-full h-full rounded-sm overflow-visible">
                      {/* Darker overlay for region left of loop start (not playing) */}
                      {hasLoopRange && startPct > 0 && (
                        <div
                          className="absolute left-0 top-0 bottom-0 rounded-l-sm pointer-events-none z-[0]"
                          style={{
                            width: `${startPct}%`,
                            background: "rgba(0,0,0,0.2)",
                          }}
                          aria-hidden
                        />
                      )}
                      {/* Darker overlay for region right of loop end (not playing) */}
                      {hasLoopRange && endPct < 100 && (
                        <div
                          className="absolute right-0 top-0 bottom-0 rounded-r-sm pointer-events-none z-[0]"
                          style={{
                            width: `${100 - endPct}%`,
                            background: "rgba(0,0,0,0.2)",
                          }}
                          aria-hidden
                        />
                      )}
                      <div className="absolute inset-0 rounded-sm overflow-visible z-[1]">
                        {events.length > 0 &&
                          [...events]
                            .sort((a, b) => a.timeMs - b.timeMs)
                            .map((ev, i) => (
                              <div
                                key={isRecording ? `${ev.key}-${ev.timeMs}-${i}` : `s-${ev.key}-${ev.timeMs}-${i}`}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 min-w-[2px] h-5 rounded-px"
                                style={{
                                  left: `${(ev.timeMs / totalLengthMs) * 100}%`,
                                  backgroundColor: KEY_COLORS[ev.key] ?? "#888",
                                }}
                              />
                            ))}
                        {showPlayhead && playheadPercent >= 0 && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 min-w-[2px] h-5 rounded-px pointer-events-none z-[1]"
                            style={{
                              left: `${Math.min(100, Math.max(0, playheadPercent))}%`,
                              backgroundColor: "#6b7280",
                            }}
                          />
                        )}
                      </div>
                      {hasLoopRange && (
                        <>
                          <div
                            role="slider"
                            aria-label="Loop start"
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-5 rounded-px cursor-ew-resize z-[2]"
                            style={{
                              left: `${startPct}%`,
                              backgroundColor: "#374151",
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setDraggingLoopEdge("start")
                            }}
                          />
                          <div
                            role="slider"
                            aria-label="Loop end"
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-5 rounded-px cursor-ew-resize z-[2]"
                            style={{
                              left: `${endPct}%`,
                              backgroundColor: "#374151",
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setDraggingLoopEdge("end")
                            }}
                          />
                        </>
                      )}
                    </div>
                  )
                })()}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (recordedSequence.length === 0) return
                  const totalMs = recordingFullLengthMs || recordingFullLengthRef.current || Math.max(...recordedSequence.map((e) => e.timeMs)) + 500
                  saveLoop(youtubeId ?? "", {
                    sequence: recordedSequence,
                    loopStartMs,
                    loopEndMs: loopEndMs || totalMs,
                    fullLengthMs: recordingFullLengthMs || totalMs,
                  })
                  setSavedLoopsList(getSavedLoops(youtubeId ?? ""))
                }}
                disabled={recordedSequence.length === 0}
                className="chop-icon-btn flex items-center justify-center w-8 h-8 rounded-full border transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--muted-light)",
                  color: "var(--muted)",
                }}
                aria-label="Save loop copy"
                title="Save a copy of this loop (load from list below)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              </button>
              <button
                type="button"
                onClick={clearRecordedLoop}
                className="chop-icon-btn flex items-center justify-center w-8 h-8 rounded-full border transition hover:opacity-90"
                style={{
                  borderColor: "var(--border)",
                  background: clearLoopFlash ? "#eab308" : "var(--muted-light)",
                  color: clearLoopFlash ? "#000" : "var(--muted)",
                }}
                aria-label="Clear recorded loop"
                title="Clear recorded loop"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              {slotsFull && (
                <span className="text-sm" style={{ color: "var(--muted)" }}>Chop slots full</span>
              )}
            </div>
          )}
        </div>
        {chopModeEnabled && (
          <div className="chop-keyboard">
            <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
              <button
                type="button"
                onClick={clearChops}
                className="chop-btn shrink-0 self-start text-sm font-medium px-3 py-1.5 rounded-lg border transition hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Clear
              </button>
              <div className="flex flex-col items-center flex-1 min-w-0 w-full md:w-auto">
                <ChopPads chops={chops} onPadKeyPress={onPadKeyPress} onRemoveChop={removeChop} pressedKey={pressedKey} />
                <div className="flex justify-center mt-3">
              <button
              type="button"
              onClick={() => !slotsFull && addChop()}
              disabled={slotsFull}
              className="chop-space-bar py-3 rounded-lg border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                width: `${CHOP_KEYBOARD_WIDTH_REM}rem`,
                background: spaceBarFlash ? "#d4d1cc" : "#e8e6e3",
                border: "1px solid rgba(0,0,0,0.08)",
                borderBottom: spaceBarFlash ? "1px solid rgba(74,55,40,0.16)" : "2px solid rgba(74,55,40,0.16)",
                color: "#9a9590",
              }}
              aria-label="Chop at current time (Space)"
              title="Chop at current time (Space or click)"
              >
                <span className="font-semibold text-sm">Chop (Space Bar)</span>
              </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {chopModeEnabled && savedLoopsList.length > 0 && (
          <div className="mt-3 w-full max-w-2xl mx-auto">
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
              Saved loops — click to load
            </p>
            <ul className="flex flex-col gap-2">
              {savedLoopsList.map((entry) => {
                const totalMs = entry.fullLengthMs ?? Math.max(...entry.sequence.map((e) => e.timeMs)) + 500
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 p-2 rounded-lg border transition hover:opacity-90"
                    style={{ borderColor: "var(--border)", background: "var(--muted-light)" }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        stopLoopPlayback()
                        setRecordedSequence(entry.sequence)
                        setLoopStartMs(entry.loopStartMs)
                        setLoopEndMs(entry.loopEndMs)
                        const full = entry.fullLengthMs ?? Math.max(...entry.sequence.map((e) => e.timeMs)) + 500
                        setRecordingFullLengthMs(full)
                        recordingFullLengthRef.current = full
                      }}
                      className="flex items-center flex-1 min-w-0 gap-2 text-left"
                      title="Load this loop"
                    >
                      <div
                        className="flex-shrink-0 w-16 h-2 rounded-sm overflow-hidden"
                        style={{ background: "var(--background)" }}
                        aria-hidden
                      >
                        <div className="relative w-full h-full">
                          {entry.sequence
                            .slice()
                            .sort((a, b) => a.timeMs - b.timeMs)
                            .map((ev, i) => (
                              <div
                                key={`${ev.key}-${ev.timeMs}-${i}`}
                                className="absolute top-0 bottom-0 w-0.5 min-w-[2px] rounded-px"
                                style={{
                                  left: `${(ev.timeMs / totalMs) * 100}%`,
                                  backgroundColor: KEY_COLORS[ev.key] ?? "#888",
                                }}
                              />
                            ))}
                        </div>
                      </div>
                      <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>
                        {entry.label ?? "Loop"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (youtubeId) {
                          deleteSavedLoop(youtubeId, entry.id)
                          setSavedLoopsList(getSavedLoops(youtubeId))
                        }
                      }}
                      className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full border transition hover:opacity-90"
                      style={{ borderColor: "var(--border)", background: "var(--muted-light)", color: "var(--muted)" }}
                      aria-label="Delete saved loop"
                      title="Remove from saved loops"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
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
