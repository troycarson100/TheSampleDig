/**
 * Score: run quality heuristic on enriched candidates.
 * Query: secret, limit (default 200)
 */

import { NextResponse } from "next/server"
import { scoreCandidates } from "@/lib/candidates"

const SECRET = process.env.POPULATE_SECRET || "change-me-in-production"

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get("secret") !== SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500)
    const { scored } = await scoreCandidates(limit)
    return NextResponse.json({ success: true, scored })
  } catch (e: any) {
    console.error("[Candidates Score]", e)
    return NextResponse.json({ error: e?.message || "Score failed" }, { status: 500 })
  }
}
