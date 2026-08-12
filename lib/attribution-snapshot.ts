import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { VISITOR_COOKIE } from "@/lib/consent"

export type AttributionSnapshot = {
  attributionVisitorId: string
  attributionReferrerHost: string | null
  attributionUtmSource: string | null
  attributionUtmCampaign: string | null
  attributionLandingPath: string | null
}

/**
 * First-touch attribution for the current request, resolved from the sr_vid
 * cookie. Returns null when there's no cookie or no matching landing event —
 * callers must treat that as "unknown source", never as an error.
 */
export async function readAttributionSnapshot(): Promise<AttributionSnapshot | null> {
  try {
    const cookieStore = await cookies()
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value
    if (!visitorId) return null

    const landing = await prisma.landingEvent.findUnique({
      where: { visitorId },
      select: { referrerHost: true, utmSource: true, utmCampaign: true, landingPath: true },
    })
    if (!landing) return null

    return {
      attributionVisitorId: visitorId,
      attributionReferrerHost: landing.referrerHost,
      attributionUtmSource: landing.utmSource,
      attributionUtmCampaign: landing.utmCampaign,
      attributionLandingPath: landing.landingPath,
    }
  } catch (e) {
    console.error("[attribution snapshot]", e)
    return null
  }
}

/**
 * Same data shaped for Stripe session metadata, so the source is visible on the
 * payment in the Stripe dashboard independent of our database. Stripe caps
 * metadata values at 500 characters; these are all far shorter.
 */
export async function readAttributionMetadata(): Promise<Record<string, string>> {
  const snap = await readAttributionSnapshot()
  if (!snap) return {}
  const meta: Record<string, string> = { attrVisitorId: snap.attributionVisitorId }
  if (snap.attributionReferrerHost) meta.attrReferrer = snap.attributionReferrerHost
  if (snap.attributionUtmSource) meta.attrSource = snap.attributionUtmSource
  if (snap.attributionUtmCampaign) meta.attrCampaign = snap.attributionUtmCampaign
  return meta
}
