import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { accountIdByEmail } from "@/lib/account-by-email"
import { sendGiftEmail } from "@/lib/email"
import { mintEmailChangeToken } from "@/lib/email-change"
import { normalizeNewEmail } from "@/lib/email-change-logic"
import { findGiftLink, giftItems, holdsGift } from "@/lib/gift-link"
import { giftCookieName, giftPath, isGiftPlaceholderEmail } from "@/lib/gift-link-logic"
import { SlidingWindowLimiter } from "@/lib/resend-rate-limit"

// "Email me these" on a claimed gift. Sends the keys and downloads to the
// address typed, with a link that saves the gift there. Nothing about the
// account changes until that link is opened (app/api/gift/confirm), so a
// mistyped address adopts nothing.
//
// Proof of holding the gift: its claim token, from this browser's cookie or
// from the private link the page was opened with.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
const HOUR = 60 * 60 * 1000
const perGift = new SlidingWindowLimiter(5, HOUR)
const perIp = new SlidingWindowLimiter(10, HOUR)

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  let body: { email?: unknown; token?: unknown }
  try {
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  const ip =
    request.headers.get("do-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  if (!perIp.allow(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again in an hour." }, { status: 429 })
  }

  const { code } = await params
  const row = await findGiftLink(code)
  const token =
    (typeof body.token === "string" && body.token) ||
    (row ? (await cookies()).get(giftCookieName(row.id))?.value : undefined)
  if (!row || !row.redeemedByUser || !holdsGift(row, token)) {
    return NextResponse.json({ error: "Open your gift link on the device you claimed it on." }, { status: 403 })
  }

  const owner = row.redeemedByUser
  if (!isGiftPlaceholderEmail(owner.email)) {
    return NextResponse.json({ error: `This gift is already saved to ${owner.email}.` }, { status: 409 })
  }
  if (!perGift.allow(row.id)) {
    return NextResponse.json({ error: "Too many requests. Try again in an hour." }, { status: 429 })
  }

  const requested = normalizeNewEmail(body.email)
  if (!requested) return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 })

  try {
    const existingAccount = Boolean(await accountIdByEmail(prisma, requested, owner.id))
    const confirmToken = await mintEmailChangeToken(owner.id, requested)
    const slug = giftPath(row.code).slice("/gift/".length)
    await sendGiftEmail(requested, await giftItems(row), {
      confirmUrl: `${APP_URL}/api/gift/confirm?token=${confirmToken}&gift=${slug}`,
      privateUrl: `${APP_URL}${giftPath(row.code)}?k=${encodeURIComponent(token!)}`,
      message: row.message,
      existingAccount,
    })
  } catch (e) {
    console.error("[gift email] send failed", e)
    return NextResponse.json({ error: "Could not send the email. Try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
