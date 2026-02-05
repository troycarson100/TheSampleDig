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

    const body = await request.json()
    const { sampleId: inputSampleId, startTime, youtubeId } = body

    console.log(`[Save] Request: sampleId=${inputSampleId}, youtubeId=${youtubeId}, userId=${session.user.id}`)

    if (!inputSampleId) {
      return NextResponse.json(
        { error: "Sample ID is required" },
        { status: 400 }
      )
    }

    // Lazy load prisma
    const { prisma } = await import("@/lib/db")

    // SIMPLIFIED: Just find the sample - dig route should have created it
    let sample = await prisma.sample.findUnique({
      where: { id: inputSampleId }
    })

    // If not found by ID, try YouTube ID
    if (!sample && youtubeId) {
      sample = await prisma.sample.findUnique({
        where: { youtubeId: youtubeId }
      })
    }

    if (!sample) {
      console.error(`[Save] Sample not found: ID=${inputSampleId}, YouTubeID=${youtubeId}`)
      return NextResponse.json(
        { 
          error: "Sample not found. Please roll the dice again - the sample needs to be created first.",
        },
        { status: 404 }
      )
    }

    const sampleId = sample.id
    console.log(`[Save] Found sample: ${sampleId}`)

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
    console.log(`[Save] Creating UserSample: userId=${session.user.id}, sampleId=${sampleId}`)
    await prisma.userSample.create({
      data: {
        userId: session.user.id,
        sampleId: sampleId,
        startTime: startTime ? parseInt(startTime) : null,
      }
    })

    console.log(`[Save] Success!`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Save] Error:", error)
    console.error("[Save] Error details:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta
    })
    return NextResponse.json(
      { 
        error: error?.message || "Failed to save sample",
        code: error?.code || "UNKNOWN"
      },
      { status: 500 }
    )
  }
}
