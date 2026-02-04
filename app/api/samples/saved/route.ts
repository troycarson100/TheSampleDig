import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

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
      savedAt: us.createdAt,
    }))

    return NextResponse.json(samples)
  } catch (error) {
    console.error("Error fetching saved samples:", error)
    return NextResponse.json(
      { error: "Failed to fetch saved samples" },
      { status: 500 }
    )
  }
}
