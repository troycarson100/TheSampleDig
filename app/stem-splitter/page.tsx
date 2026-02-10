"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useSession } from "next-auth/react"
import SiteNav from "@/components/SiteNav"

type DownloadFormat = "wav" | "mp3"

const STEM_IDS = ["vocals", "drums", "bass", "other"] as const
const STEM_LABELS: Record<(typeof STEM_IDS)[number], string> = {
  vocals: "Vocal",
  drums: "Drums",
  bass: "Bass",
  other: "Melody",
}
const STEM_COLORS: Record<(typeof STEM_IDS)[number], string> = {
  vocals: "#E63946",
  drums: "#F4A261",
  bass: "#2A9D8F",
  other: "#9B5DE5",
}

interface StemState {
  id: (typeof STEM_IDS)[number]
  label: string
  url: string
  buffer: AudioBuffer | null
  volume: number
  muted: boolean
  solo: boolean
}

type MoreStemsType = "vocals" | "drums" | "melodies"
/** Stem id/label per type — matches API so we can build URLs when loading saved projects without re-calling the API */
const EXTRA_STEMS_META: Record<MoreStemsType, { id: string; label: string }[]> = {
  drums: [
    { id: "kick", label: "Kick" },
    { id: "snare", label: "Snare" },
    { id: "cymbals", label: "Cymbals" },
    { id: "toms", label: "Toms" },
  ],
  melodies: [
    { id: "guitar", label: "Guitar" },
    { id: "piano", label: "Piano" },
    { id: "other", label: "Other instruments" },
  ],
  vocals: [
    { id: "lead", label: "Lead Vocals" },
    { id: "backing", label: "Backing Vocals" },
  ],
}
interface ExtraStemState {
  id: string
  label: string
  url: string
  buffer: AudioBuffer | null
  volume: number
  muted: boolean
  solo: boolean
}
const EXTRA_STEM_COLORS: Record<string, string> = {
  kick: "#8B4513",
  snare: "#808080",
  cymbals: "#FFD700",
  toms: "#CD853F",
  guitar: "#228B22",
  piano: "#4169E1",
  other: "#9B59B6",
  lead: "#E63946",
  backing: "#F4A261",
}
function getExtraStemColor(id: string): string {
  return EXTRA_STEM_COLORS[id] ?? "#6B7280"
}

const MY_SONGS_STORAGE_KEY_PREFIX = "stem-splitter-my-songs"
/** Per-user key so each account has its own My Songs list. Guest = same browser, no login. */
function getMySongsStorageKey(userId: string | undefined): string {
  return userId ? `${MY_SONGS_STORAGE_KEY_PREFIX}-${userId}` : `${MY_SONGS_STORAGE_KEY_PREFIX}-guest`
}
interface SavedSong {
  id: string
  title: string
  bpm: number | null
  key: string | null
  savedAt: number
  /** Which "more stems" types were loaded (drums, melodies, vocals) so we restore them when loading */
  extraStemsTypes?: MoreStemsType[]
}
function loadMySongsFromStorage(storageKey: string): SavedSong[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
function saveMySongsToStorage(songs: SavedSong[], storageKey: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(storageKey, JSON.stringify(songs))
  } catch (_) {}
}

function getCssColor(varName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value || fallback
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  buffer: AudioBuffer,
  color: string,
  width: number,
  height: number,
  playheadProgress?: number
) {
  const ctx = canvas.getContext("2d")
  if (!ctx || width <= 0 || height <= 0) return
  const data = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(data.length / width))
  const amp = height / 2
  const midY = height / 2
  ctx.fillStyle = getCssColor("--muted-light", "#e5e5e5")
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < width; i++) {
    const start = i * step
    const end = Math.min(start + step, data.length)
    let min = 0
    let max = 0
    for (let j = start; j < end; j++) {
      const v = data[j]
      if (v < min) min = v
      if (v > max) max = v
    }
    const x = i
    const y1 = midY + min * amp
    const y2 = midY + max * amp
    if (i === 0) ctx.moveTo(x, midY)
    ctx.lineTo(x, y1)
    ctx.lineTo(x, y2)
  }
  ctx.lineTo(width, midY)
  ctx.closePath()
  ctx.fill()
  if (playheadProgress != null && playheadProgress >= 0 && playheadProgress <= 1) {
    const x = playheadProgress * width
    ctx.strokeStyle = getCssColor("--foreground", "#111")
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
}

export default function StemSplitterPage() {
  const { data: session } = useSession()
  const mySongsStorageKey = getMySongsStorageKey(session?.user?.id)
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingSavedSong, setLoadingSavedSong] = useState(false)
  const [error, setError] = useState("")
  const [stems, setStems] = useState<StemState[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [bpm, setBpm] = useState<number | null>(null)
  const [key, setKey] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloadStems, setDownloadStems] = useState<Set<string>>(new Set(STEM_IDS))
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>("wav")
  const [moreStemsOpen, setMoreStemsOpen] = useState(false)
  const [extraStemsByType, setExtraStemsByType] = useState<
    Record<MoreStemsType, { stems: { id: string; label: string; url: string }[] } | null>
  >({ drums: null, melodies: null, vocals: null })
  const [extraStemsStateByType, setExtraStemsStateByType] = useState<
    Record<MoreStemsType, ExtraStemState[]>
  >({ drums: [], melodies: [], vocals: [] })
  const [extraStemsLoading, setExtraStemsLoading] = useState(false)
  const [extraStemsError, setExtraStemsError] = useState("")
  const [extraStemsComingSoon, setExtraStemsComingSoon] = useState(false)
  const [subStemsOpen, setSubStemsOpen] = useState<Record<MoreStemsType, boolean>>({ drums: false, melodies: false, vocals: false })
  const [mySongs, setMySongs] = useState<SavedSong[]>([])
  const [mySongsSearch, setMySongsSearch] = useState("")
  const [mySongsKeyFilter, setMySongsKeyFilter] = useState<string>("")
  const [mySongsTempoRange, setMySongsTempoRange] = useState<[number, number]>([20, 300])
  const [displayTitleOverride, setDisplayTitleOverride] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleEditValue, setTitleEditValue] = useState("")
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
  const extraCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
  const extraStemsRef = useRef<Record<MoreStemsType, ExtraStemState[]>>({ drums: [], melodies: [], vocals: [] })
  const extraSourceNodesRef = useRef<Record<string, { source: AudioBufferSourceNode; gain: GainNode }>>({})
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodesRef = useRef<Record<string, { source: AudioBufferSourceNode; gain: GainNode }>>({})
  const startTimeRef = useRef(0)
  const pauseTimeRef = useRef(0)
  const durationRef = useRef(0)
  const stemsRef = useRef<StemState[]>([])
  const isPlayingRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)
  const stoppedManuallyRef = useRef(false)
  const playbackGenerationRef = useRef(0)
  const pendingSoloMuteRestartRef = useRef(false)
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const loadingProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const jobIdRef = useRef<string | null>(null)

  const loadStemBuffers = useCallback(async (stemsWithUrls: { id: (typeof STEM_IDS)[number]; label: string; url: string }[]) => {
    const ctx = new AudioContext()
    audioContextRef.current = ctx
    const loaded: StemState[] = []
    for (const s of stemsWithUrls) {
      const res = await fetch(s.url)
      const arrayBuffer = await res.arrayBuffer()
      const buffer = await ctx.decodeAudioData(arrayBuffer)
      loaded.push({
        id: s.id,
        label: s.label,
        url: s.url,
        buffer,
        volume: 1,
        muted: false,
        solo: false,
      })
    }
    setStems(loaded)
  }, [])

  useEffect(() => {
    setMySongs(loadMySongsFromStorage(mySongsStorageKey))
  }, [mySongsStorageKey])

  useEffect(() => {
    return () => {
      if (loadingProgressIntervalRef.current) {
        clearInterval(loadingProgressIntervalRef.current)
        loadingProgressIntervalRef.current = null
      }
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith("audio/")) setFile(f)
    else setError("Please drop an audio file (MP3, WAV, etc.)")
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
    setError("")
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!file) return
    setError("")
    setLoadingProgress(0)
    setProcessing(true)
    setStems([])
    setJobId(null)
    jobIdRef.current = null
    setBpm(null)
    setKey(null)
    // Clear any previous interval
    if (loadingProgressIntervalRef.current) {
      clearInterval(loadingProgressIntervalRef.current)
      loadingProgressIntervalRef.current = null
    }
    // Simulate progress from 0 toward 90% over ~55 seconds
    const durationMs = 55000
    const targetProgress = 90
    const tickMs = 500
    loadingProgressIntervalRef.current = setInterval(() => {
      setLoadingProgress((p) => {
        const next = Math.min(p + (targetProgress / (durationMs / tickMs)), targetProgress)
        return next
      })
    }, tickMs)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/stem-split", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.details ? `${data.error}\n\n${data.details}` : (data.error || "Stem split failed")
        throw new Error(msg)
      }
      setJobId(data.jobId)
      jobIdRef.current = data.jobId
      setBpm(data.bpm ?? null)
      setKey(data.key ?? null)
      setDisplayTitleOverride(null)
      await loadStemBuffers(data.stems)
      setMySongs((prev) => {
        const exists = prev.some((s) => s.id === data.jobId)
        if (exists) return prev
        const next = [
          ...prev,
          { id: data.jobId, title: file.name, bpm: data.bpm ?? null, key: data.key ?? null, savedAt: Date.now() },
        ]
        saveMySongsToStorage(next, mySongsStorageKey)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stem split failed")
    } finally {
      if (loadingProgressIntervalRef.current) {
        clearInterval(loadingProgressIntervalRef.current)
        loadingProgressIntervalRef.current = null
      }
      setLoadingProgress(100)
      setTimeout(() => setProcessing(false), 400)
    }
  }, [file, loadStemBuffers, mySongsStorageKey])

  useEffect(() => {
    stemsRef.current = stems
    if (stems.length === 0) return
    const duration = stems[0].buffer?.duration ?? 0
    durationRef.current = duration
    const playheadProgress = duration > 0 ? pauseTimeRef.current / duration : 0
    const drawStemWaveforms = () => {
      stems.forEach((s) => {
        const canvas = canvasRefs.current[s.id]
        if (canvas && s.buffer) {
          const w = Math.max(1, canvas.offsetWidth || canvasSizeRef.current.w)
          const h = Math.max(1, canvas.offsetHeight || canvasSizeRef.current.h)
          if (w <= 1 && h <= 1) return
          canvasSizeRef.current = { w, h }
          canvas.width = w
          canvas.height = h
          drawWaveform(canvas, s.buffer, STEM_COLORS[s.id], w, h, playheadProgress)
        }
      })
    }
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        drawStemWaveforms()
        const anyZero = stems.some((s) => {
          const canvas = canvasRefs.current[s.id]
          return canvas && (canvas.offsetWidth <= 0 || canvas.offsetHeight <= 0)
        })
        if (anyZero) timeoutId = setTimeout(drawStemWaveforms, 100)
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (timeoutId != null) clearTimeout(timeoutId)
    }
  }, [stems])

  const updateStem = useCallback((id: (typeof STEM_IDS)[number], patch: Partial<StemState>) => {
    setStems((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const getGain = useCallback((s: StemState) => {
    if (s.muted) return 0
    const anySolo = stems.some((x) => x.solo)
    if (anySolo) return s.solo ? s.volume : 0
    return s.volume
  }, [stems])

  useEffect(() => {
    extraStemsRef.current = { ...extraStemsStateByType }
  }, [extraStemsStateByType])

  const getExtraGain = useCallback((type: MoreStemsType, s: ExtraStemState) => {
    if (s.muted) return 0
    const list = extraStemsRef.current[type] ?? []
    const anySolo = list.some((x) => x.solo)
    if (anySolo) return s.solo ? s.volume : 0
    return s.volume
  }, [])

  useEffect(() => {
    const byType = extraStemsStateByType
    const mainDrumsSolo = stems.some((s) => s.id === "drums" && s.solo)
    const mainMelodySolo = stems.some((s) => s.id === "other" && s.solo)
    const mainVocalsSolo = stems.some((s) => s.id === "vocals" && s.solo)
    const anyExtraSolo = (byType.drums.some((x) => x.solo) || byType.melodies.some((x) => x.solo) || byType.vocals.some((x) => x.solo))
    const useDrumsSubStems = !mainDrumsSolo && byType.drums.some((x) => !x.muted && x.buffer)
    const useMelodySubStems = !mainMelodySolo && byType.melodies.some((x) => !x.muted && x.buffer)
    const useVocalsSubStems = !mainVocalsSolo && byType.vocals.some((x) => !x.muted && x.buffer)
    stems.forEach((s) => {
      const nodes = sourceNodesRef.current[s.id]
      if (!nodes) return
      if (anyExtraSolo)
        nodes.gain.gain.value = 0
      else if (
        (s.id === "drums" && useDrumsSubStems) ||
        (s.id === "other" && useMelodySubStems) ||
        (s.id === "vocals" && useVocalsSubStems)
      )
        nodes.gain.gain.value = 0
      else nodes.gain.gain.value = getGain(s)
    })
    ;(["drums", "melodies", "vocals"] as const).forEach((type) => {
      byType[type].forEach((s) => {
        const key = `${type}-${s.id}`
        const nodes = extraSourceNodesRef.current[key]
        if (nodes) nodes.gain.gain.value = getExtraGain(type, s)
      })
    })
  }, [stems, extraStemsStateByType, getGain, getExtraGain])

  const drawAllWaveforms = useCallback((playheadProgress: number) => {
    const stemsList = stemsRef.current
    const fallback = canvasSizeRef.current
    stemsList.forEach((s) => {
      const canvas = canvasRefs.current[s.id]
      if (!canvas || !s.buffer) return
      const w = Math.max(1, canvas.offsetWidth || fallback.w)
      const h = Math.max(1, canvas.offsetHeight || fallback.h)
      canvas.width = w
      canvas.height = h
      drawWaveform(canvas, s.buffer, STEM_COLORS[s.id], w, h, playheadProgress)
    })
    const extraByType = extraStemsRef.current
    ;(["drums", "melodies", "vocals"] as const).forEach((type) => {
      const list = extraByType[type] ?? []
      list.forEach((s) => {
        const key = `${type}-${s.id}`
        const canvas = extraCanvasRefs.current[key]
        if (!canvas || !s.buffer) return
        const w = Math.max(1, canvas.offsetWidth || 400)
        const h = Math.max(1, canvas.offsetHeight || 64)
        canvas.width = w
        canvas.height = h
        drawWaveform(canvas, s.buffer, getExtraStemColor(s.id), w, h, playheadProgress)
      })
    })
  }, [])

  const play = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx || stems.length === 0) return
    // Stop any existing playback so all sources start from the same time (no layered/desynced playback)
    const stopNode = ({ source, gain }: { source: AudioBufferSourceNode; gain: GainNode }) => {
      try { source.disconnect(); source.stop() } catch (_) {}
      try { gain.disconnect() } catch (_) {}
    }
    Object.values(sourceNodesRef.current).forEach(stopNode)
    Object.values(extraSourceNodesRef.current).forEach(stopNode)
    sourceNodesRef.current = {}
    extraSourceNodesRef.current = {}
    stoppedManuallyRef.current = false
    const start = pauseTimeRef.current
    const extraByType = extraStemsRef.current
    const stemsList = stemsRef.current
    const mainDrumsSolo = stemsList.some((s) => s.id === "drums" && s.solo)
    const mainMelodySolo = stemsList.some((s) => s.id === "other" && s.solo)
    const mainVocalsSolo = stemsList.some((s) => s.id === "vocals" && s.solo)
    const anyExtraSolo = (extraByType.drums ?? []).some((s) => s.solo) || (extraByType.melodies ?? []).some((s) => s.solo) || (extraByType.vocals ?? []).some((s) => s.solo)
    const useDrumsSubStems = !mainDrumsSolo && (extraByType.drums ?? []).some((s) => !s.muted && s.buffer)
    const useMelodySubStems = !mainMelodySolo && (extraByType.melodies ?? []).some((s) => !s.muted && s.buffer)
    const useVocalsSubStems = !mainVocalsSolo && (extraByType.vocals ?? []).some((s) => !s.muted && s.buffer)
    const extraToPlay: { type: MoreStemsType; s: ExtraStemState }[] = []
    if (anyExtraSolo) {
      ;(["drums", "melodies", "vocals"] as const).forEach((type) => {
        const list = extraByType[type] ?? []
        list.filter((s) => s.buffer && s.solo && !s.muted).forEach((s) => extraToPlay.push({ type, s }))
      })
    } else {
      ;(["drums", "melodies", "vocals"] as const).forEach((type) => {
        const list = extraByType[type] ?? []
        const useSub = type === "drums" ? useDrumsSubStems : type === "melodies" ? useMelodySubStems : useVocalsSubStems
        if (useSub) list.filter((s) => s.buffer && !s.muted).forEach((s) => extraToPlay.push({ type, s }))
      })
    }
    playbackGenerationRef.current += 1
    const thisGeneration = playbackGenerationRef.current
    const totalCount = stems.length + extraToPlay.length
    let ended = 0
    const onOneEnded = () => {
      if (playbackGenerationRef.current !== thisGeneration) return
      ended++
      if (ended >= totalCount) {
        isPlayingRef.current = false
        if (rafIdRef.current != null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        if (!stoppedManuallyRef.current) {
          pauseTimeRef.current = 0
          drawAllWaveforms(0)
        }
        setPlaying(false)
      }
    }
    stems.forEach((s) => {
      if (!s.buffer) return
      const source = ctx.createBufferSource()
      source.buffer = s.buffer
      const gain = ctx.createGain()
      gain.gain.value =
        anyExtraSolo ||
        (s.id === "drums" && useDrumsSubStems) ||
        (s.id === "other" && useMelodySubStems) ||
        (s.id === "vocals" && useVocalsSubStems)
          ? 0
          : getGain(s)
      source.connect(gain)
      gain.connect(ctx.destination)
      source.start(0, start)
      source.onended = onOneEnded
      sourceNodesRef.current[s.id] = { source, gain }
    })
    extraToPlay.forEach(({ type, s }) => {
      if (!s.buffer) return
      const source = ctx.createBufferSource()
      source.buffer = s.buffer
      const gain = ctx.createGain()
      gain.gain.value = getExtraGain(type, s)
      source.connect(gain)
      gain.connect(ctx.destination)
      source.start(0, start)
      source.onended = onOneEnded
      extraSourceNodesRef.current[`${type}-${s.id}`] = { source, gain }
    })
    startTimeRef.current = ctx.currentTime - start
    isPlayingRef.current = true
    setPlaying(true)
    const duration = durationRef.current
    const tick = () => {
      if (!isPlayingRef.current) {
        rafIdRef.current = null
        return
      }
      const elapsed = ctx.currentTime - startTimeRef.current
      const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0
      drawAllWaveforms(progress)
      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(tick)
      }
    }
    rafIdRef.current = requestAnimationFrame(tick)
  }, [stems, getGain, getExtraGain, drawAllWaveforms])

  const stop = useCallback((resetPosition = false) => {
    stoppedManuallyRef.current = !resetPosition
    isPlayingRef.current = false
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    const mainNodes = { ...sourceNodesRef.current }
    const extraNodes = { ...extraSourceNodesRef.current }
    sourceNodesRef.current = {}
    extraSourceNodesRef.current = {}
    const stopNode = ({ source, gain }: { source: AudioBufferSourceNode; gain: GainNode }) => {
      try {
        source.disconnect()
        source.stop()
      } catch (_) {}
      try {
        gain.disconnect()
      } catch (_) {}
    }
    Object.values(mainNodes).forEach(stopNode)
    Object.values(extraNodes).forEach(stopNode)
    if (resetPosition) pauseTimeRef.current = 0
    const duration = durationRef.current
    const playheadProgress = duration > 0 ? pauseTimeRef.current / duration : 0
    drawAllWaveforms(playheadProgress)
    setPlaying(false)
  }, [drawAllWaveforms])

  useEffect(() => {
    if (!pendingSoloMuteRestartRef.current || !isPlayingRef.current) return
    pendingSoloMuteRestartRef.current = false
    const ctx = audioContextRef.current
    if (ctx) pauseTimeRef.current = ctx.currentTime - startTimeRef.current
    stop(false)
    play()
  }, [extraStemsStateByType, stop, play])

  const togglePlayPause = useCallback(() => {
    if (stems.length === 0) return
    if (isPlayingRef.current) {
      const ctx = audioContextRef.current
      if (ctx) pauseTimeRef.current = ctx.currentTime - startTimeRef.current
      stop(false)
    } else {
      play()
    }
  }, [stems.length, play, stop])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return
      const target = e.target as Node
      if (target && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)))
        return
      if (stems.length === 0) return
      e.preventDefault()
      togglePlayPause()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [togglePlayPause, stems.length])

  const seekTo = useCallback((progress: number) => {
    const duration = durationRef.current
    if (duration <= 0) return
    const t = Math.max(0, Math.min(1, progress)) * duration
    pauseTimeRef.current = t
    const p = t / duration
    drawAllWaveforms(p)
    if (isPlayingRef.current) {
      stop(false)
      play()
    }
  }, [drawAllWaveforms, stop, play])

  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = rect.width > 0 ? x / rect.width : 0
    seekTo(progress)
  }, [seekTo])

  const handleExtraWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = e.currentTarget
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const progress = rect.width > 0 ? x / rect.width : 0
      seekTo(progress)
    },
    [seekTo]
  )

  const resetForNewFile = useCallback(() => {
    stop(true)
    setFile(null)
    setStems([])
    setJobId(null)
    jobIdRef.current = null
    setBpm(null)
    setKey(null)
    setError("")
    setDisplayTitleOverride(null)
    setEditingTitle(false)
    setExtraStemsByType({ drums: null, melodies: null, vocals: null })
    setExtraStemsStateByType({ drums: [], melodies: [], vocals: [] })
    setSubStemsOpen({ drums: false, melodies: false, vocals: false })
    setExtraStemsError("")
    setExtraStemsComingSoon(false)
  }, [stop])

  const startEditingTitle = useCallback(() => {
    const current = displayTitleOverride ?? file?.name ?? ""
    setTitleEditValue(current)
    setEditingTitle(true)
  }, [displayTitleOverride, file?.name])

  const saveEditedTitle = useCallback(() => {
    const trimmed = titleEditValue.trim() || (file?.name ?? "")
    setDisplayTitleOverride(trimmed)
    setFile((prev) => (prev ? ({ ...prev, name: trimmed } as File) : null))
    if (jobId) {
      setMySongs((prev) => {
        const next = prev.map((s) => (s.id === jobId ? { ...s, title: trimmed } : s))
        saveMySongsToStorage(next, mySongsStorageKey)
        return next
      })
    }
    setEditingTitle(false)
  }, [jobId, titleEditValue, file?.name, mySongsStorageKey])

  const deleteMySong = useCallback((id: string) => {
    setMySongs((prev) => {
      const next = prev.filter((s) => s.id !== id)
      saveMySongsToStorage(next, mySongsStorageKey)
      return next
    })
  }, [mySongsStorageKey])

  const loadExtraStemBuffers = useCallback(async (type: MoreStemsType, list: { id: string; label: string; url: string }[]) => {
    const ctx = audioContextRef.current ?? new AudioContext()
    if (!audioContextRef.current) audioContextRef.current = ctx
    const loaded: ExtraStemState[] = []
    for (const s of list) {
      try {
        const res = await fetch(s.url)
        const arrayBuffer = await res.arrayBuffer()
        const buffer = await ctx.decodeAudioData(arrayBuffer)
        loaded.push({ ...s, buffer, volume: 1, muted: false, solo: false })
      } catch {
        loaded.push({ ...s, buffer: null, volume: 1, muted: false, solo: false })
      }
    }
    setExtraStemsByType((prev) => ({ ...prev, [type]: { stems: list } }))
    setExtraStemsStateByType((prev) => ({ ...prev, [type]: loaded }))
    setSubStemsOpen((prev) => ({ ...prev, [type]: true }))
  }, [])

  const loadMySong = useCallback(
    async (song: SavedSong) => {
      setError("")
      setLoadingSavedSong(true)
      setExtraStemsByType({ drums: null, melodies: null, vocals: null })
      setExtraStemsStateByType({ drums: [], melodies: [], vocals: [] })
      try {
        const stemsWithUrls = STEM_IDS.map((id) => ({
          id,
          label: id === "vocals" ? "Vocal" : STEM_LABELS[id],
          url: `/api/stems/${song.id}/${id}.wav`,
        }))
        setJobId(song.id)
        jobIdRef.current = song.id
        setBpm(song.bpm)
        setKey(song.key)
        setFile({ name: song.title } as File)
        setDisplayTitleOverride(null)
        await loadStemBuffers(stemsWithUrls)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load stems. The job may have expired.")
      } finally {
        setLoadingSavedSong(false)
      }
      const types = song.extraStemsTypes ?? []
      const openedJobId = song.id
      if (types.length > 0) {
        setExtraStemsLoading(true)
        Promise.all(
          types.map(async (type) => {
            if (jobIdRef.current !== openedJobId) return
            const meta = EXTRA_STEMS_META[type]
            const stems = meta.map(({ id, label }) => ({
              id,
              label,
              url: `/api/stems/${openedJobId}/${id}.wav`,
            }))
            try {
              if (jobIdRef.current !== openedJobId) return
              await loadExtraStemBuffers(type, stems)
            } catch {
              // ignore per-type failures (e.g. 404 if files were removed)
            }
          })
        ).finally(() => setExtraStemsLoading(false))
      }
    },
    [loadStemBuffers, loadExtraStemBuffers]
  )

  const extraDownloadOptions = (["drums", "melodies", "vocals"] as const).flatMap((type) => {
    const list = extraStemsStateByType[type] ?? []
    return list.map((s) => ({ key: `extra:${type}:${s.id}`, label: s.label }))
  })
  const allMainSelected = STEM_IDS.every((id) => downloadStems.has(id))
  const toggleDownloadStem = useCallback((id: string) => {
    if (id === "all") {
      if (allMainSelected) setDownloadStems(new Set())
      else setDownloadStems(new Set(STEM_IDS))
    } else {
      setDownloadStems((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }
  }, [allMainSelected])

  const handleDownloadStems = useCallback(() => {
    if (!jobId || downloadStems.size === 0) return
    const actualExt = "wav"
    const mainIds = STEM_IDS.filter((id) => downloadStems.has(id))
    const extraKeys = Array.from(downloadStems).filter((k) => k.startsWith("extra:"))
    let i = 0
    mainIds.forEach((id) => {
      setTimeout(() => {
        const a = document.createElement("a")
        a.href = `/api/stems/${jobId}/${id}.${actualExt}`
        a.download = `${id}.${actualExt}`
        a.rel = "noopener noreferrer"
        a.click()
      }, (i++) * 200)
    })
    extraKeys.forEach((key) => {
      const [, type, id] = key.split(":")
      if (!type || !id) return
      const list = extraStemsStateByType[type as MoreStemsType] ?? []
      const stem = list.find((s) => s.id === id)
      if (stem?.url) {
        setTimeout(() => {
          const a = document.createElement("a")
          a.href = stem.url
          a.download = `${id}.${actualExt}`
          a.rel = "noopener noreferrer"
          a.click()
        }, (i++) * 200)
      }
    })
    setDownloadOpen(false)
  }, [jobId, downloadStems, downloadFormat, extraStemsStateByType])

  useEffect(() => {
    if (stems.length > 0) setDownloadStems(new Set(STEM_IDS))
  }, [stems.length])

  const handleMoreStemsOption = useCallback(
    async (type: MoreStemsType) => {
      if (!jobId) return
      setMoreStemsOpen(false)
      setExtraStemsError("")
      setExtraStemsComingSoon(false)
      setExtraStemsLoading(true)
      try {
        const res = await fetch("/api/stem-split/more", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, type }),
        })
        const data = await res.json()
        if (!res.ok) {
          setExtraStemsError(data.details ? `${data.error}\n\n${data.details}` : data.error || "Failed")
          return
        }
        if (data.available === false && data.message) {
          setExtraStemsComingSoon(true)
          return
        }
        if (data.available === true && Array.isArray(data.stems) && data.stems.length > 0) {
          await loadExtraStemBuffers(type, data.stems)
          setMySongs((prev) => {
            const next = prev.map((song) =>
              song.id === jobId
                ? { ...song, extraStemsTypes: [...(song.extraStemsTypes ?? []).filter((t) => t !== type), type] }
                : song
            )
            saveMySongsToStorage(next, mySongsStorageKey)
            return next
          })
        }
      } catch (e) {
        setExtraStemsError(e instanceof Error ? e.message : "Request failed")
      } finally {
        setExtraStemsLoading(false)
      }
    },
    [jobId, loadExtraStemBuffers, mySongsStorageKey]
  )

  const updateExtraStem = useCallback((type: MoreStemsType, id: string, patch: Partial<ExtraStemState>) => {
    if ("solo" in patch || "muted" in patch) pendingSoloMuteRestartRef.current = true
    setExtraStemsStateByType((prev) => ({
      ...prev,
      [type]: prev[type].map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }, [])

  useEffect(() => {
    const duration = durationRef.current
    const playheadProgress = duration > 0 ? pauseTimeRef.current / duration : 0
    ;(["drums", "melodies", "vocals"] as const).forEach((type) => {
      const list = extraStemsStateByType[type] ?? []
      list.forEach((s) => {
        const key = `${type}-${s.id}`
        const canvas = extraCanvasRefs.current[key]
        if (canvas && s.buffer) {
          const w = Math.max(1, canvas.offsetWidth || 400)
          const h = Math.max(1, canvas.offsetHeight || 64)
          canvas.width = w
          canvas.height = h
          drawWaveform(canvas, s.buffer, getExtraStemColor(s.id), w, h, playheadProgress)
        }
      })
    })
  }, [extraStemsStateByType])

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="w-full py-2" style={{ background: "#F6F0E8" }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <SiteNav />
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Stem Splitter
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
          Upload a song to split into vocals, drums, bass, and melody. Adjust volume, solo, or mute each stem and download as WAV.
        </p>

        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "#F6F0E9" }}
        >
          {loadingSavedSong ? (
            <div className="py-12 text-center">
              <p className="text-lg font-medium" style={{ color: "var(--foreground)" }}>
                Opening…
              </p>
            </div>
          ) : !stems.length && !processing ? (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${isDragging ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)]"}`}
                style={{ background: isDragging ? "var(--primary)/0.05" : undefined }}
              >
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="stem-file-input"
                />
                <label
                  htmlFor="stem-file-input"
                  className="cursor-pointer block"
                >
                  <p className="text-lg font-medium mb-1" style={{ color: "var(--foreground)" }}>
                    {file ? file.name : "Drag and drop an audio file here, or click to browse"}
                  </p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    MP3, WAV, OGG, FLAC supported
                  </p>
                </label>
              </div>
              {error && (
                <div className="mt-3 text-sm text-red-600 whitespace-pre-wrap max-h-40 overflow-y-auto">{error}</div>
              )}
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!file}
                  className="px-5 py-2.5 rounded-[var(--radius-button)] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                >
                  Split stems
                </button>
                {file && (
                  <button
                    type="button"
                    onClick={() => { setFile(null); setError("") }}
                    className="px-5 py-2.5 rounded-[var(--radius-button)] border font-medium transition"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </>
          ) : processing ? (
            <div className="py-12 text-center">
              <p className="text-lg font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Splitting stems…
              </p>
              <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                This may take a minute depending on track length.
              </p>
              <div
                className="h-2 rounded-full overflow-hidden max-w-md mx-auto"
                style={{ background: "var(--muted-light)" }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${loadingProgress}%`, background: "var(--primary)" }}
                />
              </div>
              <p className="text-sm mt-2 tabular-nums" style={{ color: "var(--muted)" }}>
                {Math.round(loadingProgress)}%
              </p>
            </div>
          ) : (
            <>
              {(file || displayTitleOverride) && (
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {editingTitle ? (
                    <>
                      <input
                        type="text"
                        value={titleEditValue}
                        onChange={(e) => setTitleEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEditedTitle()}
                        className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border text-lg font-medium"
                        style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                        placeholder="Song title"
                        autoFocus
                        aria-label="Edit song title"
                      />
                      <button
                        type="button"
                        onClick={saveEditedTitle}
                        className="px-3 py-2 rounded-lg text-sm font-medium"
                        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium truncate min-w-0" style={{ color: "var(--foreground)" }} title={displayTitleOverride ?? file?.name ?? ""}>
                        {displayTitleOverride ?? file?.name ?? ""}
                      </p>
                      <button
                        type="button"
                        onClick={startEditingTitle}
                        className="shrink-0 p-1 rounded hover:opacity-80 transition"
                        style={{ color: "var(--muted)" }}
                        aria-label="Edit song title"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M14 7l3 3-6 6-3 1 1-3 6-6z" />
                          <path d="M17 4l3 3" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="flex items-center justify-center w-10 h-10 rounded-full border transition"
                  style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>
                <span className="text-sm font-medium tabular-nums" style={{ color: "var(--muted)" }}>
                  {bpm != null ? `${bpm} BPM` : "— BPM"}
                  <span className="mx-1.5" aria-hidden>·</span>
                  Key: {key ?? "—"}
                </span>
                <button
                  type="button"
                  onClick={resetForNewFile}
                  className="text-sm font-medium underline"
                  style={{ color: "var(--muted)" }}
                >
                  New file
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreStemsOpen((o) => !o)}
                    disabled={extraStemsLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-50"
                    style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                    aria-expanded={moreStemsOpen}
                    aria-haspopup="true"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={extraStemsLoading ? "animate-spin" : ""}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    More Stems
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition ${moreStemsOpen ? "rotate-180" : ""}`}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {moreStemsOpen && (
                    <>
                      <div className="absolute left-0 top-full mt-1 z-10 min-w-[280px] rounded-xl border p-2 shadow-lg" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                        <button
                          type="button"
                          onClick={() => handleMoreStemsOption("vocals")}
                          className="w-full flex items-start gap-3 p-3 rounded-lg text-left hover:bg-[var(--muted-light)] transition"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5" aria-hidden>
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                          </svg>
                          <div>
                            <div className="font-medium text-sm" style={{ color: "var(--foreground)" }}>Separate Vocals</div>
                            <div className="text-xs" style={{ color: "var(--muted)" }}>Separate Lead and Background Vocals</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoreStemsOption("drums")}
                          className="w-full flex items-start gap-3 p-3 rounded-lg text-left hover:bg-[var(--muted-light)] transition"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5" aria-hidden>
                            <ellipse cx="12" cy="8" rx="6" ry="2.5" />
                            <path d="M6 8v8c0 1.1 2.69 2 6 2s6-.9 6-2V8" />
                            <ellipse cx="12" cy="16" rx="6" ry="2.5" />
                          </svg>
                          <div>
                            <div className="font-medium text-sm" style={{ color: "var(--foreground)" }}>Separate Drums</div>
                            <div className="text-xs" style={{ color: "var(--muted)" }}>Separate Kick, Snare, Cymbals, and Perc</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoreStemsOption("melodies")}
                          className="w-full flex items-start gap-3 p-3 rounded-lg text-left hover:bg-[var(--muted-light)] transition"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5" aria-hidden>
                            <rect x="2" y="4" width="4" height="16" rx="1" />
                            <rect x="9" y="4" width="4" height="16" rx="1" />
                            <rect x="16" y="4" width="4" height="16" rx="1" />
                          </svg>
                          <div>
                            <div className="font-medium text-sm" style={{ color: "var(--foreground)" }}>Separate Melodies</div>
                            <div className="text-xs" style={{ color: "var(--muted)" }}>Separate Guitar, Piano, Strings, and More</div>
                          </div>
                        </button>
                      </div>
                      <div className="fixed inset-0 z-[9]" aria-hidden onClick={() => setMoreStemsOpen(false)} />
                    </>
                  )}
                </div>
                <div className="relative ml-auto">
                  <button
                    type="button"
                    onClick={() => setDownloadOpen((o) => !o)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium"
                    style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                    aria-expanded={downloadOpen}
                    aria-haspopup="true"
                  >
                    Download
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition ${downloadOpen ? "rotate-180" : ""}`}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {downloadOpen && (
                    <>
                      <div className="absolute right-0 top-full mt-1 z-10 min-w-[220px] rounded-xl border p-3 shadow-lg" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                        <div className="space-y-2 mb-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allMainSelected}
                              onChange={() => toggleDownloadStem("all")}
                              className="rounded border-gray-400 w-4 h-4"
                              style={{ accentColor: "var(--primary)" }}
                            />
                            <span className="text-sm" style={{ color: "var(--foreground)" }}>All (main)</span>
                          </label>
                          {STEM_IDS.map((id) => (
                            <label key={id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={downloadStems.has(id)}
                                onChange={() => toggleDownloadStem(id)}
                                className="rounded border-gray-400 w-4 h-4"
                                style={{ accentColor: "var(--primary)" }}
                              />
                              <span className="text-sm" style={{ color: "var(--foreground)" }}>{id === "vocals" ? "Vocals" : STEM_LABELS[id]}</span>
                            </label>
                          ))}
                          {extraDownloadOptions.length > 0 && (
                            <>
                              <div className="border-t pt-2 mt-2" style={{ borderColor: "var(--border)" }} />
                              {extraDownloadOptions.map(({ key, label }) => (
                                <label key={key} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={downloadStems.has(key)}
                                    onChange={() => toggleDownloadStem(key)}
                                    className="rounded border-gray-400 w-4 h-4"
                                    style={{ accentColor: "var(--primary)" }}
                                  />
                                  <span className="text-sm" style={{ color: "var(--foreground)" }}>{label}</span>
                                </label>
                              ))}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm" style={{ color: "var(--muted)" }}>Format:</span>
                          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                            <button
                              type="button"
                              onClick={() => setDownloadFormat("mp3")}
                              className={`px-3 py-1.5 text-sm font-medium transition ${downloadFormat === "mp3" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : ""}`}
                              style={downloadFormat !== "mp3" ? { color: "var(--muted)" } : undefined}
                            >
                              mp3
                            </button>
                            <button
                              type="button"
                              onClick={() => setDownloadFormat("wav")}
                              className={`px-3 py-1.5 text-sm font-medium transition ${downloadFormat === "wav" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : ""}`}
                              style={downloadFormat !== "wav" ? { color: "var(--muted)" } : undefined}
                            >
                              wav
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadStems}
                          disabled={downloadStems.size === 0}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Download Stems
                        </button>
                      </div>
                      <div
                        className="fixed inset-0 z-[9]"
                        aria-hidden
                        onClick={() => setDownloadOpen(false)}
                      />
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                {stems.map((s) => {
                  const extraType: MoreStemsType | null = s.id === "drums" ? "drums" : s.id === "other" ? "melodies" : s.id === "vocals" ? "vocals" : null
                  const hasSubStems = extraType != null && extraStemsByType[extraType] != null && (extraStemsStateByType[extraType]?.length ?? 0) > 0
                  const list = extraType != null ? (extraStemsStateByType[extraType] ?? []) : []
                  const isSubOpen = extraType != null && subStemsOpen[extraType]
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl p-4 border"
                      style={{ borderColor: "var(--border)", background: "var(--background)" }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium w-16" style={{ color: "var(--foreground)" }}>{s.label}</span>
                        <button
                          type="button"
                          onClick={() => updateStem(s.id, { solo: !s.solo })}
                          className={`text-xs px-2 py-1 rounded ${s.solo ? "opacity-100" : "opacity-60"}`}
                          style={{ background: s.solo ? STEM_COLORS[s.id] : "var(--muted-light)", color: s.solo ? "#fff" : "var(--foreground)" }}
                        >
                          Solo
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStem(s.id, { muted: !s.muted })}
                          className={`text-xs px-2 py-1 rounded ${s.muted ? "opacity-100" : "opacity-60"}`}
                          style={{ background: s.muted ? "var(--muted)" : "var(--muted-light)", color: s.muted ? "#fff" : "var(--foreground)" }}
                        >
                          Mute
                        </button>
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-xs w-8" style={{ color: "var(--muted)" }}>Vol</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={s.volume * 100}
                            onChange={(e) => updateStem(s.id, { volume: Number(e.target.value) / 100 })}
                            className="flex-1 h-2 rounded-full appearance-none"
                            style={{ background: "var(--muted-light)", accentColor: STEM_COLORS[s.id] }}
                          />
                        </div>
                      </div>
                      <canvas
                        ref={(el) => { canvasRefs.current[s.id] = el }}
                        className="w-full h-16 rounded cursor-pointer"
                        style={{ background: "var(--muted-light)" }}
                        onClick={handleWaveformClick}
                        role="slider"
                        aria-label={`Seek ${s.label} waveform`}
                        tabIndex={0}
                      />
                      {hasSubStems && extraType != null && (
                        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                          <button
                            type="button"
                            onClick={() => setSubStemsOpen((prev) => ({ ...prev, [extraType]: !prev[extraType] }))}
                            className="flex items-center gap-2 w-full text-left text-sm font-medium py-1 rounded"
                            style={{ color: "var(--foreground)" }}
                            aria-expanded={isSubOpen}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition ${isSubOpen ? "rotate-90" : ""}`}>
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            {extraType === "drums" ? "Drum sub-stems" : extraType === "vocals" ? "Lead & backing" : "Melody sub-stems"}
                            {list.some((x) => !x.muted) && (
                              <span className="text-xs ml-1" style={{ color: "var(--muted)" }}>(overall stem muted)</span>
                            )}
                          </button>
                          {isSubOpen && (
                            <div className="space-y-3 mt-3 pl-4">
                              {list.map((sub) => (
                                <div
                                  key={sub.id}
                                  className="rounded-lg p-3 border"
                                  style={{ borderColor: "var(--border)", background: "var(--muted-light)" }}
                                >
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="text-sm font-medium w-20" style={{ color: "var(--foreground)" }}>{sub.label}</span>
                                    <button
                                      type="button"
                                      onClick={() => updateExtraStem(extraType, sub.id, { solo: !sub.solo })}
                                      className={`text-xs px-2 py-1 rounded ${sub.solo ? "opacity-100" : "opacity-60"}`}
                                      style={{ background: sub.solo ? getExtraStemColor(sub.id) : "var(--muted)", color: sub.solo ? "#fff" : "var(--foreground)" }}
                                    >
                                      Solo
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateExtraStem(extraType, sub.id, { muted: !sub.muted })}
                                      className={`text-xs px-2 py-1 rounded ${sub.muted ? "opacity-100" : "opacity-60"}`}
                                      style={{ background: sub.muted ? "var(--muted)" : "var(--background)", color: sub.muted ? "#fff" : "var(--foreground)" }}
                                    >
                                      Mute
                                    </button>
                                    <div className="flex-1 flex items-center gap-2">
                                      <span className="text-xs w-8" style={{ color: "var(--muted)" }}>Vol</span>
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={sub.volume * 100}
                                        onChange={(e) => updateExtraStem(extraType, sub.id, { volume: Number(e.target.value) / 100 })}
                                        className="flex-1 h-2 rounded-full appearance-none"
                                        style={{ background: "var(--background)", accentColor: getExtraStemColor(sub.id) }}
                                      />
                                    </div>
                                    <a
                                      href={sub.url}
                                      download={`${sub.id}.wav`}
                                      className="text-xs px-2 py-1 rounded border font-medium"
                                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                                    >
                                      Download
                                    </a>
                                  </div>
                                  {sub.buffer && (
                                    <canvas
                                      ref={(el) => { extraCanvasRefs.current[`${extraType}-${sub.id}`] = el }}
                                      className="w-full h-14 rounded cursor-pointer"
                                      style={{ background: "var(--background)" }}
                                      onClick={handleExtraWaveformClick}
                                      role="slider"
                                      aria-label={`Seek ${sub.label} waveform`}
                                      tabIndex={0}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {extraStemsLoading && (
                <div className="mt-4 py-4 text-center text-sm" style={{ color: "var(--muted)" }}>
                  Processing more stems…
                </div>
              )}
              {extraStemsComingSoon && (
                <div className="mt-4 rounded-xl p-4 border text-sm" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted)" }}>
                  Lead/backing vocal separation coming soon.
                </div>
              )}
              {extraStemsError && (
                <div className="mt-4 rounded-xl p-4 border text-sm text-red-600 whitespace-pre-wrap" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                  {extraStemsError}
                </div>
              )}
            </>
          )}
        </div>

        {/* My Songs - below stem splits, always visible */}
        <section className="pt-10 border-t" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
            My Songs
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Pick one of your songs to view it.
          </p>
          {(() => {
            const searchTrim = mySongsSearch.trim().toLowerCase()
            const [tempoMin, tempoMax] = mySongsTempoRange
            const filtered = mySongs.filter((s) => {
              if (searchTrim && !s.title.toLowerCase().includes(searchTrim)) return false
              if (mySongsKeyFilter && s.key !== mySongsKeyFilter) return false
              if (s.bpm != null && (s.bpm < tempoMin || s.bpm > tempoMax)) return false
              return true
            })
            const uniqueKeys = [...new Set(mySongs.map((s) => s.key).filter(Boolean))] as string[]
            uniqueKeys.sort()
            return (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="relative flex-1 min-w-[200px] max-w-md">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted)]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    </span>
                    <input
                      type="search"
                      placeholder={`Search [${mySongs.length}]`}
                      value={mySongsSearch}
                      onChange={(e) => setMySongsSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm"
                      style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                      aria-label="Search my songs"
                    />
                  </div>
                  <select
                    value={mySongsKeyFilter}
                    onChange={(e) => setMySongsKeyFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-lg border text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                    aria-label="Filter by key"
                  >
                    <option value="">Any key</option>
                    {uniqueKeys.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      Tempo:
                    </label>
                    <input
                      type="number"
                      min={20}
                      max={300}
                      value={tempoMin}
                      onChange={(e) => setMySongsTempoRange(([_, max]) => [Number(e.target.value) || 20, max])}
                      className="w-14 px-2 py-2 rounded-lg border text-sm tabular-nums"
                      style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                      aria-label="Min BPM"
                    />
                    <span style={{ color: "var(--muted)" }}>–</span>
                    <input
                      type="number"
                      min={20}
                      max={300}
                      value={tempoMax}
                      onChange={(e) => setMySongsTempoRange(([min, _]) => [min, Number(e.target.value) || 300])}
                      className="w-14 px-2 py-2 rounded-lg border text-sm tabular-nums"
                      style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                      aria-label="Max BPM"
                    />
                    <span className="text-xs" style={{ color: "var(--muted)" }}>bpm</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-3 rounded-xl p-4 border"
                      style={{ borderColor: "var(--border)", background: "var(--background)" }}
                    >
                      <button
                        type="button"
                        onClick={() => loadMySong(song)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }} title={song.title}>
                          {song.title}
                        </p>
                        <p className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                          {song.bpm != null ? `${song.bpm} bpm` : "—"} {song.key ?? "—"}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMySong(song.id)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border transition hover:opacity-80"
                        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                        aria-label={`Delete ${song.title}`}
                        title="Remove from My Songs"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {filtered.length === 0 && (
                  <p className="text-sm py-6 text-center" style={{ color: "var(--muted)" }}>
                    {mySongs.length === 0 ? "Songs you split will appear here." : "No songs match your filters."}
                  </p>
                )}
              </>
            )
          })()}
        </section>
      </div>
    </div>
  )
}
