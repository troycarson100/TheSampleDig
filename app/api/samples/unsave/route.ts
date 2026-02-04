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

    const { sampleId } = await request.json()

    if (!sampleId) {
      return NextResponse.json(
        { error: "Sample ID is required" },
        { status: 400 }
      )
    }

    // Lazy load prisma
    const { prisma } = await import("@/lib/db")

    // Delete the saved sample
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
