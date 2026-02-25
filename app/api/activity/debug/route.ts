import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/activity/debug
 * Open this while logged in to see why activity might not be recording.
 * Returns session status and result of inserting one test event.
 */
export async function GET() {
  const out: {
    session: boolean
    userId?: string
    tableExists?: boolean
    insertAttempted: boolean
    insertOk?: boolean
    insertError?: string
  } = { session: false, insertAttempted: false }

  try {
    const session = await auth()
    out.session = !!session
    if (session?.user?.id) out.userId = session.user.id

    if (!session?.user?.id) {
      return NextResponse.json(out)
    }

    // Check table exists (simple count)
    try {
      await prisma.userEvent.count()
      out.tableExists = true
    } catch (e) {
      out.tableExists = false
      out.insertError = "user_events table missing or inaccessible: " + (e instanceof Error ? e.message : String(e))
      return NextResponse.json(out)
    }

    out.insertAttempted = true
    await prisma.userEvent.create({
      data: {
        userId: session.user.id,
        type: "heartbeat",
      },
    })
    out.insertOk = true
    return NextResponse.json(out)
  } catch (e) {
    out.insertAttempted = true
    out.insertOk = false
    out.insertError = e instanceof Error ? e.message : String(e)
    return NextResponse.json(out)
  }
}
