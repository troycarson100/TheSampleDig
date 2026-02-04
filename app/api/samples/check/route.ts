import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ isSaved: false })
    }

    const { searchParams } = new URL(request.url)
    const sampleId = searchParams.get("sampleId")

    if (!sampleId) {
      return NextResponse.json(
        { error: "Sample ID is required" },
        { status: 400 }
      )
    }

    // Lazy load prisma
    const { prisma } = await import("@/lib/db")

    const userSample = await prisma.userSample.findUnique({
      where: {
        userId_sampleId: {
          userId: session.user.id,
          sampleId: sampleId,
        }
      }
    })

    return NextResponse.json({ isSaved: !!userSample })
  } catch (error: any) {
    console.error("Error checking sample:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to check sample" },
      { status: 500 }
    )
  }
}
