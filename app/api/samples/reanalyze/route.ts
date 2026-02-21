import { NextResponse } from "next/server"
import {
  reAnalyzeFromCache,
  analyzeYouTubeVideo,
  findCachedAudio,
} from "@/lib/audio-analysis"

/**
 * Re-analyze BPM/key for a sample. Uses cached audio when present (no re-download).
 * POST body: { sampleId: string }
 */
export async function POST(request: Request) {
  let sampleId: string | null = null

  try {
    const body = await request.json()
    const { sampleId: bodySampleId } = body
    sampleId = bodySampleId

    if (!sampleId) {
      return NextResponse.json(
        { error: "sampleId is required" },
        { status: 400 }
      )
    }

    const { prisma } = await import("@/lib/db")
    const sample = await prisma.sample.findUnique({
      where: { id: sampleId },
      select: { id: true, youtubeId: true },
    })

    if (!sample) {
      return NextResponse.json(
        { error: "Sample not found" },
        { status: 404 }
      )
    }

    const fromCache = !!findCachedAudio(sample.youtubeId)
    const analysisPromise = fromCache
      ? reAnalyzeFromCache(sample.youtubeId)
      : Promise.resolve(analyzeYouTubeVideo(sample.youtubeId))

    const timeoutPromise = new Promise<{ bpm: null; key: null }>((resolve) => {
      setTimeout(() => {
        console.warn(`[Reanalyze] Timeout for ${sample.youtubeId}`)
        resolve({ bpm: null, key: null })
      }, 35000)
    })

    let result: { bpm: number | null; key: string | null }
    const resolved = await Promise.race([analysisPromise, timeoutPromise])
    if (fromCache && resolved === null) {
      result = { bpm: null, key: null }
    } else {
      result = resolved ?? { bpm: null, key: null }
    }

    const finalStatus = result.bpm != null || result.key != null ? "completed" : "failed"
    await prisma.sample.update({
      where: { id: sample.id },
      data: {
        bpm: result.bpm,
        key: result.key,
        analysisStatus: finalStatus,
      },
    })

    console.log(
      `[Reanalyze] ${sample.youtubeId} ${fromCache ? "(cached)" : "(downloaded)"} → BPM ${result.bpm ?? "–"} Key ${result.key ?? "–"}`
    )

    return NextResponse.json({
      success: true,
      bpm: result.bpm,
      key: result.key,
      fromCache,
    })
  } catch (error: unknown) {
    console.error("Error in reanalyze:", error)

    if (sampleId) {
      try {
        const { prisma } = await import("@/lib/db")
        await prisma.sample.update({
          where: { id: sampleId },
          data: { analysisStatus: "failed" },
        })
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to re-analyze audio",
      },
      { status: 500 }
    )
  }
}
