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
    select: { emailMarketingOptIn: true, productUpdateOptIn: true },
  })
  return NextResponse.json({
    emailMarketingOptIn: user?.emailMarketingOptIn ?? true,
    productUpdateOptIn: user?.productUpdateOptIn ?? true,
  })
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await req.json()

    // Two consents, either or both settable in one call. emailMarketingOptIn
    // is the master switch for anything non-transactional; productUpdateOptIn
    // narrows it further to "drft v1.1.3 - Out Now" release notices, which go
    // out only when both are on (see lib/release-recipients.ts).
    const data: { emailMarketingOptIn?: boolean; productUpdateOptIn?: boolean } = {}
    if (typeof body.emailMarketingOptIn === "boolean") data.emailMarketingOptIn = body.emailMarketingOptIn
    if (typeof body.productUpdateOptIn === "boolean") data.productUpdateOptIn = body.productUpdateOptIn

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "emailMarketingOptIn or productUpdateOptIn must be a boolean" },
        { status: 400 },
      )
    }

    await prisma.user.update({ where: { id: session.user.id }, data })
    return NextResponse.json(data)
  } catch (e) {
    console.error("[marketing-preferences]", e)
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }
}
