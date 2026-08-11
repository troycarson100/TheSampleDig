import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"

const COOKIE_NAME = "shft_ref"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60 // 60 days, last click wins

// Records a ?ref= landing and sets the attribution cookie. Invalid or inactive
// codes are ignored silently (200 either way — nothing for the visitor to see).
export async function POST(request: Request) {
  let code: string | null = null
  try {
    code = normalizeAffiliateCode((await request.json())?.code)
  } catch {
    /* ignored */
  }
  if (!code) return NextResponse.json({ ok: true })

  try {
    const affiliate = await prisma.affiliate.findUnique({ where: { code } })
    if (!affiliate || !affiliate.active) return NextResponse.json({ ok: true })

    await prisma.affiliateClick.create({ data: { affiliateId: affiliate.id } })

    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })
    return res
  } catch (e) {
    console.error("[affiliate click]", e)
    return NextResponse.json({ ok: true })
  }
}
