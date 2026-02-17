"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("App error:", error)
  }, [error])

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FCF7EF",
        color: "#332B25",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#6B6560", marginBottom: 24 }}>
          {error?.message || "An error occurred. Try refreshing."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            background: "#332B25",
            color: "#fff",
            border: "none",
            fontSize: "0.9375rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
