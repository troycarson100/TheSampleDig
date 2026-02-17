"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development"
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#FCF7EF", color: "#332B25", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: "0.875rem", color: "#6B6560", marginBottom: 16 }}>
            The app hit an error. Try refreshing the page.
          </p>
          {isDev && error?.message && (
            <pre style={{ fontSize: "0.75rem", textAlign: "left", background: "#EDE9E4", padding: 12, borderRadius: 8, overflow: "auto", marginBottom: 24 }}>
              {error.message}
            </pre>
          )}
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
      </body>
    </html>
  )
}
