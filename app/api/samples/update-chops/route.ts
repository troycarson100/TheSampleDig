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

    // Merge chops + loop: use body loop if valid, else preserve existing loop
    let notesValue: string | null = null
    if (existing.notes) {
      try {
        const parsed = JSON.parse(existing.notes) as unknown
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const obj = parsed as { chops?: unknown[]; loop?: unknown }
          const keptLoop = loopData ?? (obj.loop ?? null)
          const newChops = Array.isArray(chops) ? chops : (obj.chops ?? [])
          notesValue =
            keptLoop != null
              ? JSON.stringify({ chops: newChops, loop: keptLoop })
              : newChops.length > 0
                ? JSON.stringify({ chops: newChops })
                : null
        }
      } catch {
        // fall through
      }
    }
    if (notesValue === null) {
      notesValue =
        loopData != null
          ? JSON.stringify({ chops: Array.isArray(chops) ? chops : [], loop: loopData })
          : Array.isArray(chops) && chops.length > 0
            ? JSON.stringify(chops)
            : null
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
    console.error("[UpdateChops] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update chops" },
      { status: 500 }
    )
  }
}
