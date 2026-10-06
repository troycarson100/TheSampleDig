import { NextResponse } from "next/server"
import { isCreatorCountry } from "@/lib/creator-countries"
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
  if (body.commissionType === "percent" || body.commissionType === "flat") data.commissionType = body.commissionType
  if (body.commissionFlatCents !== undefined) {
    if (body.commissionFlatCents === null) data.commissionFlatCents = null
    else if (Number.isInteger(body.commissionFlatCents) && body.commissionFlatCents >= 1 && body.commissionFlatCents <= 50000)
      data.commissionFlatCents = body.commissionFlatCents
    else return NextResponse.json({ error: "Flat rate must be between $0.01 and $500 per sale." }, { status: 400 })
  }
  if ((data.commissionType ?? undefined) === "flat" && data.commissionFlatCents === undefined) {
    const existing = await prisma.affiliate.findUnique({ where: { id }, select: { commissionFlatCents: true } })
    if (!existing?.commissionFlatCents)
      return NextResponse.json({ error: "Set a flat $ amount when switching to flat rate." }, { status: 400 })
  }
  if (typeof body.country === "string") {
    const country = body.country.toUpperCase()
    if (!isCreatorCountry(country)) return NextResponse.json({ error: "Stripe can't pay creators in that country." }, { status: 400 })
    // A Stripe account's country is fixed once it exists.
    const existing = await prisma.affiliate.findUnique({ where: { id }, select: { country: true, stripeAccountId: true } })
    if (existing?.stripeAccountId && existing.country !== country)
      return NextResponse.json({ error: "They've already started Stripe setup, so their country can't change." }, { status: 400 })
    data.country = country
  }
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
