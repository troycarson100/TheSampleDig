import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { generateDashboardToken, getAffiliateStats } from "@/lib/affiliate"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"
import { refreshPayoutStatus } from "@/lib/affiliate-stripe"

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const affiliates = await prisma.affiliate.findMany({ orderBy: { createdAt: "asc" } })
  const withStats = await Promise.all(
    affiliates.map(async (a) => {
      // Keep pending Stripe statuses honest (refreshPayoutStatus never throws).
      const stripePayoutsEnabled =
        a.stripeAccountId && !a.stripePayoutsEnabled ? await refreshPayoutStatus(a.id) : a.stripePayoutsEnabled
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        email: a.email,
        commissionPercent: a.commissionPercent,
        commissionType: a.commissionType,
        commissionFlatCents: a.commissionFlatCents,
        dashboardToken: a.dashboardToken,
        userId: a.userId,
        active: a.active,
        notes: a.notes,
        stripeConnected: a.stripeAccountId !== null,
        stripePayoutsEnabled,
        stats: await getAffiliateStats(a.id),
      }
    })
  )
  return NextResponse.json({ affiliates: withStats })
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const body = await request.json().catch(() => null)
  const code = normalizeAffiliateCode(body?.code)
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const commissionPercent = Number.isInteger(body?.commissionPercent) ? body.commissionPercent : 30
  const commissionType = body?.commissionType === "flat" ? "flat" : "percent"
  const commissionFlatCents = Number.isInteger(body?.commissionFlatCents) ? body.commissionFlatCents : null
  if (!code || !name || !email) {
    return NextResponse.json({ error: "Need name, email, and a code (2-32 chars, a-z 0-9 -)." }, { status: 400 })
  }
  if (commissionType === "percent" && (commissionPercent < 1 || commissionPercent > 90)) {
    return NextResponse.json({ error: "Percent must be 1-90." }, { status: 400 })
  }
  if (commissionType === "flat" && (!commissionFlatCents || commissionFlatCents < 1 || commissionFlatCents > 50000)) {
    return NextResponse.json({ error: "Flat rate must be between $0.01 and $500 per sale." }, { status: 400 })
  }
  // Invite-only: if they already have a SampleRoll account, link it up front.
  const linkedUser = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })
  try {
    const affiliate = await prisma.affiliate.create({
      data: {
        code,
        name,
        email,
        commissionPercent,
        commissionType,
        commissionFlatCents,
        dashboardToken: generateDashboardToken(),
        userId: linkedUser?.id ?? null,
        notes: typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      },
    })
    return NextResponse.json({ affiliate })
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "That code (or linked user) already exists." }, { status: 409 })
    }
    console.error("[admin affiliates create]", e)
    return NextResponse.json({ error: "Create failed." }, { status: 500 })
  }
}
