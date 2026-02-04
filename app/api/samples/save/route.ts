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
  } catch (error: any) {
    console.error("Error saving sample:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to save sample" },
      { status: 500 }
    )
  }
}
