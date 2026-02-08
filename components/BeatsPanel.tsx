"use client"

import { useRef, useCallback, useEffect, useState } from "react"
import { BEATS, customBeatToDef } from "@/lib/audio/beatLibrary"
import type { BeatDef } from "@/lib/audio/beatLibrary"
import { useBeatWarp } from "@/hooks/useBeatWarp"
import {
  listCustomBeats,
  saveCustomBeat,
  type CustomBeatMeta,
} from "@/lib/audio/customBeatsStorage"

const TAP_MAX_TAPS = 4
const ACCEPT_AUDIO = "audio/mpeg,audio/wav,audio/x-wav,audio/aiff,audio/aac,audio/ogg,audio/webm"

function allBeats(customBeats: CustomBeatMeta[]): BeatDef[] {
  return [...BEATS, ...customBeats.map((c) => customBeatToDef(c))]
}

export default function BeatsPanel({ videoBpm }: { videoBpm: number | null }) {
  const tapTimesRef = useRef<number[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [customBeats, setCustomBeats] = useState<CustomBeatMeta[]>([])
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [saveName, setSaveName] = useState("")
  const [saveBpm, setSaveBpm] = useState(90)
  const [saveBars, setSaveBars] = useState(4)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const {
    playing,
    selectedBeat,
    selectBeat,
    play,
    stop,
    volume,
    setVolume,
    sync,
    setSync,
    quantizeStart,
    setQuantizeStart,
    manualBpm,
    setManualBpm,
    targetBpm,
    originalBpm,
    stretchFactor,
    loadError,
  } = useBeatWarp({ videoBpm })

  const refreshCustomBeats = useCallback(async () => {
    try {
      const list = await listCustomBeats()
      setCustomBeats(list)
    } catch {
      setCustomBeats([])
    }
  }, [])

  useEffect(() => {
    refreshCustomBeats()
  }, [refreshCustomBeats])

  const handleTapTempo = useCallback(() => {
    const now = Date.now()
    const taps = tapTimesRef.current
    taps.push(now)
    if (taps.length > TAP_MAX_TAPS) taps.shift()
    const recent = taps.slice(-TAP_MAX_TAPS)
    if (recent.length >= 2) {
      const intervals: number[] = []
      for (let i = 1; i < recent.length; i++) {
        intervals.push((recent[i]! - recent[i - 1]!) / 1000)
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const bpm = avgInterval > 0 ? Math.round(60 / avgInterval) : 0
      if (bpm >= 40 && bpm <= 240) setManualBpm(bpm)
    }
  }, [setManualBpm])

  const handleBeatSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value
      if (!id) {
        selectBeat(null)
        return
      }
      const beat = allBeats(customBeats).find((b) => b.id === id) ?? null
      selectBeat(beat ?? null)
    },
    [selectBeat, customBeats]
  )

  const handleFileChosen = useCallback((file: File) => {
    const isAudio =
      file.type.startsWith("audio/") ||
      /\.(mp3|wav|aac|ogg|m4a|webm|aiff?)$/i.test(file.name)
    if (!isAudio) return
    const base = file.name.replace(/\.[^.]+$/, "") || "Custom loop"
    setSaveName(base)
    setSaveBpm(90)
    setSaveBars(4)
    setPendingFile(file)
    setSaveError(null)
  }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) handleFileChosen(f)
      e.target.value = ""
    },
    [handleFileChosen]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const f = e.dataTransfer.files?.[0]
      if (f) handleFileChosen(f)
    },
    [handleFileChosen]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleSaveLoop = useCallback(async () => {
    if (!pendingFile) return
    setSaving(true)
    setSaveError(null)
    try {
      const meta = await saveCustomBeat({
        name: saveName.trim() || pendingFile.name,
        originalBpm: saveBpm,
        bars: saveBars,
        file: pendingFile,
      })
      await refreshCustomBeats()
      selectBeat(customBeatToDef(meta))
      setPendingFile(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save loop")
    } finally {
      setSaving(false)
    }
  }, [pendingFile, saveName, saveBpm, saveBars, refreshCustomBeats, selectBeat])

  const handleCancelSave = useCallback(() => {
    setPendingFile(null)
    setSaveError(null)
  }, [])

  const showStretchWarning =
    stretchFactor > 0 && (stretchFactor < 0.7 || stretchFactor > 1.4)
  const displayTargetBpm = targetBpm > 0 ? Math.round(targetBpm) : "—"

  return (
    <div
      className="rounded-2xl p-4 w-full mt-4"
      style={{ background: "#F6F0E9" }}
    >
      <h3
        className="text-sm font-semibold mb-3"
        style={{
          color: "var(--foreground)",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        Beat loops
      </h3>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Beat
          </span>
          <select
            value={selectedBeat?.id ?? ""}
            onChange={handleBeatSelect}
            className="rounded-[var(--radius-button)] py-2 pl-3 pr-8 border text-sm w-full"
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
            aria-label="Select beat loop"
          >
            <option value="">— Select —</option>
            {BEATS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            {customBeats.length > 0 && (
              <>
                <option disabled>———</option>
                {customBeats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (saved)
                  </option>
                ))}
              </>
            )}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Add custom loop
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_AUDIO}
            onChange={handleFileInputChange}
            className="hidden"
            aria-hidden
          />
          <div
            role="button"
            tabIndex={0}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            className="rounded-[var(--radius-button)] border-2 border-dashed py-4 px-3 text-center text-sm cursor-pointer transition-colors hover:border-[var(--muted)]"
            style={{
              borderColor: "var(--border)",
              color: "var(--muted)",
            }}
          >
            Drop an audio file here or click to browse
          </div>

          {pendingFile && (
            <div
              className="rounded-lg border p-3 flex flex-col gap-2"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            >
              <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                Save &quot;{pendingFile.name}&quot;
              </span>
              <label className="flex items-center gap-2">
                <span className="text-xs w-14" style={{ color: "var(--muted)" }}>Name</span>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="flex-1 rounded py-1.5 px-2 border text-sm"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs w-14" style={{ color: "var(--muted)" }}>BPM</span>
                <input
                  type="number"
                  min={40}
                  max={240}
                  value={saveBpm}
                  onChange={(e) => setSaveBpm(Number(e.target.value) || 90)}
                  className="w-20 rounded py-1.5 px-2 border text-sm"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs w-14" style={{ color: "var(--muted)" }}>Bars</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={saveBars}
                  onChange={(e) => setSaveBars(Number(e.target.value) || 4)}
                  className="w-20 rounded py-1.5 px-2 border text-sm"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                />
              </label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleSaveLoop}
                  disabled={saving}
                  className="rounded-[var(--radius-button)] py-2 px-3 border text-sm font-medium disabled:opacity-60"
                  style={{
                    background: "var(--primary)",
                    borderColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  {saving ? "Saving…" : "Save loop"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelSave}
                  className="rounded-[var(--radius-button)] py-2 px-3 border text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  Cancel
                </button>
              </div>
              {saveError && (
                <p className="text-xs" style={{ color: "#b91c1c" }}>{saveError}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={play}
            disabled={!selectedBeat}
            className="rounded-[var(--radius-button)] py-2 px-4 border text-sm font-medium disabled:opacity-50"
            style={{
              background: "var(--background)",
              borderColor: "var(--foreground)",
              color: "var(--foreground)",
            }}
          >
            Play
          </button>
          <button
            type="button"
            onClick={stop}
            className="rounded-[var(--radius-button)] py-2 px-4 border text-sm"
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            Stop
          </button>
        </div>

        <label className="flex items-center gap-2">
          <span className="text-xs w-16" style={{ color: "var(--muted)" }}>
            Volume
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-2 rounded-full"
            style={{ accentColor: "var(--primary)" }}
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sync}
            onChange={(e) => setSync(e.target.checked)}
          />
          <span className="text-sm" style={{ color: "var(--foreground)" }}>
            Sync to video BPM
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={quantizeStart}
            onChange={(e) => setQuantizeStart(e.target.checked)}
          />
          <span className="text-sm" style={{ color: "var(--foreground)" }}>
            Quantize start
          </span>
        </label>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span style={{ color: "var(--muted)" }}>Video BPM</span>
          <span className="font-mono">
            {videoBpm != null ? Math.round(videoBpm) : "—"}
          </span>
          <span style={{ color: "var(--muted)" }}>Beat BPM</span>
          <span className="font-mono">
            {selectedBeat ? originalBpm : "—"}
          </span>
          <span style={{ color: "var(--muted)" }}>Target BPM</span>
          <span className="font-mono">{displayTargetBpm}</span>
          <span style={{ color: "var(--muted)" }}>Stretch</span>
          <span className="font-mono">
            {selectedBeat && stretchFactor > 0
              ? stretchFactor.toFixed(2)
              : "—"}
          </span>
        </div>

        {showStretchWarning && (
          <p
            className="text-xs rounded-lg py-2 px-3"
            style={{
              background: "rgba(185, 28, 28, 0.08)",
              borderColor: "rgba(185, 28, 28, 0.3)",
              color: "#b91c1c",
            }}
          >
            Extreme stretch ({" "}
            {stretchFactor.toFixed(2)}
            ). Sound may degrade.
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTapTempo}
            className="rounded-[var(--radius-button)] py-2 px-3 border text-sm"
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            Tap tempo
          </button>
          {manualBpm != null && (
            <span className="text-sm font-mono" style={{ color: "var(--muted)" }}>
              Manual: {manualBpm} BPM
            </span>
          )}
        </div>

        {loadError && (
          <p
            className="text-xs rounded-lg py-2 px-3"
            style={{
              background: "rgba(185, 28, 28, 0.08)",
              color: "#b91c1c",
            }}
          >
            {loadError}
          </p>
        )}
      </div>
    </div>
  )
}
