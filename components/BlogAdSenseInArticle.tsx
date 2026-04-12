"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import {
  ADSENSE_BLOG_IN_ARTICLE_SLOT,
  ADSENSE_CLIENT_ID,
  BLOG_IN_ARTICLE_ADS_ENABLED,
} from "@/lib/adsense-blog"

/**
 * Google AdSense in-article (fluid) — one slot shared across `/blog/[slug]` posts.
 * Hidden for Pro subscribers (parity with Dig ads).
 */
export function BlogAdSenseInArticle() {
  const { data: session, status } = useSession()
  const pushedRef = useRef(false)

  const isPro = session?.user?.isPro === true
  const slot = ADSENSE_BLOG_IN_ARTICLE_SLOT
  const show =
    BLOG_IN_ARTICLE_ADS_ENABLED && slot && !isPro && status !== "loading"

  useEffect(() => {
    if (!show || pushedRef.current) return
    pushedRef.current = true
    const id = window.requestAnimationFrame(() => {
      try {
        const w = window as unknown as { adsbygoogle?: unknown[] }
        w.adsbygoogle = w.adsbygoogle || []
        w.adsbygoogle.push({})
      } catch {
        /* unfilled until domain approved / policy */
      }
    })
    return () => window.cancelAnimationFrame(id)
  }, [show])

  if (!show) return null

  return (
    <div className="my-6 w-full" aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: "block", textAlign: "center" }}
        data-ad-layout="in-article"
        data-ad-format="fluid"
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
      />
    </div>
  )
}
