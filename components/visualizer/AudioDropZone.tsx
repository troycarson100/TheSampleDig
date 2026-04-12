"use client"

import { useCallback, useRef, useState } from "react"
import { useAudioEngineStore } from "@/hooks/visualizer/useAudioEngine"
import { VIZ_COLORS } from "@/lib/visualizer/constants/design-tokens"

const ACCEPT_ATTR = ".mp3,.wav,.ogg,.flac,.aac,audio/*"

export function AudioDropZone() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const loadFile = useAudioEngineStore((s) => s.loadFile)
  const loadStage = useAudioEngineStore((s) => s.loadStage)
  const loadProgress = useAudioEngineStore((s) => s.loadProgress)
  const errorMessage = useAudioEngineStore((s) => s.errorMessage)

  const onFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0]
      if (file) await loadFile(file)
    },
    [loadFile]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      void onFiles(e.dataTransfer.files)
    },
    [onFiles]
  )

  const busy = loadStage === "reading" || loadStage === "decoding"

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 px-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
        }}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-16 text-center transition-colors"
        style={{
          borderColor: isDragging ? VIZ_COLORS.goldLight : VIZ_COLORS.gold,
          backgroundColor: VIZ_COLORS.bgPanel,
          opacity: busy ? 0.75 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            void onFiles(e.target.files)
            e.target.value = ""
          }}
        />
        <p
          className="text-xl font-normal tracking-tight sm:text-2xl"
          style={{ fontFamily: "var(--font-heading), Georgia, serif", color: VIZ_COLORS.gold }}
        >
          Drop your track here
        </p>
        <p className="mt-2 text-sm" style={{ color: VIZ_COLORS.warmGray }}>
          or click to browse · MP3, WAV, OGG, FLAC, AAC · max 50MB
        </p>
        {busy && (
          <div className="mt-6 w-full max-w-xs">
            <p className="mb-1 text-xs uppercase tracking-wider" style={{ color: VIZ_COLORS.cream }}>
              {loadStage === "reading" ? "Reading file…" : "Decoding audio…"}
            </p>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: VIZ_COLORS.border }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(loadProgress * 100)}%`,
                  backgroundColor: VIZ_COLORS.gold,
                }}
              />
            </div>
          </div>
        )}
      </div>
      {loadStage === "error" && errorMessage && (
        <p className="text-center text-sm" style={{ color: VIZ_COLORS.accent }}>
          {errorMessage}
        </p>
      )}
    </div>
  )
}
