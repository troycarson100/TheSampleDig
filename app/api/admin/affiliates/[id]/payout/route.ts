import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { recordPayout } from "@/lib/affiliate"

// Stamps ALL currently-owed referrals as paid; amount computed server-side.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const { id } = await params
  const body = await request.json().catch(() => null)
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null
  try {
    const payout = await recordPayout(id, note)
    if (!payout) return NextResponse.json({ error: "Nothing owed." }, { status: 400 })
    return NextResponse.json({ payout })
  } catch (e) {
    console.error("[admin payout]", e)
    return NextResponse.json({ error: "Payout failed." }, { status: 500 })
  }
}
