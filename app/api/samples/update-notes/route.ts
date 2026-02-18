import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

/** PATCH: update user note for an already-saved sample. */
export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sampleId, userNote } = body
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

    const noteStr = typeof userNote === "string" ? userNote : ""
    let notesValue: string

    try {
      const parsed = existing.notes ? (JSON.parse(existing.notes) as unknown) : null
      if (Array.isArray(parsed)) {
        notesValue = JSON.stringify({ chops: parsed, userNote: noteStr })
      } else if (parsed && typeof parsed === "object") {
        notesValue = JSON.stringify({ ...(parsed as Record<string, unknown>), userNote: noteStr })
      } else {
        notesValue = JSON.stringify({ userNote: noteStr })
      }
    } catch {
      notesValue = JSON.stringify({ userNote: noteStr })
    }

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
    console.error("[UpdateNotes] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update notes" },
      { status: 500 }
    )
  }
}
