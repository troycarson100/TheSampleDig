import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Bad body." }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (body.code !== undefined) {
    const code = normalizeAffiliateCode(body.code)
    if (!code) return NextResponse.json({ error: "Invalid code." }, { status: 400 })
    data.code = code
  }
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
  if (typeof body.email === "string" && body.email.trim()) data.email = body.email.trim().toLowerCase()
  if (Number.isInteger(body.commissionPercent) && body.commissionPercent >= 1 && body.commissionPercent <= 90)
    data.commissionPercent = body.commissionPercent
  if (typeof body.active === "boolean") data.active = body.active
  if (body.notes !== undefined) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null

  try {
    const affiliate = await prisma.affiliate.update({ where: { id }, data })
    return NextResponse.json({ affiliate })
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "That code is taken." }, { status: 409 })
    }
    console.error("[admin affiliates update]", e)
    return NextResponse.json({ error: "Update failed." }, { status: 500 })
  }
}
