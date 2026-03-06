import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()

    // Always return the same response to prevent email enumeration
    const genericResponse = NextResponse.json(
      { message: "If an account with that email exists, you'll receive a password reset link shortly." },
      { status: 200 }
    )

    const user = await prisma.user.findFirst({ where: { email: { equals: normalizedEmail, mode: "insensitive" } } })
    if (!user) {
      return genericResponse
    }

    const rawToken = crypto.randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: rawToken,
        passwordResetExpires: expires,
      },
    })

    if (!isEmailConfigured()) {
      console.error("[auth/forgot-password] SMTP not configured. Reset email not sent for:", normalizedEmail)
      return genericResponse
    }

    try {
      await sendPasswordResetEmail(user.email, rawToken)
    } catch (emailError) {
      console.error("[auth/forgot-password] Reset email failed:", emailError)
      return genericResponse
    }

    return genericResponse
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
