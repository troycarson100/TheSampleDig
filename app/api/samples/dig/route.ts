import { NextResponse } from "next/server"
import { findRandomSample } from "@/lib/youtube"

export async function GET() {
  try {
    // Check if YouTube API key is configured
    if (!process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY === "") {
      return NextResponse.json(
        { 
          error: "YouTube API key is not configured. Please add YOUTUBE_API_KEY to your .env file and restart the server." 
        },
        { status: 500 }
      )
    }

    const video = await findRandomSample()

    // Try to save to database, but don't fail if database is unavailable
    let sampleId = video.id // Use YouTube ID as fallback ID
    try {
      // Lazy load prisma to avoid errors if it's not available
      const { prisma } = await import("@/lib/db")
      // Check if sample already exists in database
      let sample = await prisma.sample.findUnique({
        where: { youtubeId: video.id }
      })

      // If not, create it
      if (!sample) {
        sample = await prisma.sample.create({
          data: {
            youtubeId: video.id,
            title: video.title,
            channel: video.channelTitle,
            thumbnailUrl: video.thumbnail,
            genre: video.genre || null,
            era: video.era || null,
          }
        })
      }
      sampleId = sample.id
    } catch (dbError: any) {
      // Database not available, but we can still return the video
      console.warn("Database not available, returning video without saving:", dbError?.message || dbError)
    }

    return NextResponse.json({
      id: sampleId,
      youtubeId: video.id,
      title: video.title,
      channel: video.channelTitle,
      thumbnailUrl: video.thumbnail,
      genre: video.genre || null,
      era: video.era || null,
      duration: video.duration || null,
    })
  } catch (error: any) {
    console.error("Error in dig endpoint:", error)
    const errorMessage = error?.message || "Failed to fetch sample"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
