/**
 * Meta (Facebook) Pixel config + safe event helper.
 *
 * The pixel is dormant until NEXT_PUBLIC_META_PIXEL_ID is set — nothing loads and
 * trackMeta() no-ops. See components/analytics/MetaPixel.tsx for the loader.
 */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

export const isMetaPixelEnabled = Boolean(META_PIXEL_ID)

export type MetaStandardEvent = "PageView" | "Purchase" | "Subscribe" | "Lead"

type Fbq = (...args: unknown[]) => void

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

/**
 * Fire a standard Meta Pixel event. Safe to call anywhere: no-ops (never throws)
 * during SSR, when the pixel is disabled, or before fbq has loaded.
 */
export function trackMeta(event: MetaStandardEvent, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return
  if (!isMetaPixelEnabled) return
  const fbq = window.fbq
  if (typeof fbq !== "function") return
  if (params) fbq("track", event, params)
  else fbq("track", event)
}
