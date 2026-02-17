"use client"

import { useState, useEffect } from "react"

export default function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) {
    return (
      <div
        className="flex flex-col min-h-screen items-center justify-center"
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    )
  }
  return <>{children}</>
}
