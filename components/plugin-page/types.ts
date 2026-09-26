import type { ReactNode } from "react"

/** A still or a clip. `poster` is required for video so nothing pops in black. */
export interface Media {
  kind: "image" | "video"
  src: string
  poster?: string
  alt: string
}

export interface FeatureBlock {
  title: string
  body: string
  media?: Media
}

export interface Capability {
  title: string
  body: string
  /** Optional glyph above the title. Renders nothing — no icon, no empty box — when absent. */
  icon?: ReactNode
}

export interface FaqItem {
  q: string
  a: string
}

/** Everything that differs between one product page and another. */
export interface PluginContent {
  hero: {
    /** Small flag above the name, e.g. "out now". */
    badge: string
    description: string
    /** Overrides the default "One-time purchase · free updates" caption under the CTA. */
    caption?: string
    media?: Media
  }
  intro: {
    /** Small label above the title, e.g. "Inside shft". Renders only when present. */
    eyebrow?: string
    title: string
    body: string
    media?: Media
  }
  blocks: FeatureBlock[]
  caps: { title: string; items: Capability[] }
  faq: FaqItem[]
  buy: { title: string; body: string }
}
