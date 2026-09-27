import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isAdminEmail } from "@/lib/admin"

// Lets the nav decide whether to show the creator "Affiliate" link and the
// admin "Affiliate admin" link.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ isAffiliate: false, isAdmin: false })
  const isAdmin = isAdminEmail(session.user.email)
  try {
    const byUser = await prisma.affiliate.findUnique({ where: { userId: session.user.id } })
    if (byUser) return NextResponse.json({ isAffiliate: true, isAdmin })
    if (session.user.email) {
      // Plain, pre-lowercased equals - not Prisma's `mode: "insensitive"`,
      // which compiles to an unescaped ILIKE and lets "%"/"_" act as
      // wildcards. session.user.email comes off the session/JWT rather than a
      // fresh row read here, so it is lowercased at this comparison rather
      // than trusted to already be normalised; Affiliate.email itself is
      // always written lowercase (see app/api/admin/affiliates/route.ts and
      // its [id] PATCH) - see also findByEmail in lib/plugin-purchase-grant.ts.
      const byEmail = await prisma.affiliate.findFirst({
        where: { email: session.user.email.trim().toLowerCase() },
      })
      return NextResponse.json({ isAffiliate: Boolean(byEmail), isAdmin })
    }
  } catch (e) {
    console.error("[affiliate me]", e)
  }
  return NextResponse.json({ isAffiliate: false, isAdmin })
}
