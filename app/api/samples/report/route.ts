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

    const { sampleId, reason } = await request.json()

    if (!sampleId || !reason) {
      return NextResponse.json(
        { error: "Sample ID and reason are required" },
        { status: 400 }
      )
    }

    const validReasons = ["talking", "review", "wrong_genre", "other"]
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: "Invalid reason. Must be one of: talking, review, wrong_genre, other" },
        { status: 400 }
      )
    }

    // Lazy load prisma
    const { prisma } = await import("@/lib/db")

    // Get the sample to find its channel
    const sample = await prisma.sample.findUnique({
      where: { id: sampleId },
      include: { channelRel: true }
    })

    if (!sample) {
      return NextResponse.json(
        { error: "Sample not found" },
        { status: 404 }
      )
    }

    // Update channel reputation based on report
    if (sample.channelId && sample.channelRel) {
      const currentReputation = sample.channelRel.reputation
      const skipCount = sample.channelRel.skipCount + 1
      
      // Calculate new reputation: decrease by 0.1 for each skip, but don't go below 0.0
      // Also factor in total samples: if channel has many samples, decrease less
      const reputationPenalty = 0.1
      const sampleCount = sample.channelRel.sampleCount
      const adjustedPenalty = sampleCount > 0 ? reputationPenalty / (1 + sampleCount * 0.1) : reputationPenalty
      
      const newReputation = Math.max(0.0, currentReputation - adjustedPenalty)
      
      await prisma.channel.update({
        where: { id: sample.channelId },
        data: {
          reputation: newReputation,
          skipCount: skipCount,
        }
      })
    }

    return NextResponse.json({ 
      success: true,
      message: "Sample reported. Channel reputation updated."
    })
  } catch (error: any) {
    console.error("Error reporting sample:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to report sample" },
      { status: 500 }
    )
  }
}
