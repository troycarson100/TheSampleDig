import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendEmailChangeConfirmEmail } from "@/lib/email"
import { mintEmailChangeToken } from "@/lib/email-change"
import {
  decideEmailChange,
  normalizeNewEmail,
  EMAIL_CHANGE_REFUSAL,
} from "@/lib/email-change-logic"
import { isCompProduct } from "@/lib/plugin-products"
import { buyerLookupFor, isAccountFromSession } from "@/lib/plugin-purchase-logic"
import { SlidingWindowLimiter } from "@/lib/resend-rate-limit"
import { mintSetPasswordUrl } from "@/lib/set-password"

// Ask to move an account to a different email address. Nothing changes here:
// we record the request and email a confirmation link to the NEW address, so a
// mistyped one simply never gets adopted.
//
// Two ways to prove you own the account:
//   a signed-in session, or
//   the Stripe checkout session id of a purchase that CREATED the account -
//   the same not-withheld rule /api/plugins/claim uses before it shows keys.
//   A session id for an account that predates the checkout proves nothing
//   about owning it, so it is refused here too.
const HOUR = 60 * 60 * 1000
const perAccount = new SlidingWindowLimiter(3, HOUR)
const perIp = new SlidingWindowLimiter(10, HOUR)

type Owner = { id: string; email: string; passwordSetAt: Date | null }

/** The account this caller has proven they own, or null. */
async function resolveOwner(sessionId: unknown): Promise<Owner | null> {
  const session = await auth()
  if (session?.user?.id) {
    return prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, passwordSetAt: true },
    })
  }

  if (typeof sessionId !== "string" || !sessionId) return null
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return null

  try {
    const checkout = await new Stripe(secret).checkout.sessions.retrieve(sessionId)
    const settled =
      checkout.payment_status === "paid" || checkout.payment_status === "no_payment_required"
    if (!settled || !isCompProduct(checkout.metadata?.product)) return null

    const lookup = buyerLookupFor(checkout)
    const user =
      lookup.kind === "user"
        ? await prisma.user.findUnique({
            where: { id: lookup.id },
            select: { id: true, email: true, passwordSetAt: true, createdAt: true },
          })
        : lookup.kind === "email"
          ? await prisma.user.findFirst({
              where: { email: { equals: lookup.email, mode: "insensitive" } },
              select: { id: true, email: true, passwordSetAt: true, createdAt: true },
            })
          : null
    if (!user) return null
    // Only an account this checkout created. Anything older belongs to someone
    // who was already here.
    if (!isAccountFromSession(user.createdAt, checkout.created)) return null
    return { id: user.id, email: user.email, passwordSetAt: user.passwordSetAt }
  } catch (e) {
    console.error("[email-change] stripe lookup failed", e)
    return null
  }
}

export async function POST(request: Request) {
  let body: { newEmail?: unknown; sessionId?: unknown }
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

  const owner = await resolveOwner(body.sessionId)
  if (!owner) {
    return NextResponse.json({ error: "Please sign in to change your email." }, { status: 401 })
  }
  if (!perAccount.allow(owner.id)) {
    return NextResponse.json({ error: "Too many requests. Try again in an hour." }, { status: 429 })
  }

  const requested = normalizeNewEmail(body.newEmail)
  const taken = requested
    ? Boolean(
        await prisma.user.findFirst({
          where: { email: { equals: requested, mode: "insensitive" }, id: { not: owner.id } },
          select: { id: true },
        }),
      )
    : false

  const decision = decideEmailChange(owner.email, requested, taken)
  if (decision.action === "refuse") {
    return NextResponse.json(
      { error: EMAIL_CHANGE_REFUSAL[decision.reason], reason: decision.reason },
      { status: decision.reason === "taken" ? 409 : 400 },
    )
  }

  try {
    const token = await mintEmailChangeToken(owner.id, requested!)
    const setPasswordUrl = owner.passwordSetAt === null ? await mintSetPasswordUrl(owner.id) : null
    await sendEmailChangeConfirmEmail(requested!, {
      token,
      currentEmail: owner.email,
      setPasswordUrl,
    })
  } catch (e) {
    // The pending row may already be written. Surfacing the failure is right:
    // the caller is waiting on an email that is not coming, and telling them
    // to retry is more useful than a silent success.
    console.error("[email-change] request failed", e)
    return NextResponse.json({ error: "Could not send the confirmation. Try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
