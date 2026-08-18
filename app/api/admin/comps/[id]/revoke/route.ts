import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"

// A no-op (still 200) on an already-redeemed or already-revoked code rather
// than an error: revoking is idempotent, and the admin table's "Revoke"
// button only ever appears on codes it applies to anyway.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { id } = await params
  const row = await prisma.compCode.findUnique({ where: { id } })
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 })

  if (!row.redeemedAt && !row.revokedAt) {
    await prisma.compCode.update({ where: { id }, data: { revokedAt: new Date() } })
  }

  return NextResponse.json({ ok: true })
}
