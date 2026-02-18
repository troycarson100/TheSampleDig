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
    const { sampleId, chops, loop: loopFromBody } = body
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

    // Build valid loop from body or preserve existing
    const loopStartNum = loopFromBody?.loopStartMs != null ? Number(loopFromBody.loopStartMs) : NaN
    const loopEndNum = loopFromBody?.loopEndMs != null ? Number(loopFromBody.loopEndMs) : NaN
    const loopValid =
      loopFromBody &&
      Array.isArray(loopFromBody?.sequence) &&
      loopFromBody.sequence.length > 0 &&
      !Number.isNaN(loopStartNum) &&
      !Number.isNaN(loopEndNum) &&
      loopEndNum > loopStartNum
    const loopData = loopValid
      ? {
          sequence: loopFromBody.sequence,
          loopStartMs: loopStartNum,
          loopEndMs: loopEndNum,
          fullLengthMs:
            loopFromBody.fullLengthMs != null && !Number.isNaN(Number(loopFromBody.fullLengthMs))
              ? Number(loopFromBody.fullLengthMs)
              : undefined,
        }
      : null

    // Merge chops + loop + userNote: preserve userNote when updating chops/loop
    let keptUserNote: string | undefined
    let existingChops: unknown[] = []
    let existingLoop: unknown = null
    try {
      if (existing.notes) {
        const parsed = JSON.parse(existing.notes) as unknown
        if (Array.isArray(parsed)) {
          existingChops = parsed
        } else if (parsed && typeof parsed === "object") {
          const obj = parsed as { chops?: unknown[]; loop?: unknown; userNote?: string }
          if (Array.isArray(obj.chops)) existingChops = obj.chops
          if (obj.loop != null) existingLoop = obj.loop
          if (typeof obj.userNote === "string") keptUserNote = obj.userNote
        }
      }
    } catch {
      // ignore
    }
    const keptLoop = loopData ?? existingLoop
    const newChops = Array.isArray(chops) ? chops : existingChops
    const base: Record<string, unknown> = { chops: newChops }
    if (keptLoop != null) base.loop = keptLoop
    if (keptUserNote !== undefined) base.userNote = keptUserNote
    const notesValue =
      newChops.length > 0 || keptLoop != null || keptUserNote != null
        ? JSON.stringify(base)
        : null

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
