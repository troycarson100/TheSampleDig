import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { generateCompCode } from "@/lib/comp-code"
import { compCodeStatus } from "@/lib/comp-code-redemption"
import { asCompProduct, isCompProduct } from "@/lib/plugin-products"
import { parseExpiresAt } from "@/lib/comp-expiry"

const MAX_BATCH = 100
const MAX_NOTE_LEN = 200
const MAX_BULK_IDS = 200

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  // Gift links have their own tab (/api/admin/gifts).
  const rows = await prisma.compCode.findMany({
    where: { kind: "code" },
    orderBy: { createdAt: "desc" },
    include: { redeemedByUser: { select: { email: true } } },
  })

  const codes = rows.map((r) => ({
    id: r.id,
    code: r.code,
    product: asCompProduct(r.product),
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

  let body: { count?: number; note?: string; expiresAt?: string; product?: unknown }
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

  // Explicit, not defaulted: an admin minting comps for the wrong product is
  // the expensive mistake here (free product handed to the wrong plugin), so
  // an unrecognised or missing value is a 400 rather than a silent "shft".
  if (!isCompProduct(body.product)) {
    return NextResponse.json(
      { error: "Pick a product: shft, drft, fltr, or bundle." },
      { status: 400 },
    )
  }
  const product = body.product

  const note = typeof body.note === "string" && body.note.trim()
    ? body.note.trim().slice(0, MAX_NOTE_LEN)
    : null

  const expiresAtResult = parseExpiresAt(body.expiresAt)
  if (!expiresAtResult.ok) return NextResponse.json({ error: expiresAtResult.error }, { status: 400 })
  const expiresAt = expiresAtResult.value

  const createdByEmail = session.user?.email ?? null

  // Sequential, not Promise.all: this is an occasional admin action (max 100
  // rows), and generateCompCode()'s collision odds are the same
  // astronomically-low 32^11 space generateLicenseKey already relies on with
  // no retry logic — unchanged here.
  const created = []
  for (let i = 0; i < count; i++) {
    const row = await prisma.compCode.create({
      data: { code: generateCompCode(), product, note, expiresAt, createdByEmail },
    })
    created.push({
      id: row.id,
      code: row.code,
      product,
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

// Bulk-edit the expiration date on a set of codes at once. Body:
// {ids: string[], expiresAt: string | null} - a date string sets it,
// null/omitted clears it.
export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  let body: { ids?: unknown; expiresAt?: string | null }
  try {
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  const ids = body.ids
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Select at least one code." }, { status: 400 })
  }
  if (ids.length > MAX_BULK_IDS) {
    return NextResponse.json({ error: `Select ${MAX_BULK_IDS} codes or fewer at a time.` }, { status: 400 })
  }

  const expiresAtResult = parseExpiresAt(body.expiresAt)
  if (!expiresAtResult.ok) return NextResponse.json({ error: expiresAtResult.error }, { status: 400 })

  // redeemedAt/revokedAt: null is a server-side safety net independent of
  // what the UI offers - a settled code's expiration can never matter again
  // (compCodeStatus checks redeemed/revoked before expired), so this can
  // never silently do something the status logic would then ignore.
  const result = await prisma.compCode.updateMany({
    where: { id: { in: ids }, kind: "code", redeemedAt: null, revokedAt: null },
    data: { expiresAt: expiresAtResult.value },
  })

  return NextResponse.json({ updated: result.count })
}
