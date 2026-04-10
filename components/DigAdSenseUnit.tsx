"use client"

import { useEffect, useRef } from "react"
import { ADSENSE_CLIENT_ID } from "@/lib/adsense-dig"

type Variant = "footer" | "sidebar"

export function DigAdSenseUnit({ adSlot, variant }: { adSlot: string | undefined; variant: Variant }) {
  const pushedRef = useRef(false)

  useEffect(() => {
    if (!adSlot || pushedRef.current) return
    pushedRef.current = true
    const id = window.requestAnimationFrame(() => {
      try {
        const w = window as unknown as { adsbygoogle?: unknown[] }
        w.adsbygoogle = w.adsbygoogle || []
        w.adsbygoogle.push({})
      } catch {
        /* fills only on approved domains */
      }
    })
    return () => window.cancelAnimationFrame(id)
  }, [adSlot])

  const isSidebar = variant === "sidebar"

  if (!adSlot) {
    return (
      <div
        className={`w-full shrink-0 flex flex-col items-center justify-center rounded border border-dashed px-2 ${
          isSidebar ? "py-2" : "py-2.5"
        }`}
        style={{
          borderColor: "var(--border)",
          color: "var(--muted)",
          minHeight: isSidebar ? 52 : 48,
        }}
        aria-label="Advertisement placeholder"
      >
        <span
          className="text-[9px] uppercase tracking-widest"
          style={{ fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace" }}
        >
          Ad
        </span>
        {process.env.NODE_ENV === "development" && (
          <span className="text-[9px] text-center mt-0.5 px-1 opacity-80">
            {isSidebar ? "NEXT_PUBLIC_ADSENSE_DIG_SIDEBAR_SLOT" : "NEXT_PUBLIC_ADSENSE_DIG_FOOTER_SLOT (or DIG_SLOT)"}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`w-full shrink-0 ${isSidebar ? "px-0 py-2" : "py-3"}`}
      aria-label="Advertisement"
    >
      <ins
        className="adsbygoogle"
        style={
          isSidebar
            ? { display: "block", width: "100%", minHeight: "50px" }
            : { display: "block", width: "100%", minHeight: "50px", maxWidth: "728px", margin: "0 auto" }
        }
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
