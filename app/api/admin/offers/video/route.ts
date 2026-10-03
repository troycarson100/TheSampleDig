import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { claimVideoEmail, sendVideoEmailBatch, sendVideoEmailTest, videoEmailPreview } from "@/lib/video-email"

// The fltr video email, for /admin/offers. Same three actions as the
// reminder's route beside it: test, claim, batch. See lib/video-email.ts.

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  try {
    return NextResponse.json({ preview: await videoEmailPreview() })
  } catch (error) {
    console.error("[video email] preview failed:", error)
    return NextResponse.json({ error: "Could not work out who the email goes to. Stripe or the database did not answer." }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  let body: { action?: unknown; id?: unknown }
  try {
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }
  const adminEmail = session.user?.email ?? null

  if (body.action === "test") {
    if (!adminEmail || !session.user?.id) return NextResponse.json({ error: "No admin address to send to." }, { status: 400 })
    try {
      await sendVideoEmailTest(adminEmail, session.user.id)
    } catch (error) {
      console.error("[video email] test send failed:", error)
      return NextResponse.json({ error: "Test send failed. Check the SMTP settings." }, { status: 500 })
    }
    return NextResponse.json({ ok: true, sentTo: adminEmail })
  }

  if (body.action === "claim") {
    try {
      const result = await claimVideoEmail(adminEmail)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
      return NextResponse.json({ id: result.id, recipientCount: result.recipientCount })
    } catch (error) {
      console.error("[video email] claim failed:", error)
      return NextResponse.json({ error: "Could not start the send: Stripe or the database did not answer. Nothing was sent. Try again." }, { status: 502 })
    }
  }

  if (body.action === "batch") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "id is required." }, { status: 400 })
    try {
      return NextResponse.json(await sendVideoEmailBatch(body.id))
    } catch (error) {
      console.error("[video email] batch failed:", error)
      const message = error instanceof Error && /expired|No such/.test(error.message) ? error.message : "Batch failed. Press Resume to pick up where it stopped."
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
