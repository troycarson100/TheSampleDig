"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  // Set from a purchase receipt or the thanks page: the account was created
  // by a guest checkout and this is the buyer's first password, not a reset.
  const welcome = searchParams.get("welcome") === "1"
  const router = useRouter()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    if (!token) {
      setError("Invalid reset link. Please request a new one.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.")
        return
      }

      router.push(welcome ? "/login?reset=true&callbackUrl=%2Fproducts" : "/login?reset=true")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--background)" }}>
        <div className="w-full max-w-md p-8 text-center space-y-4">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "var(--font-halant), Georgia, serif" }}>Sample Roll</h1>
          <div className="p-4 rounded-xl border text-sm" style={{ background: "rgba(185,28,28,0.08)", borderColor: "rgba(185,28,28,0.3)", color: "#b91c1c" }}>
            Invalid reset link. Please request a new one.
          </div>
          <Link href="/forgot-password" className="inline-block text-sm font-medium hover:underline" style={{ color: "var(--foreground)" }}>
            Request new reset link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-center mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-halant), Georgia, serif" }}>Sample Roll</h1>
        <h2 className={`text-lg font-medium text-center ${welcome ? "mb-2" : "mb-6"}`} style={{ color: "var(--muted)" }}>
          {welcome ? "Set your password" : "Reset Password"}
        </h2>
        {welcome && (
          <p className="text-sm text-center mb-6" style={{ color: "var(--muted)" }}>
            Your account was created when you bought a plugin. Choose a password to sign in and
            see your downloads on My Products.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl text-sm border" style={{ background: "rgba(185,28,28,0.08)", borderColor: "rgba(185,28,28,0.3)", color: "#b91c1c" }}>{error}</div>
          )}
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>New password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-offset-1"
              style={{ background: "var(--muted-light)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Confirm new password</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
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
            {loading ? (welcome ? "Saving…" : "Updating…") : welcome ? "Set password" : "Set new password"}
          </button>
          <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
            <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--foreground)" }}>Back to login</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
