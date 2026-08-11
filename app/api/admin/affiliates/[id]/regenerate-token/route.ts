import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { generateDashboardToken } from "@/lib/affiliate"

// Rotates the private dashboard link (use if a token URL leaks).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const { id } = await params
  try {
    const affiliate = await prisma.affiliate.update({
      where: { id },
      data: { dashboardToken: generateDashboardToken() },
    })
    return NextResponse.json({ dashboardToken: affiliate.dashboardToken })
  } catch (e) {
    console.error("[admin regenerate token]", e)
    return NextResponse.json({ error: "Regenerate failed." }, { status: 500 })
  }
}
