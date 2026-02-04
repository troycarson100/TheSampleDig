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

    const { sampleId: inputSampleId, startTime } = await request.json()

    if (!inputSampleId) {
      return NextResponse.json(
        { error: "Sample ID is required" },
        { status: 400 }
      )
    }

    // Lazy load prisma
    const { prisma } = await import("@/lib/db")

    // Check if sample exists by database ID
    let sample = await prisma.sample.findUnique({
      where: { id: inputSampleId }
    })

    // Track the actual database ID to use
    let sampleId = inputSampleId

    // If not found by ID, try finding by YouTube ID (in case sampleId is actually a YouTube ID)
    if (!sample && inputSampleId.length === 11) {
      // YouTube IDs are 11 characters - try to find by YouTube ID
      sample = await prisma.sample.findUnique({
        where: { youtubeId: inputSampleId }
      })
      
      if (sample) {
        // Use the database ID instead
        sampleId = sample.id
      } else {
        // Sample doesn't exist - we need to create it, but we don't have all the info
        // Return error asking user to try again (the dig endpoint should create it)
        return NextResponse.json(
          { error: "Sample not found in database. Please roll again to create the sample." },
          { status: 404 }
        )
      }
    } else if (!sample) {
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
        startTime: startTime ? parseInt(startTime) : null,
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
