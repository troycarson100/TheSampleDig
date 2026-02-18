"use client"

import Link from "next/link"

export default function PrelaunchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--groove)",
        color: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--font-ibm-mono), monospace",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>Something went wrong</h1>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 24, maxWidth: 360 }}>
        We couldn’t load this page. Try again or come back later.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "12px 20px",
            background: "var(--rust)",
            color: "var(--cream)",
            border: "none",
            borderRadius: 4,
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/prelaunch"
          style={{
            padding: "12px 20px",
            background: "transparent",
            color: "var(--cream)",
            border: "1px solid rgba(240,235,225,0.3)",
            borderRadius: 4,
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Back to prelaunch
        </Link>
      </div>
    </div>
  )
}
