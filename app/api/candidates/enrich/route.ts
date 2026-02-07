/**
 * Enrich: fetch metadata from YouTube (videos.list) for candidates that don't have it.
 * Query: secret, limit (default 50)
 */

import { NextResponse } from "next/server"
import { enrichCandidates } from "@/lib/candidates"

const SECRET = process.env.POPULATE_SECRET || "change-me-in-production"

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get("secret") !== SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200)
    const { enriched } = await enrichCandidates(limit)
    return NextResponse.json({ success: true, enriched })
  } catch (e: any) {
    console.error("[Candidates Enrich]", e)
    return NextResponse.json({ error: e?.message || "Enrich failed" }, { status: 500 })
  }
}
