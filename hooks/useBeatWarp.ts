"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { BeatDef } from "@/lib/audio/beatLibrary"
import {
  ensureWorkletLoaded,
  loadBeat,
  createWarpedLoop,
  type WarpedLoopControls,
} from "@/lib/audio/beatWarpEngine"
import { getAudioContext } from "@/lib/audio/audioContext"
import { loadCustomBeatAsBuffer } from "@/lib/audio/customBeatsStorage"

export interface UseBeatWarpOptions {
  videoBpm: number | null
}

export function useBeatWarp(options: UseBeatWarpOptions) {
  const { videoBpm } = options
  const [playing, setPlaying] = useState(false)
  const [selectedBeat, setSelectedBeat] = useState<BeatDef | null>(null)
  const [volume, setVolumeState] = useState(0.7)
  const [sync, setSync] = useState(true)
  const [quantizeStart, setQuantizeStartState] = useState(false)
  const [manualBpm, setManualBpm] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [workletReady, setWorkletReady] = useState(false)

  const loopRef = useRef<WarpedLoopControls | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const currentBeatRef = useRef<BeatDef | null>(null)

  const originalBpm = selectedBeat?.originalBpm ?? 0
  const targetBpm = sync
    ? (videoBpm ?? originalBpm)
    : (manualBpm ?? originalBpm)
  const effectiveTargetBpm = targetBpm > 0 ? targetBpm : originalBpm
  const stretchFactor =
    originalBpm > 0 ? effectiveTargetBpm / originalBpm : 1

  const ensureReady = useCallback(async () => {
    if (typeof window === "undefined") return
    try {
      const ctx = await getAudioContext()
      await ensureWorkletLoaded(ctx)
      setWorkletReady(true)
    } catch (e) {
      console.error("Worklet load failed:", e)
      setLoadError("Could not load audio engine. Try refreshing.")
    }
  }, [])

  const selectBeat = useCallback(
    async (beat: BeatDef | null) => {
      if (loopRef.current) {
        loopRef.current.stop()
        loopRef.current = null
      }
      setPlaying(false)
      bufferRef.current = null
      currentBeatRef.current = beat
      setSelectedBeat(beat)
      setLoadError(null)
      if (!beat) return
      try {
        await ensureReady()
        const buffer = beat.customId
          ? await loadCustomBeatAsBuffer(beat.customId)
          : await loadBeat(beat)
        bufferRef.current = buffer
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load beat"
        setLoadError(msg)
      }
    },
    [ensureReady]
  )

  const play = useCallback(async () => {
    const beat = selectedBeat ?? currentBeatRef.current
    if (!beat) return
    try {
      await ensureReady()
    } catch (e) {
      console.error("Beat ensureReady failed:", e)
      setLoadError(e instanceof Error ? e.message : "Audio not ready")
      return
    }
    let buffer = bufferRef.current
    if (!buffer) {
      try {
        buffer = beat.customId
          ? await loadCustomBeatAsBuffer(beat.customId)
          : await loadBeat(beat)
        bufferRef.current = buffer
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load beat")
        return
      }
    }
    if (loopRef.current) loopRef.current.stop()
    try {
      const loop = await createWarpedLoop(
        buffer,
        beat.originalBpm,
        effectiveTargetBpm,
        beat.bars,
        { quantizeStart }
      )
      loop.setVolume(volume)
      loop.setQuantizeStart(quantizeStart)
      loopRef.current = loop
      loop.play()
      setPlaying(true)
      setLoadError(null)
    } catch (e) {
      console.error("Beat play failed:", e)
      setLoadError(e instanceof Error ? e.message : "Playback failed")
    }
  }, [
    selectedBeat,
    effectiveTargetBpm,
    volume,
    quantizeStart,
    ensureReady,
  ])

  const stop = useCallback(() => {
    if (loopRef.current) {
      loopRef.current.stop()
      loopRef.current = null
    }
    setPlaying(false)
  }, [])

  const setVolume = useCallback((v: number) => {
    setVolumeState(v)
    if (loopRef.current) loopRef.current.setVolume(v)
  }, [])

  const setQuantizeStart = useCallback((enabled: boolean) => {
    setQuantizeStartState(enabled)
    if (loopRef.current) loopRef.current.setQuantizeStart(enabled)
  }, [])

  useEffect(() => {
    if (!playing || !loopRef.current) return
    loopRef.current.setTargetBpm(effectiveTargetBpm)
  }, [playing, effectiveTargetBpm])

  useEffect(() => {
    return () => {
      if (loopRef.current) {
        loopRef.current.stop()
        loopRef.current = null
      }
      bufferRef.current = null
    }
  }, [])

  return {
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
    videoBpm,
    targetBpm: effectiveTargetBpm,
    originalBpm,
    stretchFactor,
    loadError,
    workletReady,
  }
}
