"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import SiteNav from "@/components/SiteNav"

type DownloadFormat = "wav" | "mp3"

const STEM_IDS = ["vocals", "drums", "bass", "other"] as const
const STEM_LABELS: Record<(typeof STEM_IDS)[number], string> = {
  vocals: "Vocal",
  drums: "Drums",
  bass: "Bass",
  other: "Other",
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
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [stems, setStems] = useState<StemState[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloadStems, setDownloadStems] = useState<Set<string>>(new Set(STEM_IDS))
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>("wav")
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodesRef = useRef<Record<string, { source: AudioBufferSourceNode; gain: GainNode }>>({})
  const startTimeRef = useRef(0)
  const pauseTimeRef = useRef(0)
  const durationRef = useRef(0)
  const stemsRef = useRef<StemState[]>([])
  const isPlayingRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)
  const stoppedManuallyRef = useRef(false)
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })

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
    setProcessing(true)
    setStems([])
    setJobId(null)
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
      await loadStemBuffers(data.stems)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stem split failed")
    } finally {
      setProcessing(false)
    }
  }, [file, loadStemBuffers])

  useEffect(() => {
    stemsRef.current = stems
    if (stems.length === 0) return
    const duration = stems[0].buffer?.duration ?? 0
    durationRef.current = duration
    const playheadProgress = duration > 0 ? pauseTimeRef.current / duration : 0
    stems.forEach((s) => {
      const canvas = canvasRefs.current[s.id]
      if (canvas && s.buffer) {
        const w = Math.max(1, canvas.offsetWidth || canvasSizeRef.current.w)
        const h = Math.max(1, canvas.offsetHeight || canvasSizeRef.current.h)
        canvasSizeRef.current = { w, h }
        canvas.width = w
        canvas.height = h
        drawWaveform(canvas, s.buffer, STEM_COLORS[s.id], w, h, playheadProgress)
      }
    })
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
    stems.forEach((s) => {
      const nodes = sourceNodesRef.current[s.id]
      if (nodes) nodes.gain.gain.value = getGain(s)
    })
  }, [stems, getGain])

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
  }, [])

  const play = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx || stems.length === 0) return
    stoppedManuallyRef.current = false
    const start = pauseTimeRef.current
    let ended = 0
    const onOneEnded = () => {
      ended++
      if (ended >= stems.length) {
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
      gain.gain.value = getGain(s)
      source.connect(gain)
      gain.connect(ctx.destination)
      source.start(0, start)
      source.onended = onOneEnded
      sourceNodesRef.current[s.id] = { source, gain }
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
  }, [stems, getGain, drawAllWaveforms])

  const stop = useCallback((resetPosition = false) => {
    const ctx = audioContextRef.current
    stoppedManuallyRef.current = !resetPosition
    isPlayingRef.current = false
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    if (ctx) {
      Object.values(sourceNodesRef.current).forEach(({ source }) => {
        try { source.stop() } catch (_) {}
      })
      sourceNodesRef.current = {}
    }
    if (resetPosition) pauseTimeRef.current = 0
    const duration = durationRef.current
    const playheadProgress = duration > 0 ? pauseTimeRef.current / duration : 0
    drawAllWaveforms(playheadProgress)
    setPlaying(false)
  }, [drawAllWaveforms])

  const togglePlayPause = useCallback(() => {
    if (playing) {
      const ctx = audioContextRef.current
      if (ctx) pauseTimeRef.current = ctx.currentTime - startTimeRef.current
      stop()
    } else {
      play()
    }
  }, [playing, play, stop])

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

  const resetForNewFile = useCallback(() => {
    stop(true)
    setFile(null)
    setStems([])
    setJobId(null)
    setError("")
  }, [stop])

  const allSelected = STEM_IDS.every((id) => downloadStems.has(id))
  const toggleDownloadStem = useCallback((id: string) => {
    if (id === "all") {
      if (allSelected) setDownloadStems(new Set())
      else setDownloadStems(new Set(STEM_IDS))
    } else {
      setDownloadStems((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }
  }, [allSelected])

  const handleDownloadStems = useCallback(() => {
    if (!jobId || downloadStems.size === 0) return
    // We only serve WAV from the API; format toggle kept for future MP3 support
    const actualExt = "wav"
    const stemsToDownload = STEM_IDS.filter((id) => downloadStems.has(id))
    stemsToDownload.forEach((id, i) => {
      setTimeout(() => {
        const a = document.createElement("a")
        a.href = `/api/stems/${jobId}/${id}.${actualExt}`
        a.download = `${id}.${actualExt}`
        a.rel = "noopener noreferrer"
        a.click()
      }, i * 200)
    })
    setDownloadOpen(false)
  }, [jobId, downloadStems, downloadFormat])

  useEffect(() => {
    if (stems.length > 0) setDownloadStems(new Set(STEM_IDS))
  }, [stems.length])

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
          Upload a song to split into vocals, drums, bass, and other. Adjust volume, solo, or mute each stem and download as WAV.
          Requires Python with Demucs installed on the server: <code className="text-xs bg-black/10 px-1 rounded">pip install demucs</code>
        </p>

        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "#F6F0E9" }}
        >
          {!stems.length && !processing ? (
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
                <div className="h-full w-full rounded-full animate-loading-bar" />
              </div>
            </div>
          ) : (
            <>
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
                <button
                  type="button"
                  onClick={resetForNewFile}
                  className="text-sm font-medium underline"
                  style={{ color: "var(--muted)" }}
                >
                  New file
                </button>
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
                              checked={allSelected}
                              onChange={() => toggleDownloadStem("all")}
                              className="rounded border-gray-400 w-4 h-4"
                              style={{ accentColor: "var(--primary)" }}
                            />
                            <span className="text-sm" style={{ color: "var(--foreground)" }}>All</span>
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
                {stems.map((s) => (
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
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
