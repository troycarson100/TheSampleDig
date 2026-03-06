"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const registered = searchParams.get("registered") === "true"
  const needsVerification = searchParams.get("needsVerification") !== "false"
  const reset = searchParams.get("reset") === "true"
  const unverified = searchParams.get("unverified") === "true"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        const check = await fetch("/api/auth/check-unverified", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }).then((r) => r.json()).catch(() => ({ unverified: false }))

        if (check.unverified) {
          setError("Please verify your email before logging in. Check your inbox — and your spam folder if you don't see it.")
        } else {
          setError("Invalid email or password")
        }
      } else {
        router.push("/dig")
        router.refresh()
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-center mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-halant), Georgia, serif" }}>Sample Roll</h1>
        <h2 className="text-lg font-medium text-center mb-6" style={{ color: "var(--muted)" }}>Login</h2>

        {registered && (
          <div className="mb-4 p-3 rounded-xl text-sm border" style={{ background: "rgba(22,163,74,0.08)", borderColor: "rgba(22,163,74,0.3)", color: "#166534" }}>
            {needsVerification ? (
              <>
                Account created! Check your email to verify your account before logging in.{" "}
                <span style={{ color: "#166534", opacity: 0.8 }}>If you don&apos;t see it, check your spam folder.</span>
              </>
            ) : (
              <>
                Account created! Email verification is temporarily unavailable, so you can log in now.
              </>
            )}
          </div>
        )}
        {reset && (
          <div className="mb-4 p-3 rounded-xl text-sm border" style={{ background: "rgba(22,163,74,0.08)", borderColor: "rgba(22,163,74,0.3)", color: "#166534" }}>
            Password updated successfully. You can now log in.
          </div>
        )}
        {unverified && (
          <div className="mb-4 p-3 rounded-xl text-sm border" style={{ background: "rgba(234,179,8,0.1)", borderColor: "rgba(234,179,8,0.4)", color: "#854d0e" }}>
            Please verify your email before logging in. Check your inbox for the confirmation link — and your spam folder if you don&apos;t see it.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl text-sm border" style={{ background: "rgba(185,28,28,0.08)", borderColor: "rgba(185,28,28,0.3)", color: "#b91c1c" }}>{error}</div>
          )}
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
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-sm font-medium" style={{ color: "var(--foreground)" }}>Password</label>
              <Link href="/forgot-password" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm" style={{ color: "var(--muted)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium hover:underline" style={{ color: "var(--foreground)" }}>Register</Link>
        </p>
      </div>
    </div>
  )
}
