import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { sampleId: inputSampleId, youtubeId } = body

    if (!inputSampleId && !youtubeId) {
      return NextResponse.json(
        { error: "Sample ID or YouTube ID is required" },
        { status: 400 }
      )
    }

    const { prisma } = await import("@/lib/db")

    // Resolve to database sample id (unsave uses sampleId in UserSample)
    let sampleId = inputSampleId
    if (!sampleId && youtubeId) {
      const sample = await prisma.sample.findUnique({
        where: { youtubeId },
        select: { id: true },
      })
      if (!sample) {
        return NextResponse.json(
          { error: "Sample not found" },
          { status: 404 }
        )
      }
      sampleId = sample.id
    }
    // If input looks like a YouTube id (11 chars), look up by youtubeId
    if (sampleId && sampleId.length === 11) {
      const sample = await prisma.sample.findUnique({
        where: { youtubeId: sampleId },
        select: { id: true },
      })
      if (sample) sampleId = sample.id
    }

    await prisma.userSample.deleteMany({
      where: {
        userId: session.user.id,
        sampleId: sampleId,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error unsaving sample:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to unsave sample" },
      { status: 500 }
    )
  }
}
