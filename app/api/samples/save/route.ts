import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    let session
    try {
      session = await auth()
    } catch (authError: any) {
      console.error("Auth error:", authError)
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 }
      )
    }

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { sampleId: inputSampleId, startTime, youtubeId, chops, loop } = body

    console.log(`[Save] Request: sampleId=${inputSampleId}, youtubeId=${youtubeId}, userId=${session.user.id}`)

    if (!inputSampleId) {
      return NextResponse.json(
        { error: "Sample ID is required" },
        { status: 400 }
      )
    }

    const { prisma } = await import("@/lib/db")

    // Find sample: by database id (cuid) or by YouTube id (11 chars)
    const isLikelyYoutubeId = typeof inputSampleId === "string" && inputSampleId.length === 11
    let sample = isLikelyYoutubeId
      ? await prisma.sample.findUnique({ where: { youtubeId: inputSampleId } })
      : await prisma.sample.findUnique({ where: { id: inputSampleId } })

    if (!sample && youtubeId && !isLikelyYoutubeId) {
      sample = await prisma.sample.findUnique({ where: { youtubeId } })
    }

    if (!sample) {
      console.error(`[Save] Sample not found: ID=${inputSampleId}, YouTubeID=${youtubeId}`)
      return NextResponse.json(
        { 
          error: "Sample not found. Please roll the dice again - the sample needs to be created first.",
        },
        { status: 404 }
      )
    }

    const sampleId = sample.id
    console.log(`[Save] Found sample: ${sampleId}`)

    // Check if already saved (raw query to avoid any Prisma client column mismatch)
    const existingRows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM user_samples
      WHERE user_id = ${session.user.id} AND sample_id = ${sampleId}
      LIMIT 1
    `
    if (existingRows.length > 0) {
      return NextResponse.json(
        { error: "Sample already saved" },
        { status: 400 }
      )
    }

    // Insert using raw SQL so we only touch columns that exist in the DB
    const chopsData = Array.isArray(chops) && chops.length > 0 ? chops : null
    const loopStartNum = loop?.loopStartMs != null ? Number(loop.loopStartMs) : NaN
    const loopEndNum = loop?.loopEndMs != null ? Number(loop.loopEndMs) : NaN
    const loopData =
      loop &&
      Array.isArray(loop?.sequence) &&
      loop.sequence.length > 0 &&
      !Number.isNaN(loopStartNum) &&
      !Number.isNaN(loopEndNum) &&
      loopEndNum > loopStartNum
        ? {
            sequence: loop.sequence,
            loopStartMs: loopStartNum,
            loopEndMs: loopEndNum,
            fullLengthMs: loop.fullLengthMs != null && !Number.isNaN(Number(loop.fullLengthMs)) ? Number(loop.fullLengthMs) : undefined,
          }
        : null
    const notesObj =
      loopData || chopsData
        ? loopData
          ? { chops: chopsData ?? [], loop: loopData }
          : chopsData
        : null
    const notesValue = notesObj ? JSON.stringify(notesObj) : null
    const startTimeNum = startTime != null ? parseInt(String(startTime), 10) : null
    console.log(`[Save] Creating UserSample: userId=${session.user.id}, sampleId=${sampleId}, chops=${chopsData?.length ?? 0}, loop=${!!loopData}`)

    const { randomUUID } = await import("crypto")
    const newId = randomUUID()
    try {
      await prisma.$executeRaw`
        INSERT INTO user_samples (id, user_id, sample_id, start_time, notes, created_at)
        VALUES (${newId}, ${session.user.id}, ${sampleId}, ${startTimeNum}, ${notesValue}, NOW())
      `
    } catch (insertError: any) {
      // Unique constraint (user_id, sample_id) - e.g. double-click or race; treat as already saved
      const isUniqueViolation =
        insertError?.code === "P2010" &&
        (insertError?.meta?.code === "23505" || /23505|already exists/i.test(insertError?.message ?? ""))
      if (isUniqueViolation) {
        console.log("[Save] Row already exists (race/double-save), returning success")
        return NextResponse.json({ success: true, sampleId })
      }
      throw insertError
    }

    console.log("[Save] Success!")
    return NextResponse.json({ success: true, sampleId })
  } catch (error: any) {
    console.error("[Save] Error:", error)
    console.error("[Save] Error details:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta
    })
    return NextResponse.json(
      { 
        error: error?.message || "Failed to save sample",
        code: error?.code || "UNKNOWN"
      },
      { status: 500 }
    )
  }
}
