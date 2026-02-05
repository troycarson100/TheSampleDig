import { NextResponse } from "next/server"
import { analyzeYouTubeVideo } from "@/lib/audio-analysis"

export async function POST(request: Request) {
  let sampleId: string | null = null
  
  try {
    const body = await request.json()
    const { youtubeId, sampleId: bodySampleId } = body
    sampleId = bodySampleId

    if (!youtubeId || !sampleId) {
      return NextResponse.json(
        { error: "youtubeId and sampleId are required" },
        { status: 400 }
      )
    }

    // Lazy load prisma
    const { prisma } = await import("@/lib/db")

    console.log(`[Analysis] Starting for YouTube ID: ${youtubeId}, Sample ID: ${sampleId}`)
    
    // Analyze audio with shorter timeout (30 seconds max) to prevent hanging
    const analysisPromise = analyzeYouTubeVideo(youtubeId)
    const timeoutPromise = new Promise<{ bpm: null; key: null }>((resolve) => {
      setTimeout(() => {
        console.warn(`[Analysis] Timeout after 30 seconds for ${youtubeId}`)
        resolve({ bpm: null, key: null })
      }, 30000) // Reduced to 30 seconds
    })
    
    let result: { bpm: number | null; key: string | null }
    try {
      result = await Promise.race([analysisPromise, timeoutPromise])
      console.log(`[Analysis] Complete for ${youtubeId}:`, result)
    } catch (error: any) {
      console.error(`[Analysis] Error for ${youtubeId}:`, error?.message || error)
      result = { bpm: null, key: null }
    }

    // Update database with results
    const finalStatus = result.bpm || result.key ? "completed" : "failed"
    await prisma.sample.update({
      where: { id: sampleId },
      data: {
        bpm: result.bpm,
        key: result.key,
        analysisStatus: finalStatus
      }
    })
    console.log(`Updated sample ${sampleId} with status: ${finalStatus}, BPM: ${result.bpm}, Key: ${result.key}`)

    return NextResponse.json({
      success: true,
      bpm: result.bpm,
      key: result.key
    })
  } catch (error: any) {
    console.error("Error in audio analysis:", error)

    // Try to update status to failed
    if (sampleId) {
      try {
        const { prisma } = await import("@/lib/db")
        await prisma.sample.update({
          where: { id: sampleId },
          data: { analysisStatus: "failed" }
        })
      } catch (updateError) {
        // Ignore update errors
        console.error("Failed to update analysis status:", updateError)
      }
    }

    return NextResponse.json(
      { error: error?.message || "Failed to analyze audio" },
      { status: 500 }
    )
  }
}
