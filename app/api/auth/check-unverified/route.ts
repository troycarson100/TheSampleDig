import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { accountIdByEmail } from "@/lib/account-by-email"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ unverified: false, needsPassword: false })
    }

    // Ignoring case, and never as a pattern - see lib/account-by-email.ts.
    const accountId = await accountIdByEmail(prisma, email)
    const user = accountId ? await prisma.user.findUnique({ where: { id: accountId } }) : null

    if (!user) return NextResponse.json({ unverified: false, needsPassword: false })

    // An account created by a guest plugin purchase has a random password
    // nobody knows, so "does the password match" can never be the gate here.
    // Revealing that such an account exists is the same thing the register
    // route already reveals with its 409.
    if (user.passwordSetAt === null) {
      return NextResponse.json({ unverified: false, needsPassword: true })
    }

    const isPasswordValid = await bcrypt.compare(String(password), user.passwordHash)
    if (!isPasswordValid) return NextResponse.json({ unverified: false, needsPassword: false })

    return NextResponse.json({ unverified: !user.emailVerified, needsPassword: false })
  } catch {
    return NextResponse.json({ unverified: false, needsPassword: false })
  }
}
