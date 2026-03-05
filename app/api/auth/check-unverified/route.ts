import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ unverified: false })
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: String(email).trim().toLowerCase(), mode: "insensitive" } },
    })

    if (!user) return NextResponse.json({ unverified: false })

    const isPasswordValid = await bcrypt.compare(String(password), user.passwordHash)
    if (!isPasswordValid) return NextResponse.json({ unverified: false })

    return NextResponse.json({ unverified: !user.emailVerified })
  } catch {
    return NextResponse.json({ unverified: false })
  }
}
