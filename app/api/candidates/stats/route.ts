/**
 * GET candidate pipeline stats (counts).
 * Query: secret
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

const SECRET = process.env.POPULATE_SECRET || "change-me-in-production"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get("secret") !== SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const samplesCount = await prisma.sample.count()
    const candidate = (prisma as any).candidate
    if (!candidate || typeof candidate.count !== "function") {
      return NextResponse.json({
        candidates: { total: 0, unenriched: 0, unscored: 0, processable: 0 },
        samples: samplesCount,
        note: "Candidate model not available; run prisma generate and restart the server.",
      })
    }
    const [total, unenriched, unscored, processable] = await Promise.all([
      candidate.count(),
      candidate.count({ where: { enrichedAt: null } }),
      candidate.count({ where: { enrichedAt: { not: null }, qualityScore: null } }),
      candidate.count({
        where: {
          qualityScore: { gte: 55 },
          processedAt: null,
          title: { not: null },
          channelTitle: { not: null },
          thumbnailUrl: { not: null },
        },
      }),
    ])

    return NextResponse.json({
      candidates: { total, unenriched, unscored, processable },
      samples: samplesCount,
    })
  } catch (e: any) {
    console.error("[Candidates Stats]", e)
    return NextResponse.json({ error: e?.message || "Stats failed" }, { status: 500 })
  }
}
