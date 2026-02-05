import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Lazy load prisma
    const { prisma } = await import("@/lib/db")

    // Get all saved samples for the user
    const userSamples = await prisma.userSample.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        sample: true,
      },
      orderBy: {
        createdAt: "desc",
      }
    })

    const samples = userSamples.map(us => ({
      id: us.sample.id,
      youtubeId: us.sample.youtubeId,
      title: us.sample.title,
      channel: us.sample.channel,
      thumbnailUrl: us.sample.thumbnailUrl,
      genre: us.sample.genre,
      era: us.sample.era,
      bpm: us.sample.bpm,
      key: us.sample.key,
      analysisStatus: us.sample.analysisStatus,
      startTime: us.startTime || undefined,
      savedAt: us.createdAt,
    }))

    return NextResponse.json(samples)
  } catch (error: any) {
    console.error("Error fetching saved samples:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch saved samples" },
      { status: 500 }
    )
  }
}
