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
    id: "shft-launch-sale-19",
    publishedAt: "2026-07-27",
    title: "shft is here — launch sale $19",
    body: "Our tempo-synced trance-gate plugin just dropped. Grab it for $19 (reg. $39) — a limited launch discount.",
    href: "/shft",
    ctaLabel: "Get shft",
    hideForShftOwners: true,
  },
  {
    id: "welcome-2026",
    publishedAt: "2026-04-10",
    title: "Welcome to Sample Roll!",
    body: "Dig rare samples, save your crate, and chop with Pro. New updates will appear here.",
  },
]
