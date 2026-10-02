import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"

// For a recipient who has lost the link's browser and their private link:
// forget the token, so the next person to open the same link and tap Claim
// gets the same account and the same keys. Whoever held it before is out.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { id } = await params
  const reopened = await prisma.compCode.updateMany({
    where: { id, kind: "link", redeemedAt: { not: null } },
    data: { claimTokenHash: null },
  })
  if (reopened.count === 0) return NextResponse.json({ error: "Only a claimed gift link can be reopened." }, { status: 409 })
  return NextResponse.json({ ok: true })
}
