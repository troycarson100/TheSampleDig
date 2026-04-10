"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import ProOfferingContent from "@/components/pro/ProOfferingContent"
import localStyles from "@/components/go-pro-modal.module.css"

export default function GoProModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setError("")
      setLoading(false)
    }
  }, [open])

  const handleCta = async () => {
    setError("")
    if (session?.user?.isPro) {
      onClose()
      return
    }
    if (status !== "authenticated" || !session?.user?.id) {
      const next = pathname || "/dig"
      router.push(`/login?callbackUrl=${encodeURIComponent(next)}`)
      onClose()
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not start checkout")
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setError("No checkout URL returned")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const overlay = (
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="go-pro-modal-title"
    >
      <div
        className="theme-vinyl relative w-full max-w-[960px] min-h-0 rounded-xl shadow-2xl overflow-hidden my-auto border"
        style={{
          background: "var(--ink)",
          borderColor: "rgba(201, 147, 58, 0.12)",
          boxShadow: "0 28px 90px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 w-8 h-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
          style={{ background: "rgba(240,235,225,0.06)", color: "var(--cream)" }}
          aria-label="Close"
        >
          <svg className="w-4 h-4" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <ProOfferingContent
          session={session ?? null}
          status={status}
          loading={loading}
          error={error}
          onCtaClick={handleCta}
          loadingLabel="Redirecting…"
          headingTag="h2"
          headingId="go-pro-modal-title"
        />
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(overlay, document.body)
}
