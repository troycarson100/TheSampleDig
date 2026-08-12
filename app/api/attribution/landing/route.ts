import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { parseUtm, referrerHost, consentRegionFor } from "@/lib/attribution"
import { VISITOR_COOKIE, VISITOR_MAX_AGE } from "@/lib/consent"

// Noise reduction, not security. Some bots will still get through and that's fine.
const BOT_UA = /bot|crawler|spider|crawl|headless|scrape|preview|monitor|curl|wget/i

/**
 * Records first-touch attribution for a new visitor and reports which consent
 * regime applies. Called once per tab session by the client.
 *
 * Always returns a region — the consent banner depends on this response and
 * must never be left without an answer, so every early return still carries it.
 */
export async function POST(request: Request) {
  const h = await headers()
  const country = h.get("cf-ipcountry")
  const res = NextResponse.json({ region: consentRegionFor(country) })

  try {
    const cookieStore = await cookies()
    if (cookieStore.get(VISITOR_COOKIE)) return res // first touch already recorded

    const ua = h.get("user-agent") || ""
    if (BOT_UA.test(ua)) return res

    let body: { referrer?: unknown; search?: unknown; path?: unknown } = {}
    try {
      body = await request.json()
    } catch {
      /* empty or invalid body — still worth recording the landing */
    }

    const referrer = typeof body.referrer === "string" && body.referrer ? body.referrer.slice(0, 2000) : null
    const search = typeof body.search === "string" ? body.search : ""
    const landingPath = typeof body.path === "string" && body.path ? body.path.slice(0, 512) : "/"

    const visitorId = crypto.randomUUID()

    await prisma.landingEvent.create({
      data: {
        visitorId,
        referrer,
        referrerHost: referrerHost(referrer, h.get("host")),
        landingPath,
        country,
        ...parseUtm(search),
      },
    })

    res.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: VISITOR_MAX_AGE,
      path: "/",
    })
  } catch (e) {
    console.error("[attribution/landing]", e)
  }

  return res
}
