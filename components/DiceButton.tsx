"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface DiceButtonProps {
  onClick: () => void
  loading?: boolean
  /** When true, show slow breathing hover-style animation until first click or video loaded */
  breathing?: boolean
}

/** Dice face dot positions (0–5 = faces 1–6) within 40×40 viewBox, 32×32 rect offset by 4 */
const DICE_DOTS: [number, number][][] = [
  [[20, 20]],
  [[14, 14], [26, 26]],
  [[14, 14], [20, 20], [26, 26]],
  [[14, 14], [26, 14], [14, 26], [26, 26]],
  [[14, 14], [26, 14], [20, 20], [14, 26], [26, 26]],
  [[14, 14], [26, 14], [14, 20], [26, 20], [14, 26], [26, 26]],
]

const PARTICLE_COLORS = ["#B85C38", "#D4784E", "#C9933A", "#E8B85A", "#F0EBE1", "#7A7A50"]
const ROLL_DURATION_MS = 650
const LANDED_CLEANUP_MS = 500

export default function DiceButton({ onClick, loading, breathing = false }: DiceButtonProps) {
  const [faceIndex, setFaceIndex] = useState(3) // 4 dots by default
  const [isRolling, setIsRolling] = useState(false)
  const [isLanded, setIsLanded] = useState(false)
  const particlesRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const spawnParticles = useCallback(() => {
    const container = particlesRef.current
    if (!container) return
    container.innerHTML = ""
    const count = 14
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div")
      p.className = "dice-particle"
      const angle = (360 / count) * i + (Math.random() * 20 - 10)
      const dist = 28 + Math.random() * 22
      const rad = (angle * Math.PI) / 180
      p.style.setProperty("--px", `${Math.cos(rad) * dist}px`)
      p.style.setProperty("--py", `${Math.sin(rad) * dist}px`)
      const size = 3 + Math.random() * 3
      p.style.width = `${size}px`
      p.style.height = `${size}px`
      const bg = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]
      p.style.background = bg
      p.style.animationDelay = `${Math.random() * 0.08}s`
      p.style.boxShadow = `0 0 4px ${bg}`
      container.appendChild(p)
      requestAnimationFrame(() => p.classList.add("fire"))
    }
  }, [])

  const fireRing = useCallback(() => {
    const ring = ringRef.current
    if (!ring) return
    ring.classList.remove("fire")
    void ring.offsetWidth
    ring.classList.add("fire")
  }, [])

  const startRoll = useCallback(() => {
    if (isRolling || loading) return
    setIsRolling(true)
    onClick()

    let startTime: number | null = null

    function cycle(timestamp: number) {
      if (startTime === null) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / ROLL_DURATION_MS, 1)
      const interval = 40 + progress * progress * 120

      setFaceIndex(Math.floor(Math.random() * 6))

      if (progress < 1) {
        rollTimeoutRef.current = setTimeout(() => requestAnimationFrame(cycle), interval)
      } else {
        setFaceIndex(Math.floor(Math.random() * 6))
        setIsRolling(false)
        setIsLanded(true)
        spawnParticles()
        fireRing()
        cleanupTimeoutRef.current = setTimeout(() => {
          setIsLanded(false)
        }, LANDED_CLEANUP_MS)
      }
    }
    requestAnimationFrame(cycle)
  }, [loading, isRolling, onClick, spawnParticles, fireRing])

  useEffect(() => {
    return () => {
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current)
      if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current)
    }
  }, [])

  const dots = DICE_DOTS[faceIndex]
  const disabled = loading || isRolling

  return (
    <button
      type="button"
      onClick={startRoll}
      disabled={disabled}
      className={`dice-btn ${isRolling ? "rolling" : ""} ${isLanded ? "landed" : ""} ${breathing ? "breathing" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-label="Roll for sample"
    >
      <svg
        className="dice-icon"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect x="4" y="4" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2.2" fill="none" />
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2.8" fill="currentColor" />
        ))}
      </svg>
      <span className="dice-shine" aria-hidden />
      <div ref={particlesRef} className="dice-particles" aria-hidden />
      <div ref={ringRef} className="dice-ring" aria-hidden />
    </button>
  )
}
