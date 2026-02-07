/**
 * Process: promote high-scoring candidates to Sample table.
 * Query: secret, limit (default 30), minScore (default 55)
 */

import { NextResponse } from "next/server"
import { processCandidates } from "@/lib/candidates"
import { MIN_SCORE_TO_PROMOTE } from "@/lib/quality-scorer"

const SECRET = process.env.POPULATE_SECRET || "change-me-in-production"

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get("secret") !== SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100)
    const minScore = Math.max(0, Math.min(100, parseInt(searchParams.get("minScore") || String(MIN_SCORE_TO_PROMOTE), 10)))
    const { promoted } = await processCandidates(limit, minScore)
    return NextResponse.json({ success: true, promoted })
  } catch (e: any) {
    console.error("[Candidates Process]", e)
    return NextResponse.json({ error: e?.message || "Process failed" }, { status: 500 })
  }
}
