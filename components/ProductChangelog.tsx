"use client"

import { useState } from "react"
import type { ProductRelease } from "@/lib/products"

// How many releases stay visible before the toggle hides the rest.
const VISIBLE = 2

/**
 * Release notes for a product, collapsed to the newest few.
 *
 * Lives in its own client component because /products is an async server
 * component (it reads the session and the purchase rows), and the toggle needs
 * useState. Every release is still rendered into the HTML when expanded, so
 * nothing is fetched on click.
 */
export default function ProductChangelog({ releases }: { releases: ProductRelease[] }) {
  const [expanded, setExpanded] = useState(false)

  if (releases.length === 0) return null

  const shown = expanded ? releases : releases.slice(0, VISIBLE)
  const hasMore = releases.length > VISIBLE

  return (
    <div
      className="mt-5 pt-4 border-t text-xs"
      style={{ borderColor: "var(--border)", color: "var(--foreground)", opacity: 0.55 }}
    >
      <p className="font-semibold mb-2">What&apos;s new</p>
      <div className="space-y-3">
        {shown.map((release) => (
          <div key={release.version}>
            <p className="font-medium mb-1">v{release.version}</p>
            <ul className="list-disc pl-4 space-y-1">
              {release.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 p-0 bg-transparent border-0 text-xs font-medium underline underline-offset-2 cursor-pointer"
          style={{ color: "var(--foreground)" }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}
