import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ unverified: false, needsPassword: false })
    }

    // Plain, pre-lowercased equals - not Prisma's `mode: "insensitive"`, which
    // compiles to an unescaped ILIKE and lets "%"/"_" act as wildcards. Safe
    // because every write to User.email normalises to lowercase first - see
    // findByEmail in lib/plugin-purchase-grant.ts.
    const user = await prisma.user.findFirst({
      where: { email: String(email).trim().toLowerCase() },
    })

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
