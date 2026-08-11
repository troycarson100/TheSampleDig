import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { generateDashboardToken, getAffiliateStats } from "@/lib/affiliate"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const affiliates = await prisma.affiliate.findMany({ orderBy: { createdAt: "asc" } })
  const withStats = await Promise.all(
    affiliates.map(async (a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      email: a.email,
      commissionPercent: a.commissionPercent,
      dashboardToken: a.dashboardToken,
      userId: a.userId,
      active: a.active,
      notes: a.notes,
      stats: await getAffiliateStats(a.id),
    }))
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
  if (!code || !name || !email || commissionPercent < 1 || commissionPercent > 90) {
    return NextResponse.json(
      { error: "Need name, email, and a code (2-32 chars, a-z 0-9 -). Percent 1-90." },
      { status: 400 }
    )
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
