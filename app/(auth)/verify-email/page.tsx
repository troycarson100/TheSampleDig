"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    if (!token) {
      setStatus("error")
      setMessage("No verification token found. Please use the link from your email.")
      return
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setStatus("error")
          setMessage(data.error)
        } else {
          setStatus("success")
          setMessage(data.message || "Email verified successfully. You can now sign in.")
        }
      })
      .catch(() => {
        setStatus("error")
        setMessage("Something went wrong. Please try again.")
      })
  }, [token])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-halant), Georgia, serif" }}>Sample Roll</h1>
        <h2 className="text-lg font-medium mb-6" style={{ color: "var(--muted)" }}>Email Verification</h2>

        {status === "loading" && (
          <p style={{ color: "var(--muted)" }}>Verifying your email…</p>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border text-sm" style={{ background: "rgba(22,163,74,0.08)", borderColor: "rgba(22,163,74,0.3)", color: "#166534" }}>
              {message}
            </div>
            <Link href="/login" className="inline-block w-full py-2.5 rounded-[var(--radius-button)] font-medium text-white text-center transition" style={{ background: "var(--primary)" }}>
              Sign in
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border text-sm" style={{ background: "rgba(185,28,28,0.08)", borderColor: "rgba(185,28,28,0.3)", color: "#b91c1c" }}>
              {message}
            </div>
            <Link href="/register" className="inline-block w-full py-2.5 rounded-[var(--radius-button)] font-medium text-center transition border" style={{ color: "var(--foreground)", borderColor: "var(--border)" }}>
              Back to register
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
