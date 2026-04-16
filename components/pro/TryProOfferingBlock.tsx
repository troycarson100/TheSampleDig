"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import ProOfferingContent from "@/components/pro/ProOfferingContent"
import { readBonus14OfferSeen } from "@/lib/pro-bonus-trial-seen"

export type TryProOfferingBlockProps = {
  headingTag?: "h1" | "h2"
  headingId?: string
}

export default function TryProOfferingBlock({
  headingTag = "h2",
  headingId = "try-pro-offering-title",
}: TryProOfferingBlockProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubscribe = async () => {
    if (!session?.user?.id) {
      const base = pathname && pathname.startsWith("/") ? pathname : "/pro"
      const join = base.includes("?") ? "&" : "?"
      const next = `${base}${join}tryPro=1`
      router.push(`/login?callbackUrl=${encodeURIComponent(next)}`)
      return
    }
    setError("")
    setLoading(true)
    try {
      const extended = readBonus14OfferSeen()
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: extended ? { "Content-Type": "application/json" } : undefined,
        body: extended ? JSON.stringify({ trialDays: 14 }) : undefined,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not start checkout")
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

  return (
    <ProOfferingContent
      session={session ?? null}
      status={status}
      loading={loading}
      error={error}
      onCtaClick={handleSubscribe}
      loadingLabel="Redirecting to checkout…"
      headingTag={headingTag}
      headingId={headingId}
    />
  )
}
