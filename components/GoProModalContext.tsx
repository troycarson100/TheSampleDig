"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import GoProModal from "@/components/GoProModal"

type GoProModalContextValue = {
  openProModal: () => void
}

const GoProModalContext = createContext<GoProModalContextValue | null>(null)

export function GoProModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const openProModal = useCallback(() => setOpen(true), [])
  const value = useMemo(() => ({ openProModal }), [openProModal])

  return (
    <GoProModalContext.Provider value={value}>
      {children}
      <GoProModal open={open} onClose={() => setOpen(false)} />
    </GoProModalContext.Provider>
  )
}

export function useGoProModal(): GoProModalContextValue {
  const ctx = useContext(GoProModalContext)
  if (!ctx) {
    throw new Error("useGoProModal must be used within GoProModalProvider")
  }
  return ctx
}
