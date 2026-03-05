"use client"

import { useState } from "react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.")
        return
      }

      setSubmitted(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-center mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-halant), Georgia, serif" }}>Sample Roll</h1>
        <h2 className="text-lg font-medium text-center mb-6" style={{ color: "var(--muted)" }}>Forgot Password</h2>

        {submitted ? (
          <div className="space-y-4 text-center">
            <div className="p-4 rounded-xl border text-sm" style={{ background: "rgba(22,163,74,0.08)", borderColor: "rgba(22,163,74,0.3)", color: "#166534" }}>
              Check your inbox — if an account with that email exists, you&apos;ll receive a reset link shortly.{" "}
              <span style={{ opacity: 0.8 }}>If you don&apos;t see it, check your spam folder.</span>
            </div>
            <Link href="/login" className="inline-block text-sm font-medium hover:underline" style={{ color: "var(--muted)" }}>
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl text-sm border" style={{ background: "rgba(185,28,28,0.08)", borderColor: "rgba(185,28,28,0.3)", color: "#b91c1c" }}>{error}</div>
            )}
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-offset-1"
                style={{ background: "var(--muted-light)", borderColor: "var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-[var(--radius-button)] font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--primary)" }}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
              <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--foreground)" }}>Back to login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
