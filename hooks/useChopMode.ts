"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { GridDivision } from "@/lib/grid-quantize"
import { snapToGrid } from "@/lib/grid-quantize"

export const CHOP_KEYS = ["A", "W", "S", "E", "D", "F", "T", "G", "Y", "H", "U", "J", "K", "O", "L"] as const

export const KEY_COLORS: Record<string, string> = {
  A: "#E63946",
  W: "#F4A261",
  S: "#E9C46A",
  E: "#2A9D8F",
  D: "#264653",
  F: "#9B5DE5",
  T: "#00BBF9",
  G: "#00F5D4",
  Y: "#F15BB5",
  H: "#FEE440",
  U: "#7B2CBF",
  J: "#06D6A0",
  K: "#EF476F",
  O: "#118AB2",
  L: "#FFD166",
}

export interface Chop {
  key: string
  time: number
  color: string
  index: number
}

/** One pad hit during recording: key and time offset from record start (ms). */
export interface RecordedChopEvent {
  key: string
  timeMs: number
}

/** Persisted loop for save/restore: recorded sequence + loop range (ms). */
export interface SavedLoopData {
  sequence: RecordedChopEvent[]
  loopStartMs: number
  loopEndMs: number
  fullLengthMs?: number
}

export interface YouTubePlayerAdapter {
  getCurrentTime(): number
  /** Duration in seconds; 0 until video metadata is loaded. */
  getDuration?(): number
  seekTo(seconds: number): void
  play(): void
  pause?(): void
  /** 1 = playing, 2 = paused */
  getPlayerState?(): number
  getVolume?(): number
  setVolume?(volume: number): void
}

const SPACE_DEBOUNCE_MS = 250
/** Soft-start ramp disabled: was muting chops in embedded player. Kept constants for possible future use. */
const CHOP_VOLUME_RAMP_MS = 45
const CHOP_VOLUME_RAMP_STEPS = [0, 0.35, 0.65, 0.88, 1]
const USE_CHOP_VOLUME_RAMP = false

export interface UseChopModeRecordOptions {
  isRecording: boolean
  recordStartTimeRef: React.MutableRefObject<number>
  onRecordPad?: (key: string, timeMs: number) => void
  onSpaceWhenRecording?: () => void
  onRKey?: () => void
  /** Called when addChop runs (Space or button), for UI feedback e.g. space-bar flash */
  onAddChop?: () => void
}

export interface UseChopModeQuantizeOptions {
  enabled: boolean
  bpm: number | null | undefined
  division: GridDivision
  swingPct: number
}

export function useChopMode(
  playerRef: React.RefObject<YouTubePlayerAdapter | null>,
  enabled: boolean,
  videoId?: string | null,
  initialChops?: Chop[] | null,
  onAfterChopPlay?: () => void,
  recordOptions?: UseChopModeRecordOptions,
  quantizeOptions?: UseChopModeQuantizeOptions
): {
  chops: Chop[]
  clearChops: () => void
  removeChop: (key: string) => void
  addChop: () => void
  swapChops: (keyA: string, keyB: string) => void
  slotsFull: boolean
  onPadKeyPress: (key: string) => void
  updateChopTime: (key: string, time: number) => void
  pressedKey: string | null
} {
  const {
    isRecording = false,
    recordStartTimeRef,
    onRecordPad,
    onSpaceWhenRecording,
    onRKey,
    onAddChop,
  } = recordOptions ?? {}
  const quantizeEnabled = !!quantizeOptions?.enabled && !!quantizeOptions?.bpm && quantizeOptions.bpm > 0
  const quantizeBpm = quantizeOptions?.bpm ?? null
  const quantizeDivision = quantizeOptions?.division ?? "1/16"
  const quantizeSwing = quantizeOptions?.swingPct ?? 50
  const [chops, setChops] = useState<Chop[]>([])
  const [pressedKey, setPressedKey] = useState<string | null>(null)
  const lastSpaceRef = useRef(0)
  const pressedKeyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const volumeRampTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (videoId != null) {
      setChops(Array.isArray(initialChops) && initialChops.length > 0 ? initialChops : [])
    }
  }, [videoId, initialChops])

  const clearChops = useCallback(() => {
    setChops([])
  }, [])

  const removeChop = useCallback((key: string) => {
    setChops((prev) =>
      prev
        .filter((c) => c.key !== key)
        .map((c, i) => ({ ...c, index: i }))
    )
  }, [])

  /** Swap the key assignments of two chops. Letters stay in place; we keep each chop's color so colors visually swap pads. */
  const swapChops = useCallback((keyA: string, keyB: string) => {
    if (keyA === keyB) return
    setChops((prev) => {
      const hasA = prev.some((c) => c.key === keyA)
      const hasB = prev.some((c) => c.key === keyB)
      if (!hasA || !hasB) return prev
      return prev
        .map((c) => {
          if (c.key === keyA) return { ...c, key: keyB }
          if (c.key === keyB) return { ...c, key: keyA }
          return c
        })
        .map((c, i) => ({ ...c, index: i }))
    })
  }, [])

  const addChop = useCallback(() => {
    const adapter = playerRef.current
    if (!adapter) return
    let time = adapter.getCurrentTime()
    if (time < 0) return
    const now = Date.now()
    if (now - lastSpaceRef.current < SPACE_DEBOUNCE_MS) return
    lastSpaceRef.current = now

    if (quantizeEnabled && quantizeBpm) {
      const snappedMs = snapToGrid(time * 1000, quantizeBpm, quantizeDivision, quantizeSwing)
      time = Math.max(0, snappedMs / 1000)
    }

    setChops((prev) => {
      const usedKeys = new Set(prev.map((c) => c.key))
      const key = CHOP_KEYS.find((k) => !usedKeys.has(k))
      if (!key) return prev
      const color = KEY_COLORS[key] ?? "#666"
      return [...prev, { key, time, color, index: prev.length }]
    })
    onAddChop?.()
  }, [playerRef, onAddChop, quantizeEnabled, quantizeBpm, quantizeDivision, quantizeSwing])

  const setPressedKeyBriefly = useCallback((key: string) => {
    if (pressedKeyTimeoutRef.current) clearTimeout(pressedKeyTimeoutRef.current)
    setPressedKey(key)
    pressedKeyTimeoutRef.current = setTimeout(() => {
      setPressedKey(null)
      pressedKeyTimeoutRef.current = null
    }, 220)
  }, [])

  const playChopAt = useCallback(
    (time: number) => {
      const adapter = playerRef.current
      if (!adapter) return
      const state = adapter.getPlayerState?.()
      const isPaused = state === 2

      if (USE_CHOP_VOLUME_RAMP && isPaused && adapter.setVolume && adapter.getVolume) {
        try {
          const prevVolume = adapter.getVolume()
          const targetVolume = prevVolume > 0 ? prevVolume : 100
          volumeRampTimeoutsRef.current.forEach((t) => clearTimeout(t))
          volumeRampTimeoutsRef.current = []
          adapter.setVolume(0)
          adapter.seekTo(time)
          adapter.play()
          onAfterChopPlay?.()
          const stepMs = CHOP_VOLUME_RAMP_MS / (CHOP_VOLUME_RAMP_STEPS.length - 1)
          CHOP_VOLUME_RAMP_STEPS.forEach((frac, i) => {
            if (i === 0) return
            const t = setTimeout(() => {
              try {
                if (adapter.setVolume) adapter.setVolume(Math.round(targetVolume * frac))
              } catch (_) {}
            }, i * stepMs)
            volumeRampTimeoutsRef.current.push(t)
          })
          const clearRef = setTimeout(() => {
            volumeRampTimeoutsRef.current = volumeRampTimeoutsRef.current.filter((x) => x !== clearRef)
          }, CHOP_VOLUME_RAMP_MS + 10)
          volumeRampTimeoutsRef.current.push(clearRef)
        } catch (_) {
          volumeRampTimeoutsRef.current.forEach((t) => clearTimeout(t))
          volumeRampTimeoutsRef.current = []
          adapter.seekTo(time)
          if (isPaused) adapter.play()
          onAfterChopPlay?.()
        }
      } else {
        adapter.seekTo(time)
        if (isPaused) adapter.play()
        onAfterChopPlay?.()
      }
    },
    [playerRef, onAfterChopPlay]
  )

  const onPadKeyPress = useCallback(
    (key: string) => {
      if (!enabled) return
      const chop = chops.find((c) => c.key === key)
      if (!chop) return
      if (isRecording && onRecordPad && recordStartTimeRef) {
        const now = performance.now()
        const isFirst = recordStartTimeRef.current === 0
        if (isFirst) recordStartTimeRef.current = now
        onRecordPad(key, isFirst ? 0 : now - recordStartTimeRef.current)
      }
      playChopAt(chop.time)
      setPressedKeyBriefly(key)
    },
    [enabled, chops, playChopAt, setPressedKeyBriefly, isRecording, onRecordPad, recordStartTimeRef]
  )

  const updateChopTime = useCallback((key: string, time: number) => {
    if (time < 0) return
    setChops((prev) =>
      prev.map((c) => (c.key === key ? { ...c, time } : c))
    )
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

      const key = e.key.toUpperCase()
      const noModifiers = !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey
      if (key === "R" && noModifiers && onRKey) {
        e.preventDefault()
        e.stopPropagation()
        onRKey()
        return
      }

      // Plain Space (no modifiers) = chop / stop-record
      if (e.code === "Space" && noModifiers) {
        e.preventDefault()
        e.stopPropagation()
        if (isRecording && onSpaceWhenRecording) {
          onSpaceWhenRecording()
          return
        }
        addChop()
        return
      }

      if (CHOP_KEYS.includes(key as (typeof CHOP_KEYS)[number])) {
        const chop = chops.find((c) => c.key === key)
        if (chop) {
          e.preventDefault()
          e.stopPropagation()
          if (isRecording && onRecordPad && recordStartTimeRef) {
            const now = performance.now()
            const isFirst = recordStartTimeRef.current === 0
            if (isFirst) recordStartTimeRef.current = now
            onRecordPad(key, isFirst ? 0 : now - recordStartTimeRef.current)
          }
          playChopAt(chop.time)
          setPressedKeyBriefly(key)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true })
  }, [enabled, chops, addChop, playChopAt, setPressedKeyBriefly, isRecording, onRecordPad, onSpaceWhenRecording, onRKey, recordStartTimeRef])

  const slotsFull = chops.length >= CHOP_KEYS.length

  return { chops, clearChops, removeChop, addChop, swapChops, slotsFull, onPadKeyPress, updateChopTime, pressedKey }
}
