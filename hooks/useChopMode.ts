"use client"

import { useState, useCallback, useEffect, useRef } from "react"

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

export interface YouTubePlayerAdapter {
  getCurrentTime(): number
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
}

export function useChopMode(
  playerRef: React.RefObject<YouTubePlayerAdapter | null>,
  enabled: boolean,
  videoId?: string | null,
  initialChops?: Chop[] | null,
  onAfterChopPlay?: () => void,
  recordOptions?: UseChopModeRecordOptions
): {
  chops: Chop[]
  clearChops: () => void
  removeChop: (key: string) => void
  addChop: () => void
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
  } = recordOptions ?? {}
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

  const addChop = useCallback(() => {
    if (chops.length >= CHOP_KEYS.length) return
    const adapter = playerRef.current
    if (!adapter) return
    const time = adapter.getCurrentTime()
    if (time < 0) return
    const now = Date.now()
    if (now - lastSpaceRef.current < SPACE_DEBOUNCE_MS) return
    lastSpaceRef.current = now

    const key = CHOP_KEYS[chops.length]
    const color = KEY_COLORS[key] ?? "#666"
    setChops((prev) => [...prev, { key, time, color, index: prev.length }])
  }, [chops.length, playerRef])

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
        const now = Date.now()
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
      const noModifiers = !e.metaKey && !e.ctrlKey && !e.altKey
      if (key === "R" && noModifiers && onRKey) {
        e.preventDefault()
        e.stopPropagation()
        onRKey()
        return
      }

      if (e.code === "Space") {
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
            const now = Date.now()
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

  return { chops, clearChops, removeChop, addChop, slotsFull, onPadKeyPress, updateChopTime, pressedKey }
}
