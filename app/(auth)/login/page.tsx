"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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
        setError("Invalid email or password")
      } else {
        router.push("/dig")
        router.refresh()
      }
    } catch (err) {
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
            <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Password</label>
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
          Don't have an account?{" "}
          <Link href="/register" className="font-medium hover:underline" style={{ color: "var(--foreground)" }}>Register</Link>
        </p>
      </div>
    </div>
  )
}
