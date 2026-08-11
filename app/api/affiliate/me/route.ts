import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Lets the nav decide whether to show the "Affiliate" link.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ isAffiliate: false })
  try {
    const byUser = await prisma.affiliate.findUnique({ where: { userId: session.user.id } })
    if (byUser) return NextResponse.json({ isAffiliate: true })
    if (session.user.email) {
      const byEmail = await prisma.affiliate.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
      })
      return NextResponse.json({ isAffiliate: Boolean(byEmail) })
    }
  } catch (e) {
    console.error("[affiliate me]", e)
  }
  return NextResponse.json({ isAffiliate: false })
}
