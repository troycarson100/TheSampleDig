/**
 * Run one full pipeline batch: enrich → score → process.
 * Query: secret, enrichLimit (50), scoreLimit (100), processLimit (30)
 */

import { NextResponse } from "next/server"
import { runPipelineBatch } from "@/lib/candidates"

const SECRET = process.env.POPULATE_SECRET || "change-me-in-production"

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get("secret") !== SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const enrichLimit = Math.min(parseInt(searchParams.get("enrichLimit") || "50", 10), 200)
    const scoreLimit = Math.min(parseInt(searchParams.get("scoreLimit") || "100", 10), 500)
    const processLimit = Math.min(parseInt(searchParams.get("processLimit") || "30", 10), 100)
    const result = await runPipelineBatch(enrichLimit, scoreLimit, processLimit)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    console.error("[Candidates Pipeline]", e)
    return NextResponse.json({ error: e?.message || "Pipeline failed" }, { status: 500 })
  }
}
