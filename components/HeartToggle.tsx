"use client"

import { useState } from "react"

interface HeartToggleProps {
  isSaved: boolean
  onToggle: () => void
  size?: "sm" | "md" | "lg"
  className?: string
}

export default function HeartToggle({
  isSaved,
  onToggle,
  size = "md",
  className = "",
}: HeartToggleProps) {
  const [isHovered, setIsHovered] = useState(false)

  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`${sizeClasses[size]} ${className} transition-all duration-200 hover:scale-110 active:scale-95`}
      aria-label={isSaved ? "Remove from saved" : "Save sample"}
    >
      <svg
        viewBox="0 0 24 24"
        fill={isSaved ? "#ec4899" : "none"}
        stroke={isSaved ? "#ec4899" : "#ffffff"}
        strokeWidth="2"
        className="w-full h-full drop-shadow-lg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  )
}
