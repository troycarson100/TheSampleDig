import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { approveApplication, declineApplication } from "@/lib/affiliate-application"

// Creator-program applications for /admin/affiliates: the pending ones, and
// the last few decided, newest first.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const [pending, decided] = await Promise.all([
    prisma.affiliateApplication.findMany({ where: { status: "pending" }, orderBy: { createdAt: "desc" } }),
    prisma.affiliateApplication.findMany({ where: { status: { not: "pending" } }, orderBy: { decidedAt: "desc" }, take: 20 }),
  ])
  return NextResponse.json({ pending, decided })
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const body = (await request.json().catch(() => null)) as { id?: unknown; action?: unknown } | null
  if (typeof body?.id !== "string") return NextResponse.json({ error: "id is required." }, { status: 400 })
  const r =
    body.action === "approve" ? await approveApplication(body.id)
    : body.action === "decline" ? await declineApplication(body.id)
    : ({ ok: false, error: "Unknown action." } as const)
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 409 })
}
