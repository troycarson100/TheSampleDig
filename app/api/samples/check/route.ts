import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

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

    const userSample = await prisma.userSample.findUnique({
      where: {
        userId_sampleId: {
          userId: session.user.id,
          sampleId: sampleId,
        }
      }
    })

    return NextResponse.json({ isSaved: !!userSample })
  } catch (error) {
    console.error("Error checking sample:", error)
    return NextResponse.json(
      { error: "Failed to check sample" },
      { status: 500 }
    )
  }
}
