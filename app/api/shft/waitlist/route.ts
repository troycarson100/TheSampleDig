import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// shft plugin launch waitlist. Reuses the existing `prelaunch_signups` table
// (email is unique, so this dedupes) — no schema migration required. If we
// later want to separate shft interest from the Sample Roll list, add a
// `source` column here and split the query.
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const email = body && typeof body === "object" && "email" in body ? (body as { email: unknown }).email : undefined
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
  }

  try {
    await prisma.prelaunchSignup.upsert({
      where: { email: normalized },
      create: { email: normalized },
      update: {},
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("shft waitlist signup error:", e)
    const msg = e instanceof Error ? e.message : String(e)
    const isDbError =
      msg.includes("does not exist") ||
      msg.includes("Unknown table") ||
      msg.includes("relation") ||
      msg.includes("P2010") ||
      msg.includes("Connection") ||
      msg.includes("connect")
    return NextResponse.json(
      { error: isDbError ? "Signup is temporarily unavailable. Please try again later." : "Something went wrong." },
      { status: isDbError ? 503 : 500 }
    )
  }
}
