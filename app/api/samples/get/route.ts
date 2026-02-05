import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sampleId = searchParams.get("sampleId")

    if (!sampleId) {
      return NextResponse.json(
        { error: "sampleId is required" },
        { status: 400 }
      )
    }

    // Lazy load prisma
    const { prisma } = await import("@/lib/db")

    const sample = await prisma.sample.findUnique({
      where: { id: sampleId },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        channel: true,
        thumbnailUrl: true,
        genre: true,
        era: true,
        bpm: true,
        key: true,
        analysisStatus: true,
      }
    })

    if (!sample) {
      return NextResponse.json(
        { error: "Sample not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(sample)
  } catch (error: any) {
    console.error("Error fetching sample:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch sample" },
      { status: 500 }
    )
  }
}
