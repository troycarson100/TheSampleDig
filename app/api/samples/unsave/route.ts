import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { sampleId } = await request.json()

    if (!sampleId) {
      return NextResponse.json(
        { error: "Sample ID is required" },
        { status: 400 }
      )
    }

    // Delete the saved sample
    await prisma.userSample.deleteMany({
      where: {
        userId: session.user.id,
        sampleId: sampleId,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error unsaving sample:", error)
    return NextResponse.json(
      { error: "Failed to unsave sample" },
      { status: 500 }
    )
  }
}
