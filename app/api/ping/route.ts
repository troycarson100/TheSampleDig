import { NextResponse } from "next/server"

/** Minimal route that does not use DB or auth. Use to verify the dev server is responding. */
export async function GET() {
  return NextResponse.json({ ok: true, t: Date.now() })
}
