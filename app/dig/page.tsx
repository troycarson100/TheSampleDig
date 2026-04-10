"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Script from "next/script"
import { useSession } from "next-auth/react"
import SamplePlayer from "@/components/SamplePlayer"
import type { SavedLoopData } from "@/hooks/useChopMode"
import DiceButton from "@/components/DiceButton"
import SavedSamplesSidebar from "@/components/SavedSamplesSidebar"
import SiteNav from "@/components/SiteNav"
import DigFilterPanel from "@/components/DigFilterPanel"
import { recordHistory, clearHistory, removeHistoryItem } from "@/lib/dig-history"
import type { HistoryItem } from "@/lib/dig-history"
import FeatureGateModal from "@/components/FeatureGateModal"
import { DigAdSenseUnit } from "@/components/DigAdSenseUnit"
import { ADSENSE_DIG_FOOTER_SLOT, ADSENSE_DIG_SIDEBAR_SLOT } from "@/lib/adsense-dig"
// import BeatsPanel from "@/components/BeatsPanel" // Beat loop section commented out for now

/** Label maps for display; used for both static fallback and dynamic options from API */
const GENRE_LABELS: Record<string, string> = {
  jazz: "Jazz",
  soul: "Soul",
  funk: "Funk",
  "r&b": "R&B",
  "hip hop": "Hip Hop",
  "bossa nova": "Bossa Nova",
  blues: "Blues",
  disco: "Disco",
  reggae: "Reggae",
  latin: "Latin",
  prog: "Prog",
  psychedelic: "Psychedelic",
  afrobeat: "Afrobeat",
  lounge: "Lounge",
  japanese: "Japanese",
  soundtrack: "Soundtrack",
  folk: "Folk",
  world: "World",
}

/** Era filter options: by decade (value matches DB era e.g. "1960s") */
const ERA_DECADES: { value: string; label: string }[] = [
  { value: "", label: "Any era" },
  { value: "1950s", label: "1950s" },
  { value: "1960s", label: "1960s" },
  { value: "1970s", label: "1970s" },
  { value: "1980s", label: "1980s" },
  { value: "1990s", label: "1990s" },
  { value: "2000s", label: "2000s" },
]

function toLabel(value: string, labels: Record<string, string>): string {
  if (!value) return value
  return labels[value] ?? value.replace(/\b\w/g, (c) => c.toUpperCase())
}

interface Chop {
  key: string
  time: number
  color: string
  index: number
}

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
  chops?: Chop[]
  loop?: SavedLoopData | null
  notes?: string | null
  /** User-overridden BPM (from saved notes); overrides bpm when set. */
  bpmOverride?: number | null
}

const DIG_LOAD_SAMPLE_KEY = "digLoadSample"
/** After first roll or any active video, hide “Start Here” hint (persisted). */
const DIG_START_HERE_DONE_KEY = "digStartHereDone"

function readDigStartHereDone(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(DIG_START_HERE_DONE_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * Google AdSense: set `true` after the site is approved and slots are live.
 * While `false`, non‑Pro users see no ad script, no units, and layout matches “no fixed footer ad”.
 */
const ADSENSE_DIG_UNITS_ENABLED = false

export default function DigPage() {
  const { data: session, status } = useSession()
  const [sample, setSample] = useState<Sample | null>(null)
  const [previousSample, setPreviousSample] = useState<Sample | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSaved, setIsSaved] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const [drumBreak, setDrumBreak] = useState(false)
  const [randomStartTime, setRandomStartTime] = useState(true)
  const [samplePacks, setSamplePacks] = useState(false)
  const [genreFilter, setGenreFilter] = useState("")
  const [eraFilter, setEraFilter] = useState("")
  const [genreOptions, setGenreOptions] = useState<{ value: string; label: string }[]>(() => [
    { value: "", label: "Any genre" },
  ])
  const [eraOptions] = useState<{ value: string; label: string }[]>(() => ERA_DECADES)
  const [filtersLoaded, setFiltersLoaded] = useState(false)
  const [sampleLoadTime, setSampleLoadTime] = useState<number | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  /** Non–Pro: in-memory only (clears on full page refresh). Pro uses localStorage via recordHistory. */
  const [sessionDigHistory, setSessionDigHistory] = useState<HistoryItem[]>([])
  const [showFilters, setShowFilters] = useState(false)
  /** false until mount: must match SSR (always “not done”) so “Start Here” doesn’t hydrate differently from localStorage. */
  const [digStartHereHydrated, setDigStartHereHydrated] = useState(false)
  const [digStartHereDone, setDigStartHereDone] = useState(false)
  /** Stripe Checkout return: show once, then strip query params from URL */
  const [checkoutBanner, setCheckoutBanner] = useState<"success" | "canceled" | null>(null)

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      if (q.get("checkout_success") === "1") setCheckoutBanner("success")
      else if (q.get("checkout_canceled") === "1") setCheckoutBanner("canceled")
      if (q.has("checkout_success") || q.has("checkout_canceled")) {
        q.delete("checkout_success")
        q.delete("checkout_canceled")
        const rest = q.toString()
        window.history.replaceState({}, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    setDigStartHereDone(readDigStartHereDone())
    setDigStartHereHydrated(true)
  }, [])

  const markDigStartHereDone = useCallback(() => {
    setDigStartHereDone(true)
    try {
      localStorage.setItem(DIG_START_HERE_DONE_KEY, "1")
    } catch {
      /* ignore */
    }
  }, [])
  const isSavedRef = useRef(isSaved)
  const sampleRef = useRef(sample)
  const sessionRef = useRef(session)
  /** Server-returned sample id after save; avoid setSample on save to prevent video going black */
  const sampleIdFromSaveRef = useRef<string | null>(null)
  const videoErrorCallbackRef = useRef<() => void>(() => {})

  useEffect(() => {
    videoErrorCallbackRef.current = () => {
      const s = sampleRef.current
      if (s?.youtubeId) {
        addSeenVideo(s.youtubeId)
        // Sample was added to History when the roll loaded; remove if playback failed / auto-skipped
        removeHistoryItem(s.youtubeId)
        setSessionDigHistory((prev) => prev.filter((h) => h.youtubeId !== s.youtubeId))
      }
      console.log("Video unavailable, fetching next sample...")
      handleDig()
    }
  })
  const handleVideoError = useCallback(() => {
    videoErrorCallbackRef.current()
  }, [])

  // Load sample from My Samples page (profile): open in dig and start playing
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DIG_LOAD_SAMPLE_KEY)
      if (!raw) return
      sessionStorage.removeItem(DIG_LOAD_SAMPLE_KEY)
      const data = JSON.parse(raw) as Sample
      if (data?.youtubeId && data.youtubeId.length === 11) {
        setSample(data)
        setIsSaved(true)
        setAutoplay(true)
      }
    } catch {
      sessionStorage.removeItem(DIG_LOAD_SAMPLE_KEY)
    }
  }, [])
  
  // Keep refs in sync with state
  useEffect(() => {
    isSavedRef.current = isSaved
  }, [isSaved])
  
  useEffect(() => {
    sampleRef.current = sample
    if (sample != null) sampleIdFromSaveRef.current = sample.id ?? null
  }, [sample])

  useEffect(() => {
    if (sample?.youtubeId) markDigStartHereDone()
  }, [sample?.youtubeId, markDigStartHereDone])
  
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

  // Load drum break preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("digDrumBreak")
    if (saved !== null) {
      setDrumBreak(saved === "true")
    }
  }, [])

  // Save drum break preference to localStorage
  useEffect(() => {
    localStorage.setItem("digDrumBreak", drumBreak.toString())
  }, [drumBreak])

  // Drum Break is Pro-only; clear if session is not Pro (avoids stale localStorage + API param)
  useEffect(() => {
    if (status === "loading") return
    const eligible = session?.user?.isPro === true
    if (!eligible && drumBreak) setDrumBreak(false)
  }, [status, session?.user?.isPro, drumBreak])

  // Load random start time preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("digRandomStartTime")
    if (saved !== null) setRandomStartTime(saved === "true")
  }, [])

  // Save random start time preference to localStorage
  useEffect(() => {
    localStorage.setItem("digRandomStartTime", randomStartTime.toString())
  }, [randomStartTime])

  // Load Sample Packs preference from localStorage; clear era when loading (sample packs mostly post-1990)
  useEffect(() => {
    const saved = localStorage.getItem("digSamplePacks") ?? localStorage.getItem("digRoyaltyFree")
    if (saved !== null) {
      const val = saved === "true"
      setSamplePacks(val)
      if (val) setEraFilter("")
    }
  }, [])

  // Save Sample Packs preference to localStorage; clear era when enabling
  useEffect(() => {
    localStorage.setItem("digSamplePacks", samplePacks.toString())
    if (samplePacks) setEraFilter("")
  }, [samplePacks])

  // Ping activity so "active users" sees you (runs once when logged in)
  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return
    fetch("/api/activity/ping", { credentials: "include" }).catch(() => {})
  }, [status, session?.user])

  // History is client-only localStorage for Pro. Clear when logged in as non-Pro (free / downgraded).
  // Do not clear on sign-out — Pro subscribers should keep history across sessions on this device.
  useEffect(() => {
    if (status === "loading") return
    if (status === "authenticated" && session?.user && session.user.isPro !== true) {
      clearHistory()
    }
  }, [status, session?.user?.isPro])

  // Drop ephemeral history once account is Pro (persisted list lives in localStorage).
  useEffect(() => {
    if (session?.user?.isPro === true) setSessionDigHistory([])
  }, [session?.user?.isPro])

  // Fetch genre/era options from API (only show genres/eras that have samples in DB)
  useEffect(() => {
    let cancelled = false
    fetch("/api/samples/filters")
      .then((r) => r.json())
      .then((data: { genres?: string[]; eras?: string[] }) => {
        if (cancelled) return
        const genres = Array.isArray(data.genres) ? data.genres : []
        const eras = Array.isArray(data.eras) ? data.eras : []
        setGenreOptions([
          { value: "", label: "Any genre" },
          ...genres.map((g) => ({ value: g, label: toLabel(g, GENRE_LABELS) })),
        ])
        // Era options are fixed decades (ERA_DECADES), not from API
        setFiltersLoaded(true)
      })
      .catch(() => setFiltersLoaded(true))
    return () => {
      cancelled = true
    }
  }, [])

  // Load genre/era from localStorage once filters have been fetched (restore saved filter if still valid)
  const filtersRestoredRef = useRef(false)
  useEffect(() => {
    if (!filtersLoaded || filtersRestoredRef.current) return
    filtersRestoredRef.current = true
    const savedGenre = localStorage.getItem("digGenre")
    if (savedGenre !== null && genreOptions.some((o) => o.value === savedGenre)) {
      setGenreFilter(savedGenre)
    }
    if (localStorage.getItem("digSamplePacks") === "true" || localStorage.getItem("digRoyaltyFree") === "true") return
    const savedEra = localStorage.getItem("digEra")
    if (savedEra !== null && eraOptions.some((o) => o.value === savedEra)) {
      setEraFilter(savedEra)
    }
  }, [filtersLoaded, genreOptions, eraOptions])

  // Save genre filter to localStorage
  useEffect(() => {
    localStorage.setItem("digGenre", genreFilter)
  }, [genreFilter])

  // Save era filter to localStorage
  useEffect(() => {
    localStorage.setItem("digEra", eraFilter)
  }, [eraFilter])

  // Get seen video IDs from sessionStorage
  const getSeenVideoIds = (): string[] => {
    if (typeof window === "undefined") return []
    try {
      const seen = sessionStorage.getItem("seenVideos")
      if (!seen) return []
      const ids = JSON.parse(seen) as string[]
      // Keep only last 100 to prevent sessionStorage from getting too large
      return ids.slice(-100)
    } catch {
      return []
    }
  }

  // Add video ID to seen list
  const addSeenVideo = (youtubeId: string) => {
    if (typeof window === "undefined") return
    try {
      const seen = getSeenVideoIds()
      if (!seen.includes(youtubeId)) {
        seen.push(youtubeId)
        // Keep only last 100
        const trimmed = seen.slice(-100)
        sessionStorage.setItem("seenVideos", JSON.stringify(trimmed))
      }
    } catch (error) {
      console.error("Error saving seen video:", error)
    }
  }

  const onRollClick = () => {
    markDigStartHereDone()
    handleDig()
  }

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
      // Get list of seen videos to exclude
      const excludedIds = getSeenVideoIds()
      console.log(`[Repeat Prevention] Excluding ${excludedIds.length} videos:`, excludedIds.slice(0, 5).join(", "), excludedIds.length > 5 ? "..." : "")
      
      const params = new URLSearchParams()
      if (excludedIds.length > 0) params.set("excluded", excludedIds.join(","))
      if (genreFilter.trim() !== "") params.set("genre", genreFilter.trim())
      if (!samplePacks && eraFilter.trim() !== "") params.set("era", eraFilter.trim())
      if (drumBreak) params.set("drumBreak", "1")
      if (samplePacks) params.set("samplePacks", "1")
      const url = params.toString() ? `/api/samples/dig?${params.toString()}` : "/api/samples/dig"

      const response = await fetch(url)
      const responseData = await response.json()
      
      if (!response.ok) {
        throw new Error(responseData.error || `Failed to fetch sample (${response.status})`)
      }
      
      const data = responseData
      // Drum Break: start at 0:00. Random Start Time off: start at 0:00. Otherwise smart start (avoid intro/outro).
      const END_BUFFER = 25
      let finalStartTime: number
      if (drumBreak || !randomStartTime) {
        finalStartTime = 0
        console.log(`[Dig] Start at 0:00 (drumBreak=${drumBreak}, randomStartTime=${randomStartTime})`)
      } else if (data.duration && data.duration > 0) {
        finalStartTime = Math.max(15, Math.min(Math.floor(data.duration * 0.3), data.duration - END_BUFFER))
        if (finalStartTime > data.duration - END_BUFFER) {
          finalStartTime = Math.max(15, data.duration - END_BUFFER)
        }
        finalStartTime = Math.max(15, Math.min(finalStartTime, data.duration - END_BUFFER))
        console.log(`[Dig] Final start time: ${finalStartTime} (duration: ${data.duration})`)
      } else {
        finalStartTime = Math.floor(Math.random() * 300) + 30
      }
      
      // Save current sample as previous before setting new one
      if (sample) {
        setPreviousSample(sample)
        console.log("Previous sample saved:", sample.title)
      }
      
      // Add this video to seen list IMMEDIATELY to prevent repeats (before setting sample)
      // This ensures it's excluded from the next request even if user clicks quickly
      if (data.youtubeId && data.youtubeId.length === 11) {
        addSeenVideo(data.youtubeId)
        console.log(`[Repeat Prevention] Added ${data.youtubeId} to seen list`)
      } else {
        console.warn(`[Repeat Prevention] Invalid YouTube ID: ${data.youtubeId}`)
      }
      
      // Ensure we always have youtubeId for the player (11-char ID; never use database cuid)
      const youtubeId = data.youtubeId && String(data.youtubeId).length === 11
        ? data.youtubeId
        : (data.id && String(data.id).length === 11 ? data.id : null)
      if (!youtubeId) {
        console.warn("[Dig] Response missing valid youtubeId, skipping this sample")
        handleDig()
        return
      }
      const newSample = {
        ...data,
        youtubeId,
        startTime: finalStartTime,
      }
      console.log('Sample loaded:', newSample)
      setSample(newSample)
      // Use ref so async dig completes with correct session (Pro history is subscription-based, not UI bypass).
      if (sessionRef.current?.user?.isPro === true) {
        recordHistory({
          youtubeId: newSample.youtubeId,
          title: newSample.title,
          channel: newSample.channel,
          thumbnailUrl: newSample.thumbnailUrl,
          genre: newSample.genre,
          bpm: newSample.bpm,
          key: newSample.key,
        })
      } else {
        setSessionDigHistory((prev) => {
          const item: HistoryItem = {
            youtubeId: newSample.youtubeId,
            title: newSample.title,
            channel: newSample.channel,
            thumbnailUrl: newSample.thumbnailUrl,
            genre: newSample.genre,
            bpm: newSample.bpm,
            key: newSample.key,
            viewedAt: Date.now(),
          }
          const filtered = prev.filter((h) => h.youtubeId !== item.youtubeId)
          return [item, ...filtered].slice(0, 1000)
        })
      }

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

  // BPM/key analysis disabled for dig — we use tap tempo only; no polling for server analysis.
  // useEffect(() => {
  //   if (sample?.id && (sample.analysisStatus === "processing" || sample.analysisStatus === "pending")) {
  //     let pollCount = 0
  //     const maxPolls = 8
  //     const pollInterval = setInterval(async () => {
  //       pollCount++
  //       if (pollCount > maxPolls) {
  //         setSample(prev => prev ? { ...prev, analysisStatus: "failed" } : null)
  //         clearInterval(pollInterval)
  //         return
  //       }
  //       try {
  //         const response = await fetch(`/api/samples/get?sampleId=${sample.id}`)
  //         if (response.ok) {
  //           const data = await response.json()
  //           if (data.analysisStatus === "completed" || data.analysisStatus === "failed" || data.bpm || data.key) {
  //             setSample(prev => prev ? { ...prev, bpm: data.bpm ?? prev.bpm, key: data.key ?? prev.key, analysisStatus: data.analysisStatus ?? prev.analysisStatus } : null)
  //             if (data.analysisStatus === "completed" || data.analysisStatus === "failed") clearInterval(pollInterval)
  //           }
  //         }
  //       } catch (error) {
  //         if (pollCount > 3) clearInterval(pollInterval)
  //       }
  //     }, 5000)
  //     return () => clearInterval(pollInterval)
  //   }
  // }, [sample?.id, sample?.analysisStatus])

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

  const handleResetFilters = () => {
    setGenreFilter("")
    setEraFilter("")
    setDrumBreak(false)
    setRandomStartTime(true)
  }

  const clearSessionDigHistory = useCallback(() => {
    setSessionDigHistory([])
  }, [])

  const removeSessionDigHistoryItem = useCallback((youtubeId: string) => {
    setSessionDigHistory((prev) => prev.filter((h) => h.youtubeId !== youtubeId))
  }, [])

  // Memoize the save toggle handler to prevent unnecessary re-renders
  // Use refs to keep callback completely stable - no dependencies
  const handleSaveToggle = useCallback(async (opts?: { chops?: Chop[]; loop?: SavedLoopData | null; bpm?: number }) => {
    const currentSample = sampleRef.current
    const currentSession = sessionRef.current
    if (!currentSession) {
      setShowAuthModal(true)
      return
    }
    if (!currentSample) {
      console.error("[Frontend] No current sample to save")
      return
    }
    // Save API accepts either database sample id or youtubeId for lookup
    const sampleId = currentSample.id || sampleIdFromSaveRef.current
    const youtubeId = currentSample.youtubeId
    if (!sampleId && !youtubeId) {
      console.error("[Frontend] Sample has no id or youtubeId")
      alert("This sample can’t be saved yet. Roll the dice again to load a new one.")
      return
    }
    const currentlySaved = isSavedRef.current
    const endpoint = currentlySaved ? "/api/samples/unsave" : "/api/samples/save"
    console.log("[Frontend] Saving sample:", {
      sampleId,
      youtubeId,
      title: currentSample.title,
      channel: currentSample.channel,
      isSaved: currentlySaved,
      chopsCount: opts?.chops?.length ?? 0,
    })
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          currentlySaved
            ? { sampleId: sampleId || youtubeId }
            : {
                sampleId: sampleId || youtubeId,
                startTime: currentSample.startTime ?? Math.floor(Math.random() * 300) + 30,
                youtubeId: youtubeId,
                title: currentSample.title,
                channel: currentSample.channel,
                thumbnailUrl: currentSample.thumbnailUrl,
                chops: opts?.chops,
                loop: opts?.loop,
                bpm: opts?.bpm,
              }
        ),
      })

      const data = await response.json()
      console.log("[Frontend] Save response:", { status: response.status, data })

      if (response.ok) {
        setIsSaved(!currentlySaved)
        if (!currentlySaved && currentSample.youtubeId) {
          addSeenVideo(currentSample.youtubeId)
          console.log(`[Save] Added ${currentSample.youtubeId} to seen list to prevent repeats`)
        }
        // Store server id in ref only — avoid setSample so player doesn't re-render (prevents video going black)
        if (!currentlySaved && data.sampleId) {
          sampleIdFromSaveRef.current = data.sampleId
        }
        window.dispatchEvent(new CustomEvent("samplesUpdated"))
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
  }, []) // No dependencies - callback is completely stable

  // Auto-save chops and loop when sample is already saved and user edits (debounced in SamplePlayer)
  const handleSavedChopsChange = useCallback(async (chops: Chop[], loop?: SavedLoopData | null) => {
    const currentSample = sampleRef.current
    const effectiveSampleId = currentSample?.id ?? sampleIdFromSaveRef.current
    if (!effectiveSampleId) return
    try {
      const res = await fetch("/api/samples/update-chops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId: effectiveSampleId, chops, loop: loop ?? undefined }),
      })
      if (res.ok) window.dispatchEvent(new CustomEvent("samplesUpdated"))
    } catch (e) {
      console.warn("[Dig] Failed to auto-save chops/loop:", e)
    }
  }, [])

  // Auto-save BPM override when sample is saved and user changes BPM (debounced in SamplePlayer)
  const handleSavedBpmChange = useCallback(async (bpm: number | null) => {
    const currentSample = sampleRef.current
    if (!currentSample?.id) return
    try {
      const res = await fetch("/api/samples/update-chops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId: currentSample.id, bpm }),
      })
      if (res.ok) window.dispatchEvent(new CustomEvent("samplesUpdated"))
    } catch (e) {
      console.warn("[Dig] Failed to auto-save BPM:", e)
    }
  }, [])

  /** Session-backed Pro subscription — hide all AdSense UI + script (not useIsPro() env bypass). */
  const isProSubscriber = session?.user?.isPro === true
  const digAdsActive = !isProSubscriber && ADSENSE_DIG_UNITS_ENABLED

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      {digAdsActive ? (
        <Script
          id="adsense-dig-loader"
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7744671172843728"
          crossOrigin="anonymous"
        />
      ) : null}
      <header className="site-header w-full">
        <SiteNav />
      </header>

      <FeatureGateModal open={showAuthModal} type="signup" onClose={() => setShowAuthModal(false)} />

      <div className="genre-ticker">
        <div className="ticker-track" aria-hidden>
          {/* Genres + eras for ticker; sequence repeated for seamless loop (track duplicated so -50% loops) */}
          {(() => {
            const genres = genreOptions.filter((o) => o.value).map((o) => o.label)
            const eras = eraOptions.filter((o) => o.value).map((o) => o.label)
            const labels = [...genres, ...eras]
            const repeated = [...Array(8)].flatMap(() => labels)
            return (
              <>
                {repeated.flatMap((label, i) =>
                  i === 0 ? [<span key={i} className="ticker-label">{label}</span>] : [<span key={`d-${i}`} className="ticker-dot">✦</span>, <span key={i} className="ticker-label">{label}</span>]
                )}
                {repeated.flatMap((label, i) =>
                  i === 0 ? [<span key={`2-${i}`} className="ticker-label">{label}</span>] : [<span key={`2-d-${i}`} className="ticker-dot">✦</span>, <span key={`2-${i}`} className="ticker-label">{label}</span>]
                )}
              </>
            )
          })()}
        </div>
      </div>

      <div
        className="dig-page-wrap"
        style={
          digAdsActive
            ? { paddingBottom: "max(6rem, calc(5.5rem + env(safe-area-inset-bottom, 0px)))" }
            : undefined
        }
      >
        {checkoutBanner === "success" && (
          <div
            className="mb-4 p-4 rounded-xl border text-center text-sm w-full max-w-4xl mx-auto"
            style={{
              background: "rgba(34, 197, 94, 0.1)",
              borderColor: "rgba(74, 222, 128, 0.35)",
              color: "#0a0a0a",
            }}
          >
            Thanks for subscribing. You now have full Pro access. Refresh if perks don&apos;t show yet.
          </div>
        )}
        {checkoutBanner === "canceled" && (
          <div
            className="mb-4 p-4 rounded-xl border text-center text-sm w-full max-w-4xl mx-auto"
            style={{
              background: "rgba(240, 235, 225, 0.06)",
              borderColor: "rgba(240, 235, 225, 0.12)",
              color: "rgba(240, 235, 225, 0.65)",
            }}
          >
            Checkout was canceled. You can subscribe anytime from Try Pro.
          </div>
        )}
        <div className="dig-app-grid flex flex-col md:grid md:grid-cols-[1fr_280px] dig-lg:grid-cols-[1fr_340px] gap-3 md:gap-6 items-start">
          <div className="max-md:flex-none md:flex-1 min-w-0 dig-col lg:min-w-0 w-full max-w-4xl">
            <div className="player-area-card w-full">
            {/* Controls */}
            <div className="controls-bar w-full flex flex-col items-center gap-3">
              {/* Back / Dice / Filters */}
              <div className="flex items-center justify-center gap-3 w-full flex-wrap">
                {previousSample && (
                  <button
                    onClick={handleGoBack}
                    className="w-[52px] h-[52px] min-w-[52px] min-h-[52px] rounded-lg flex items-center justify-center transition hover:opacity-80"
                    style={{ background: "var(--muted-light)", color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                    aria-label="Go back to previous video"
                    title="Go back to previous video"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                )}
                <div className="flex items-center gap-2 sm:gap-3">
                  {digStartHereHydrated && !sample && !digStartHereDone ? (
                    <span
                      className="select-none text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em] shrink-0"
                      style={{
                        color: "var(--rust)",
                        fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace",
                      }}
                    >
                      Start Here →
                    </span>
                  ) : null}
                  <DiceButton onClick={onRollClick} loading={loading} breathing bounce={!sample} />
                </div>
                <DigFilterPanel
                  open={showFilters}
                  onOpen={() => setShowFilters(true)}
                  onClose={() => setShowFilters(false)}
                  autoplay={autoplay}
                  onAutoplayChange={setAutoplay}
                  drumBreak={drumBreak}
                  onDrumBreakChange={setDrumBreak}
                  randomStartTime={randomStartTime}
                  onRandomStartTimeChange={setRandomStartTime}
                  genreFilter={genreFilter}
                  onGenreChange={setGenreFilter}
                  genreOptions={genreOptions}
                  eraFilter={eraFilter}
                  onEraChange={setEraFilter}
                  eraOptions={eraOptions}
                  samplePacks={samplePacks}
                  onReset={handleResetFilters}
                  /* Drum Break lock + gradient use session Pro, not useIsPro() — otherwise
                     NEXT_PUBLIC_REQUIRE_PRO_SUBSCRIPTION off makes everyone “Pro” here and hides the upsell. */
                  isPro={session?.user?.isPro === true}
                />
              </div>
            </div>

            <div className="player-card-scroll">
            {error && (
              <div className="mb-6 p-4 rounded-xl text-center border" style={{ background: "rgba(185,28,28,0.06)", borderColor: "rgba(185,28,28,0.2)", color: "#b91c1c" }}>
                {error}
              </div>
            )}

            {/* Video area - connects to controls bar (same card), track meta + chop below */}
            <div className="video-and-chop-card py-4 min-h-[280px]">
              {sample ? (
                <SamplePlayer
                  key={sample.youtubeId}
                  youtubeId={sample.youtubeId}
                  title={sample.title}
                  channel={sample.channel}
                  genre={sample.genre}
                  era={sample.era}
                  bpm={sample.bpm ?? null}
                  musicalKey={sample.key ?? null}
                  analysisStatus={sample.analysisStatus ?? null}
                  autoplay={autoplay}
                  startTime={sample.startTime}
                  duration={sample.duration}
                  isSaved={isSaved}
                  onSaveToggle={handleSaveToggle}
                  showHeart={true}
                  isPro={session?.user?.isPro === true}
                  initialChops={sample.chops}
                  initialLoop={sample.loop}
                  sampleId={sample.id ?? sampleIdFromSaveRef.current}
                  initialNotes={sample.notes}
                  initialBpmOverride={sample.bpmOverride}
                  onSavedChopsChange={session ? handleSavedChopsChange : undefined}
                  onSavedBpmChange={session ? handleSavedBpmChange : undefined}
                  onVideoError={handleVideoError}
                />
              ) : null}
            </div>
            </div>

            {/* Beat loop section commented out for now
            <BeatsPanel videoBpm={sample?.bpm ?? null} />
            */}

            </div>
          </div>

          {/* Pro: full column height. Non-Pro: reserve ~100px for fixed bottom ad above crate + sidebar slot */}
          <div
            className={`samples-panel md:sticky md:top-[102px] md:self-start shrink-0 flex flex-col gap-2 min-h-0 w-full md:w-auto ${
              digAdsActive ? "md:h-[calc(100dvh-214px)] md:max-h-[calc(100dvh-214px)]" : "md:h-[calc(100dvh-114px)] md:max-h-[calc(100dvh-114px)]"
            }`}
          >
              <div className="sidebar-dark flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
                <SavedSamplesSidebar
                  sessionDigHistory={sessionDigHistory}
                  onSessionDigHistoryClear={clearSessionDigHistory}
                  onSessionDigHistoryRemoveItem={removeSessionDigHistoryItem}
                  onSampleClick={(savedSample) => {
                    if (sample) setPreviousSample(sample)
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
                      duration: savedSample.duration,
                      chops: savedSample.chops,
                      loop: savedSample.loop,
                      notes: savedSample.notes,
                      bpmOverride: savedSample.bpmOverride,
                    })
                    setIsSaved(true)
                    addSeenVideo(savedSample.youtubeId)
                  }}
                  onHistoryItemClick={(item: HistoryItem) => {
                    if (sample) setPreviousSample(sample)
                    setSample({
                      id: undefined as any,
                      youtubeId: item.youtubeId,
                      title: item.title,
                      channel: item.channel,
                      thumbnailUrl: item.thumbnailUrl,
                      genre: item.genre,
                      bpm: item.bpm,
                      key: item.key,
                    })
                    setIsSaved(false)
                    addSeenVideo(item.youtubeId)
                  }}
                  currentSampleId={sample?.id}
                />
              </div>
              {digAdsActive ? (
                <div className="w-full shrink-0">
                  <DigAdSenseUnit variant="sidebar" adSlot={ADSENSE_DIG_SIDEBAR_SLOT} />
                </div>
              ) : null}
            </div>

          </div>

        <footer className="dig-footer mt-10 pt-8 border-t px-2 sm:px-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="footer-title text-lg font-semibold" style={{ fontFamily: "var(--font-bebas), 'Bebas Neue', sans-serif", color: "var(--foreground)" }}>Sample Roll</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace" }}>Helping you find samples that matter.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace" }}>
              <a href="/dig" className="hover:text-[var(--foreground)] transition">Dig</a>
              <a href="/profile" className="hover:text-[var(--foreground)] transition">My Crate</a>
              <a href="/blog" className="hover:text-[var(--foreground)] transition">Blog</a>
              <a href="/about" className="hover:text-[var(--foreground)] transition">About</a>
              <a href="/login" className="hover:text-[var(--foreground)] transition">Sign in</a>
            </div>
          </div>
        </footer>
      </div>

      {digAdsActive ? (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
          style={{
            background: "var(--background)",
            borderColor: "var(--border)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
          role="complementary"
          aria-label="Advertisement"
        >
          <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-1 pb-1">
            <DigAdSenseUnit variant="footer" adSlot={ADSENSE_DIG_FOOTER_SLOT} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

