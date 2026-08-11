import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { payAccruedViaStripe } from "@/lib/affiliate-stripe"

// Transfers an affiliate's accrued owed balance to their Connect account.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const { id } = await params
  try {
    const payout = await payAccruedViaStripe(id)
    if (!payout) return NextResponse.json({ error: "Nothing owed." }, { status: 400 })
    return NextResponse.json({ payout })
  } catch (e) {
    console.error("[admin stripe payout]", e)
    const message = e instanceof Error ? e.message : "Stripe payout failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
