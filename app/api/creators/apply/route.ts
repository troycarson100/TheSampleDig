import { NextResponse } from "next/server"
import { readApplication } from "@/lib/affiliate-application-logic"
import { submitApplication } from "@/lib/affiliate-application"
import { SlidingWindowLimiter } from "@/lib/resend-rate-limit"

// The public creator-program application (app/creators). No sign-in: anyone
// can apply, nothing is granted until an admin approves it.
const perIp = new SlidingWindowLimiter(5, 60 * 60 * 1000)

export async function POST(request: Request) {
  const ip =
    request.headers.get("do-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  if (!perIp.allow(ip)) {
    return NextResponse.json({ error: "Too many applications from here. Try again in an hour." }, { status: 429 })
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  // A field people never see. Bots fill every field; this one answers them
  // with the success they expect and saves nothing.
  if (body && typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true })
  }
  const read = readApplication(body)
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: 400 })
  try {
    await submitApplication(read.value)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[creators apply]", e)
    return NextResponse.json({ error: "Couldn't send your application. Try again in a minute." }, { status: 500 })
  }
}
