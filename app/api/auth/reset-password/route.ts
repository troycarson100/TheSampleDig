import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Token and new password are required." }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { passwordResetToken: String(token) },
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 })
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordSetAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
        // Completing a reset proves control of the inbox, which is exactly
        // what email verification proves. This is also what rescues a buyer
        // whose guest purchase landed on an old, never-verified account: the
        // reset link goes to their inbox, and once used they can sign in.
        emailVerified: user.emailVerified ?? new Date(),
      },
    })

    return NextResponse.json({ message: "Password updated successfully. You can now log in." }, { status: 200 })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
