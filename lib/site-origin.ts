/**
 * Canonical site origin for sitemap, robots, and absolute URLs.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://sampleroll.com).
 */
export function getSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "")
  if (explicit) return explicit
  const vercel = process.env.VERCEL_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "")
  if (vercel) return `https://${vercel}`
  return "http://localhost:3000"
}
