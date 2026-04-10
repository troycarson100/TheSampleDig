"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import ProOfferingContent from "@/components/pro/ProOfferingContent"

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
      const back = pathname && pathname.startsWith("/") ? pathname : "/pro"
      router.push(`/login?callbackUrl=${encodeURIComponent(back)}`)
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" })
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
