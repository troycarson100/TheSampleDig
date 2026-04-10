import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET/PATCH email marketing opt-in (stored in Postgres; use for Mailchimp exports / sync).
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailMarketingOptIn: true },
  })
  return NextResponse.json({
    emailMarketingOptIn: user?.emailMarketingOptIn ?? true,
  })
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await req.json()
    if (typeof body.emailMarketingOptIn !== "boolean") {
      return NextResponse.json({ error: "emailMarketingOptIn must be a boolean" }, { status: 400 })
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { emailMarketingOptIn: body.emailMarketingOptIn },
    })
    return NextResponse.json({ emailMarketingOptIn: body.emailMarketingOptIn })
  } catch (e) {
    console.error("[marketing-preferences]", e)
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }
}
