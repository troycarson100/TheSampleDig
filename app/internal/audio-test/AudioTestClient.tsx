"use client"

import { useState, useCallback, useRef } from "react"

const ALLOWED_TYPES = "audio/wav,audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/flac,audio/ogg,audio/aac,.wav,.mp3,.m4a,.flac,.ogg"

export default function AudioTestClient({ secret }: { secret: string | null }) {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle")
  const [result, setResult] = useState<{ bpm: number | null; key: string | null } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type?.startsWith("audio/") || /\.(wav|mp3|m4a|flac|ogg|aac)$/i.test(f?.name ?? "")) {
      setFile(f)
      setStatus("idle")
      setResult(null)
      setErrorMsg(null)
    }
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setStatus("idle")
      setResult(null)
      setErrorMsg(null)
    }
  }, [])

  const onSubmit = useCallback(async () => {
    if (!file) return
    setStatus("uploading")
    setErrorMsg(null)
    setResult(null)
    const form = new FormData()
    form.append("audio", file)
    if (secret) form.append("secret", secret)
    try {
      const res = await fetch("/api/audio/test-analyze", {
        method: "POST",
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(data.error || res.statusText || "Request failed")
        setStatus("error")
        return
      }
      setResult({ bpm: data.bpm ?? null, key: data.key ?? null })
      setStatus("done")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error")
      setStatus("error")
    }
  }, [file, secret])

  const clear = useCallback(() => {
    setFile(null)
    setResult(null)
    setStatus("idle")
    setErrorMsg(null)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center transition-colors hover:border-[var(--muted)]"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES}
          onChange={onFileChange}
          className="sr-only"
          id="audio-upload"
        />
        <label htmlFor="audio-upload" className="cursor-pointer">
          {file ? (
            <p className="text-[var(--foreground)] font-medium">{file.name}</p>
          ) : (
            <p className="text-[var(--muted)]">Drop an audio file here or click to choose</p>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">WAV, MP3, M4A, FLAC, OGG (max 50MB)</p>
        </label>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!file || status === "uploading"}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {status === "uploading" ? "Analyzing…" : "Analyze BPM & Key"}
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-[var(--foreground)]"
        >
          Clear
        </button>
      </div>
      {status === "error" && errorMsg && (
        <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
          {errorMsg}
        </p>
      )}
      {status === "done" && result && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm font-medium text-[var(--muted)]">Result</p>
          <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">
            BPM: {result.bpm ?? "—"} &nbsp; Key: {result.key ?? "—"}
          </p>
        </div>
      )}
    </div>
  )
}
