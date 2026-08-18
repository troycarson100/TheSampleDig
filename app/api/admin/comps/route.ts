import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { generateCompCode } from "@/lib/comp-code"
import { compCodeStatus } from "@/lib/comp-code-redemption"

const MAX_BATCH = 100
const MAX_NOTE_LEN = 200

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const rows = await prisma.compCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { redeemedByUser: { select: { email: true } } },
  })

  const codes = rows.map((r) => ({
    id: r.id,
    code: r.code,
    note: r.note,
    createdByEmail: r.createdByEmail,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    redeemedAt: r.redeemedAt,
    redeemedByEmail: r.redeemedByUser?.email ?? null,
    status: compCodeStatus(r),
  }))

  return NextResponse.json({ codes })
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  let body: { count?: number; note?: string; expiresAt?: string }
  try {
    // A body that is valid JSON but not an object (e.g. the literal text
    // "null") parses without throwing; coerce it to {} so the field
    // validation below handles it as an ordinary missing-field 400 instead
    // of a bare property access throwing an uncaught TypeError.
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  const count = Number.isInteger(body.count) && (body.count as number) > 0
    ? Math.min(body.count as number, MAX_BATCH)
    : 1

  const note = typeof body.note === "string" && body.note.trim()
    ? body.note.trim().slice(0, MAX_NOTE_LEN)
    : null

  let expiresAt: Date | null = null
  if (typeof body.expiresAt === "string" && body.expiresAt.trim()) {
    const parsed = new Date(body.expiresAt)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid expiration date." }, { status: 400 })
    }
    // The admin form sends a date-only string (e.g. "2026-08-20") from an
    // <input type="date">, which Date parses as UTC MIDNIGHT — the evening
    // before in US timezones, and compCodeStatus treats <= now as expired.
    // Bump a date-only value to the END of that day (UTC) so "expires
    // Aug 20" actually covers Aug 20 everywhere. This codebase doesn't track
    // an admin's timezone anywhere, so end-of-day-UTC is simple and
    // sufficient rather than true per-timezone handling.
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(body.expiresAt.trim())
    if (dateOnly) parsed.setUTCHours(23, 59, 59, 999)
    if (parsed.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Expiration date is already in the past." }, { status: 400 })
    }
    expiresAt = parsed
  }

  const createdByEmail = session.user?.email ?? null

  // Sequential, not Promise.all: this is an occasional admin action (max 100
  // rows), and generateCompCode()'s collision odds are the same
  // astronomically-low 32^11 space generateLicenseKey already relies on with
  // no retry logic — unchanged here.
  const created = []
  for (let i = 0; i < count; i++) {
    const row = await prisma.compCode.create({
      data: { code: generateCompCode(), note, expiresAt, createdByEmail },
    })
    created.push({
      id: row.id,
      code: row.code,
      note: row.note,
      createdByEmail: row.createdByEmail,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      redeemedAt: null as Date | null,
      redeemedByEmail: null as string | null,
      status: "open" as const,
    })
  }

  return NextResponse.json({ codes: created })
}
