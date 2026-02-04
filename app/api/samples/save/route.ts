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

    // Check if sample exists
    const sample = await prisma.sample.findUnique({
      where: { id: sampleId }
    })

    if (!sample) {
      return NextResponse.json(
        { error: "Sample not found" },
        { status: 404 }
      )
    }

    // Check if already saved
    const existing = await prisma.userSample.findUnique({
      where: {
        userId_sampleId: {
          userId: session.user.id,
          sampleId: sampleId,
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Sample already saved" },
        { status: 400 }
      )
    }

    // Save the sample
    await prisma.userSample.create({
      data: {
        userId: session.user.id,
        sampleId: sampleId,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving sample:", error)
    return NextResponse.json(
      { error: "Failed to save sample" },
      { status: 500 }
    )
  }
}
