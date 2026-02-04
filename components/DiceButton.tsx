"use client"

import { useState } from "react"

interface DiceButtonProps {
  onClick: () => void
  loading?: boolean
}

export default function DiceButton({ onClick, loading }: DiceButtonProps) {
  const [isRolling, setIsRolling] = useState(false)

  const handleClick = () => {
    if (loading || isRolling) return
    
    setIsRolling(true)
    onClick()
    
    // Reset rolling state after animation
    setTimeout(() => {
      setIsRolling(false)
    }, 1000)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || isRolling}
      className="relative w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl shadow-2xl transform transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:scale-100 flex items-center justify-center group"
      aria-label="Roll for sample"
    >
      {/* Dice icon - simple design that rotates from center */}
      <div className="relative w-12 h-12 flex items-center justify-center">
        <div 
          className={`w-full h-full flex items-center justify-center ${isRolling || loading ? "animate-spin" : ""}`}
          style={{ transformOrigin: "center center" }}
        >
          <svg
            className="w-full h-full text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Dice square */}
            <rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" fill="none" strokeWidth="2"/>
            {/* Dots - very small circles, positioned precisely */}
            <circle cx="9" cy="9" r="0.7" fill="currentColor"/>
            <circle cx="15" cy="9" r="0.7" fill="currentColor"/>
            <circle cx="9" cy="15" r="0.7" fill="currentColor"/>
            <circle cx="15" cy="15" r="0.7" fill="currentColor"/>
            <circle cx="12" cy="12" r="0.7" fill="currentColor"/>
          </svg>
        </div>
      </div>
      
      {/* Loading overlay */}
      {(loading || isRolling) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </button>
  )
}
