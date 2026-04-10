"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SiteNav from "@/components/SiteNav"

const PRO_FEATURES = [
  { title: "Save samples", description: "Heart and save any sample to your library. Never lose a find." },
  { title: "My Samples", description: "Your saved samples in one place. Organize, filter by genre or key." },
  { title: "Sample chopping", description: "Chop Mode: mark hit points, trigger chops with pads, build loops." },
  { title: "BPM & key detection", description: "Auto BPM and musical key. Tap tempo, drag to adjust, sync your workflow." },
  { title: "Drum Break mode", description: "Dig filter for drum breaks. Start at the break every time." },
  { title: "Stem Splitter", description: "Separate vocals, drums, bass, melody. Split further into kick, snare, cymbals, and more." },
]

export default function ProPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubscribe = async () => {
    if (!session?.user?.id) {
      router.push("/login?callbackUrl=/pro")
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

  const success = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("success") === "1"
  const canceled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("canceled") === "1"

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="w-full py-2" style={{ background: "#F6F0E8" }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <SiteNav />
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-10 sm:py-14">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-halant), Georgia, serif" }}>
          Sample Roll Pro
        </h1>
        <p className="text-lg text-center mb-4" style={{ color: "var(--muted)" }}>
          Unlock the full toolkit for digging and sampling.
        </p>
        <p className="text-sm text-center max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: "var(--muted)" }}>
          Start with a <strong style={{ color: "var(--foreground)" }}>7-day free trial</strong>. We ask for a card at checkout so your membership can continue seamlessly at{" "}
          <strong style={{ color: "var(--foreground)" }}>$5.99/month</strong> after the trial unless you cancel.
        </p>

        {success && (
          <div className="mb-6 p-4 rounded-xl border text-center" style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.3)", color: "#15803d" }}>
            Thanks for subscribing. You now have full Pro access. Refresh the page if you don’t see it yet.
          </div>
        )}
        {canceled && (
          <div className="mb-6 p-4 rounded-xl border text-center" style={{ background: "var(--muted-light)", borderColor: "var(--border)", color: "var(--muted)" }}>
            Checkout was canceled. You can subscribe anytime below.
          </div>
        )}

        <div className="rounded-2xl p-6 sm:p-8 mb-10" style={{ background: "#F6F0E9" }}>
          <ul className="space-y-5 mb-10">
            {PRO_FEATURES.map((f) => (
              <li key={f.title}>
                <h3 className="font-semibold text-base mb-1" style={{ color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  {f.title}
                </h3>
                <p className="text-sm" style={{ color: "var(--muted)" }}>{f.description}</p>
              </li>
            ))}
          </ul>

          <div className="text-center">
            <p className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
              $5.99<span className="text-lg font-normal" style={{ color: "var(--muted)" }}>/month</span>
            </p>
            <p className="text-sm mb-2" style={{ color: "var(--muted)" }}>7-day free trial, then billed monthly. Cancel anytime before the trial ends to avoid charges.</p>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Card required at signup for seamless continuation after your trial.</p>
            {status === "loading" ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
            ) : !session ? (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/login?callbackUrl=/pro"
                  className="inline-flex justify-center items-center px-6 py-3 rounded-[var(--radius-button)] font-medium transition"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                >
                  Log in to subscribe
                </Link>
                <Link
                  href="/register?callbackUrl=/pro"
                  className="inline-flex justify-center items-center px-6 py-3 rounded-[var(--radius-button)] font-medium border transition"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                >
                  Create account
                </Link>
              </div>
            ) : session.user?.isPro ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>You have Pro access.</p>
            ) : (
              <>
                {error && (
                  <p className="text-sm mb-3" style={{ color: "#b91c1c" }}>{error}</p>
                )}
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="pro-gradient-btn pro-gradient-btn--lg inline-flex justify-center items-center px-8 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Redirecting to checkout…" : "Try Pro Free"}
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
          <Link href="/dig" className="hover:underline" style={{ color: "var(--foreground)" }}>Back to Dig</Link>
        </p>
      </div>
    </div>
  )
}
