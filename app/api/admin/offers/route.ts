import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { createBulkTransporter, sendMemberOfferEmail } from "@/lib/email"
import { MEMBER_OFFER } from "@/lib/member-offer-logic"
import { claimMemberOffer, memberOfferPreview, sendMemberOfferBatch } from "@/lib/member-offer"
import { unsubscribeUrl } from "@/lib/unsubscribe-token"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

/** Who the offer would go to, the email, and how far a send has got. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  return NextResponse.json({ preview: await memberOfferPreview() })
}

type Body = {
  // "test"  - the real email to the signed-in admin, with an example code that
  //           works nowhere; nothing is made in Stripe or recorded
  // "claim" - start the offer: fixes who it goes to and when it expires
  // "batch" - make codes for and mail the next few people
  action?: unknown
  offerId?: unknown
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  let body: Body
  try {
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }
  const adminEmail = session.user?.email ?? null

  if (body.action === "test") {
    if (!adminEmail || !session.user?.id) return NextResponse.json({ error: "No admin address to send to." }, { status: 400 })
    const preview = await memberOfferPreview()
    const transporter = createBulkTransporter()
    try {
      await sendMemberOfferEmail(transporter, adminEmail, {
        subject: `[TEST] ${preview.subject}`,
        html: preview.bodyHtml,
        // Shaped like a real code, and not one: nothing is made in Stripe for
        // a test, so this is refused anywhere it is tried.
        code: "SR10TEST00",
        unsubscribeUrl: unsubscribeUrl(APP_URL, session.user.id),
      })
    } catch (error) {
      console.error("[offers] test send failed:", error)
      return NextResponse.json({ error: "Test send failed. Check the SMTP settings." }, { status: 500 })
    } finally {
      transporter.close()
    }
    return NextResponse.json({ ok: true, sentTo: adminEmail })
  }

  if (body.action === "claim") {
    try {
      const result = await claimMemberOffer(adminEmail)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
      return NextResponse.json({ offerId: result.offerId })
    } catch (error) {
      // The row is written; the coupon was not. The next batch makes it.
      console.error("[offers] claim failed after the offer was recorded:", error)
      return NextResponse.json({ error: "Started, but Stripe did not answer. Press Resume to carry on." }, { status: 502 })
    }
  }

  if (body.action === "batch") {
    if (typeof body.offerId !== "string") return NextResponse.json({ error: "offerId is required." }, { status: 400 })
    const offer = await prisma.memberOffer.findUnique({ where: { id: body.offerId }, select: { slug: true } })
    if (!offer || offer.slug !== MEMBER_OFFER.slug) return NextResponse.json({ error: "No such offer." }, { status: 404 })
    try {
      return NextResponse.json(await sendMemberOfferBatch(body.offerId))
    } catch (error) {
      console.error("[offers] batch failed:", error)
      const message = error instanceof Error && /expired/.test(error.message) ? error.message : "Batch failed. Press Resume to pick up where it stopped."
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
