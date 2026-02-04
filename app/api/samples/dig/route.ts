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

    // Always try to save to database - this is required for saving functionality
    let sampleId = video.id // Fallback to YouTube ID if DB fails
    try {
      // Lazy load prisma to avoid errors if it's not available
      const { prisma } = await import("@/lib/db")
      // Check if sample already exists in database
      let sample = await prisma.sample.findUnique({
        where: { youtubeId: video.id }
      })

      // Get YouTube channel ID from the video object if available
      const youtubeChannelId = video.channelId || video.channelTitle
      
      // Get or create channel
      let channel = await prisma.channel.findUnique({
        where: { channelId: youtubeChannelId }
      })
      
      if (!channel) {
        channel = await prisma.channel.create({
          data: {
            channelId: youtubeChannelId,
            name: video.channelTitle,
            reputation: 0.5,
          }
        })
      }
      
      // Create sample if it doesn't exist
      if (!sample) {
        sample = await prisma.sample.create({
          data: {
            youtubeId: video.id,
            title: video.title,
            channel: video.channelTitle,
            channelId: channel.id,
            thumbnailUrl: video.thumbnail,
            genre: video.genre || null,
            era: video.era || null,
          }
        })
      }
      sampleId = sample.id
    } catch (dbError: any) {
      // Log error but continue - user can still view video
      console.error("Database error when saving sample:", dbError?.message || dbError)
      // Note: If DB fails, sampleId will be YouTube ID, and save endpoint will handle it
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
