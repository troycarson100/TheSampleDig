import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { recordUserActivity } from "@/lib/record-user-activity"

/**
 * GET /api/activity/ping — record a heartbeat and return ok.
 * Call this while logged in to verify activity tracking (e.g. open in browser).
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await recordUserActivity(session.user.id, "heartbeat")
  return NextResponse.json({ ok: true })
}
