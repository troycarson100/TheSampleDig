import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { campaignPreview, claimCampaign, sendCampaignBatch, sendCampaignTest, type Campaign } from "@/lib/member-campaign"

// The admin route for a member campaign (lib/member-campaign.ts): GET is the
// preview, POST takes "test", "claim" and "batch". One per campaign, under
// app/api/admin/offers/<name>/route.ts.
export function campaignRoutes<P>(c: Campaign<P>) {
  async function GET() {
    if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    try {
      return NextResponse.json({ preview: await campaignPreview(c) })
    } catch (error) {
      console.error(`[${c.slug}] preview failed:`, error)
      return NextResponse.json({ error: "Could not work out who the email goes to. Stripe or the database did not answer." }, { status: 502 })
    }
  }

  async function POST(request: Request) {
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
        await sendCampaignTest(c, adminEmail, session.user.id)
      } catch (error) {
        console.error(`[${c.slug}] test send failed:`, error)
        return NextResponse.json({ error: "Test send failed. Check the SMTP settings." }, { status: 500 })
      }
      return NextResponse.json({ ok: true, sentTo: adminEmail })
    }

    if (body.action === "claim") {
      try {
        const result = await claimCampaign(c, adminEmail)
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
        return NextResponse.json({ id: result.id, recipientCount: result.recipientCount })
      } catch (error) {
        // Nothing was written: the row and its list go in together.
        console.error(`[${c.slug}] claim failed:`, error)
        return NextResponse.json({ error: "Could not start the send: Stripe or the database did not answer. Nothing was sent. Try again." }, { status: 502 })
      }
    }

    if (body.action === "batch") {
      if (typeof body.id !== "string") return NextResponse.json({ error: "id is required." }, { status: 400 })
      try {
        return NextResponse.json(await sendCampaignBatch(c, body.id))
      } catch (error) {
        console.error(`[${c.slug}] batch failed:`, error)
        const message = error instanceof Error && /expired|No such/.test(error.message) ? error.message : "Batch failed. Press Resume to pick up where it stopped."
        return NextResponse.json({ error: message }, { status: 500 })
      }
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  }

  return { GET, POST }
}
