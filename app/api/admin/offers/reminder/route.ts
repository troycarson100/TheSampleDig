import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { OFFER_REMINDER } from "@/lib/offer-reminder-logic"
import {
  claimOfferReminder,
  offerReminderPreview,
  sendOfferReminderBatch,
  sendOfferReminderTest,
} from "@/lib/offer-reminder"

/** Who the reminder would go to, both emails, and how far a send has got.
 *  Before a send this asks Stripe which codes have been used, so it takes a
 *  few seconds. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  try {
    return NextResponse.json({ preview: await offerReminderPreview() })
  } catch (error) {
    console.error("[offer reminder] preview failed:", error)
    return NextResponse.json(
      { error: "Could not work out who the reminder goes to. Stripe or the database did not answer." },
      { status: 502 },
    )
  }
}

type Body = {
  // "test"  - both emails to the signed-in admin, with an example code that
  //           works nowhere; nothing is recorded
  // "claim" - start the reminder: fixes who it goes to and snapshots the emails
  // "batch" - mail the next few people on the list
  action?: unknown
  reminderId?: unknown
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
    try {
      await sendOfferReminderTest(adminEmail, session.user.id)
    } catch (error) {
      console.error("[offer reminder] test send failed:", error)
      return NextResponse.json({ error: "Test send failed. Check the SMTP settings." }, { status: 500 })
    }
    return NextResponse.json({ ok: true, sentTo: adminEmail })
  }

  if (body.action === "claim") {
    try {
      const result = await claimOfferReminder(adminEmail)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
      return NextResponse.json({ reminderId: result.reminderId, recipientCount: result.recipientCount })
    } catch (error) {
      // Nothing was written: the reminder and its list go in together.
      console.error("[offer reminder] claim failed:", error)
      return NextResponse.json(
        { error: "Could not start the reminder: Stripe or the database did not answer. Nothing was sent. Try again." },
        { status: 502 },
      )
    }
  }

  if (body.action === "batch") {
    if (typeof body.reminderId !== "string") return NextResponse.json({ error: "reminderId is required." }, { status: 400 })
    const reminder = await prisma.memberOfferReminder.findUnique({ where: { id: body.reminderId }, select: { slug: true } })
    if (!reminder || reminder.slug !== OFFER_REMINDER.slug) return NextResponse.json({ error: "No such reminder." }, { status: 404 })
    try {
      return NextResponse.json(await sendOfferReminderBatch(body.reminderId))
    } catch (error) {
      console.error("[offer reminder] batch failed:", error)
      const message =
        error instanceof Error && /expired/.test(error.message)
          ? error.message
          : "Batch failed. Press Resume to pick up where it stopped."
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
