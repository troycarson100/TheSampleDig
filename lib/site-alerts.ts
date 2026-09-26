import { PRICING } from "@/lib/products"

/**
 * In-app alerts (bell popover + optional /alerts archive). Add rows and deploy to broadcast.
 * Users can dismiss an alert (×); dismissed ids persist in localStorage.
 */
export type SiteAlert = {
  id: string
  /** ISO date string YYYY-MM-DD */
  publishedAt: string
  title: string
  /** Optional; blank line between paragraphs if present */
  body?: string
  /** Optional CTA link target (renders a small link when paired with ctaLabel) */
  href?: string
  /** Optional CTA link text */
  ctaLabel?: string
  /** Hide this alert from users who already own shft (via /api/shft/ownership) */
  hideForShftOwners?: boolean
}

export const SITE_ALERTS: SiteAlert[] = [
  {
    id: "discord-server",
    publishedAt: "2026-08-09",
    title: "Join the SampleRoll Discord!",
    body: "Discuss, ask questions, share feedback, and request new features.",
    href: "https://discord.gg/Vzm27vmwp",
    ctaLabel: "Join the Discord",
  },
  {
    id: "three-plugin-bundle",
    publishedAt: "2026-09-25",
    title: `All three plugins — $${PRICING.bundle.price}`,
    body: `shft, drft and fltr together for $${PRICING.bundle.price}, against $${PRICING.bundle.compareAt} at list price.`,
    href: "/plugins",
    ctaLabel: "See the plugins",
  },
  {
    id: "welcome-2026",
    publishedAt: "2026-04-10",
    title: "Welcome to Sample Roll!",
    body: "Dig rare samples, save your crate, and chop with Pro. New updates will appear here.",
  },
]
