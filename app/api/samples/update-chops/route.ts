import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

/** PATCH: update chops for an already-saved sample (auto-save when user edits chops). */
export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sampleId, chops } = body
    if (!sampleId) {
      return NextResponse.json({ error: "sampleId is required" }, { status: 400 })
    }

    const { prisma } = await import("@/lib/db")

    const existing = await prisma.userSample.findUnique({
      where: {
        userId_sampleId: {
          userId: session.user.id,
          sampleId: String(sampleId),
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Sample not saved. Save the sample first." },
        { status: 404 }
      )
    }

    const notesValue =
      Array.isArray(chops) && chops.length > 0 ? JSON.stringify(chops) : null

    await prisma.userSample.update({
      where: {
        userId_sampleId: {
          userId: session.user.id,
          sampleId: String(sampleId),
        },
      },
      data: { notes: notesValue },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("[UpdateChops] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update chops" },
      { status: 500 }
    )
  }
}
