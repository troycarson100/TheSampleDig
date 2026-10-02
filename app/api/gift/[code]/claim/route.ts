import { NextResponse } from "next/server"
import { claimGiftLink, findGiftLink } from "@/lib/gift-link"
import { GIFT_COOKIE_MAX_AGE_S, giftCookieName } from "@/lib/gift-link-logic"
import { SlidingWindowLimiter } from "@/lib/resend-rate-limit"

// The Claim button on /gift/<code>. A POST, never something opening the page
// does: Instagram, iMessage and Slack all fetch a pasted link to draw its
// preview, and a GET that claimed would hand the gift to their crawler.
//
// The token comes back twice: as a cookie, so this browser can reopen the
// plain link, and in the body, for the private link the page offers for the
// recipient's other devices.
const perIp = new SlidingWindowLimiter(20, 60 * 60 * 1000)

const REFUSAL = {
  taken: { status: 409, error: "This gift has already been claimed." },
  revoked: { status: 410, error: "This gift link has been cancelled." },
  expired: { status: 410, error: "This gift link has expired." },
} as const

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const ip =
    request.headers.get("do-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  if (!perIp.allow(ip)) {
    return NextResponse.json({ error: "Too many tries. Try again in an hour." }, { status: 429 })
  }

  const { code } = await params
  const row = await findGiftLink(code)
  if (!row) return NextResponse.json({ error: "We don't recognise that gift link." }, { status: 404 })

  const result = await claimGiftLink(row)
  if (!result.ok) {
    const r = REFUSAL[result.reason]
    return NextResponse.json({ error: r.error, reason: result.reason }, { status: r.status })
  }

  const res = NextResponse.json({ ok: true, token: result.token })
  res.cookies.set(giftCookieName(row.id), result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GIFT_COOKIE_MAX_AGE_S,
  })
  return res
}
