"use client"

import Image from "next/image"
import { useState } from "react"

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, #e07c4a 0%, #d4a574 100%)",
  "linear-gradient(135deg, #9b9bb5 0%, #c9b8a8 100%)",
  "linear-gradient(135deg, #332B25 0%, #6B6560 100%)",
]

type BlogCardImageProps = {
  src: string
  alt: string
  fill?: boolean
  className?: string
  sizes?: string
  priority?: boolean
  gradientIndex?: number
  aspectClass?: string
}

/**
 * Blog hero/card image with fallback. If the image fails to load (e.g. bad URL),
 * shows a gradient placeholder so the layout never breaks.
 * Rule: In lib/blog-posts.ts, every blog post must use a unique imageUrl (no reuse across posts).
 * When adding new URLs, verify each loads in a browser.
 */
export default function BlogCardImage({
  src,
  alt,
  fill = true,
  className = "object-cover",
  sizes,
  priority = false,
  gradientIndex = 0,
  aspectClass = "aspect-[16/10]",
}: BlogCardImageProps) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div
        className={`w-full relative bg-black/5 ${aspectClass}`}
        style={{ background: PLACEHOLDER_GRADIENTS[gradientIndex % PLACEHOLDER_GRADIENTS.length] }}
      />
    )
  }

  return (
    <div className={`w-full relative bg-black/5 ${aspectClass}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        sizes={sizes}
        priority={priority}
        onError={() => setError(true)}
      />
    </div>
  )
}
