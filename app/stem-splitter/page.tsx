"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import SiteNav from "@/components/SiteNav"

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

function drawWaveform(
  canvas: HTMLCanvasElement,
  buffer: AudioBuffer,
  color: string,
  width: number,
  height: number
) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const data = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(data.length / width))
  const amp = height / 2
  const midY = height / 2
  ctx.fillStyle = "var(--muted-light)"
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
}

export default function StemSplitterPage() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [stems, setStems] = useState<StemState[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [playing, setPlaying] = useState(false)
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodesRef = useRef<Record<string, { source: AudioBufferSourceNode; gain: GainNode }>>({})
  const startTimeRef = useRef(0)
  const pauseTimeRef = useRef(0)

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
    if (stems.length === 0) return
    stems.forEach((s, i) => {
      const canvas = canvasRefs.current[s.id]
      if (canvas && s.buffer) {
        const w = canvas.offsetWidth
        const h = canvas.offsetHeight
        canvas.width = w
        canvas.height = h
        drawWaveform(canvas, s.buffer, STEM_COLORS[s.id], w, h)
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

  const play = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx || stems.length === 0) return
    const start = pauseTimeRef.current
    let ended = 0
    const onOneEnded = () => {
      ended++
      if (ended >= stems.length) {
        pauseTimeRef.current = 0
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
    setPlaying(true)
  }, [stems, getGain])

  const stop = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return
    Object.values(sourceNodesRef.current).forEach(({ source }) => {
      try { source.stop() } catch (_) {}
    })
    sourceNodesRef.current = {}
    pauseTimeRef.current = 0
    setPlaying(false)
  }, [])

  const togglePlayPause = useCallback(() => {
    if (playing) {
      const ctx = audioContextRef.current
      if (ctx) pauseTimeRef.current = ctx.currentTime - startTimeRef.current
      stop()
    } else {
      play()
    }
  }, [playing, play, stop])

  const resetForNewFile = useCallback(() => {
    stop()
    setFile(null)
    setStems([])
    setJobId(null)
    setError("")
  }, [stop])

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
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                This may take a minute depending on track length.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
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
                      <a
                        href={s.url}
                        download={`${s.id}.wav`}
                        className="text-xs px-2 py-1 rounded border"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      >
                        WAV
                      </a>
                    </div>
                    <canvas
                      ref={(el) => { canvasRefs.current[s.id] = el }}
                      className="w-full h-16 rounded"
                      style={{ background: "var(--muted-light)" }}
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
