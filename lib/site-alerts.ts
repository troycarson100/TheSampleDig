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
}

export const SITE_ALERTS: SiteAlert[] = [
  {
    id: "welcome-2026",
    publishedAt: "2026-04-10",
    title: "Welcome to Sample Roll!",
    body: "Dig rare samples, save your crate, and chop with Pro. New updates will appear here.",
  },
]
