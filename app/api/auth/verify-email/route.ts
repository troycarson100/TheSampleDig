import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: "Verification token is required." }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: String(token) },
    })

    if (!user) {
      return NextResponse.json({ error: "This verification link has already been used or has expired. If your account is verified, you can log in." }, { status: 400 })
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "Email already verified." }, { status: 200 })
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return NextResponse.json({ error: "This verification link has expired. Please register again." }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    })

    return NextResponse.json({ message: "Email verified successfully. You can now log in." }, { status: 200 })
  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
