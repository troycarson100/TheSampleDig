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

export interface YouTubePlayerAdapter {
  getCurrentTime(): number
  seekTo(seconds: number): void
  play(): void
}

const SPACE_DEBOUNCE_MS = 250

export function useChopMode(
  playerRef: React.RefObject<YouTubePlayerAdapter | null>,
  enabled: boolean,
  videoId?: string | null
): {
  chops: Chop[]
  clearChops: () => void
  slotsFull: boolean
  onPadKeyPress: (key: string) => void
  updateChopTime: (key: string, time: number) => void
  pressedKey: string | null
} {
  const [chops, setChops] = useState<Chop[]>([])
  const [pressedKey, setPressedKey] = useState<string | null>(null)
  const lastSpaceRef = useRef(0)
  const pressedKeyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (videoId != null) setChops([])
  }, [videoId])

  const clearChops = useCallback(() => {
    setChops([])
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

  const onPadKeyPress = useCallback(
    (key: string) => {
      if (!enabled) return
      const chop = chops.find((c) => c.key === key)
      if (!chop) return
      const adapter = playerRef.current
      if (!adapter) return
      adapter.seekTo(chop.time)
      adapter.play()
      setPressedKeyBriefly(key)
    },
    [enabled, chops, playerRef, setPressedKeyBriefly]
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

      if (e.code === "Space") {
        e.preventDefault()
        e.stopPropagation()
        addChop()
        return
      }

      const key = e.key.toUpperCase()
      if (CHOP_KEYS.includes(key as (typeof CHOP_KEYS)[number])) {
        const chop = chops.find((c) => c.key === key)
        if (chop) {
          e.preventDefault()
          e.stopPropagation()
          const adapter = playerRef.current
          if (adapter) {
            adapter.seekTo(chop.time)
            adapter.play()
            setPressedKeyBriefly(key)
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true })
  }, [enabled, chops, addChop, playerRef, setPressedKeyBriefly])

  const slotsFull = chops.length >= CHOP_KEYS.length

  return { chops, clearChops, slotsFull, onPadKeyPress, updateChopTime, pressedKey }
}
