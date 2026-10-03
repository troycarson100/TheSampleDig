"use client"

import { useEffect, useRef } from "react"

/**
 * Calls `onRestore` when the browser brings this page back from its
 * back/forward cache - the Back button from Stripe Checkout, most often.
 *
 * A button that says "…" while it sends the buyer to Stripe never resets on
 * its own: the redirect means nothing after it runs. Restored from the cache,
 * the page comes back exactly as it was left, so the button sat at "…",
 * disabled, until a refresh (2026-10-03). Restoring is the moment to put it
 * back.
 */
export function usePageRestore(onRestore: () => void) {
  const latest = useRef(onRestore)
  useEffect(() => {
    latest.current = onRestore
  })
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) latest.current()
    }
    window.addEventListener("pageshow", onShow)
    return () => window.removeEventListener("pageshow", onShow)
  }, [])
}
