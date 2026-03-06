import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { isEmailConfigured, sendVerificationEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()

    const existing = await prisma.user.findFirst({ where: { email: { equals: normalizedEmail, mode: "insensitive" } } })
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const rawToken = crypto.randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const emailAvailable = isEmailConfigured()

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name ? String(name).trim() || null : null,
        emailVerified: emailAvailable ? null : new Date(),
        emailVerificationToken: emailAvailable ? rawToken : null,
        emailVerificationExpires: emailAvailable ? expires : null,
      },
    })

    if (!emailAvailable) {
      console.warn("[auth/register] SMTP not configured. Auto-verifying new account:", normalizedEmail)
      return NextResponse.json(
        {
          message: "Account created. Email verification is temporarily unavailable, so you can log in now.",
          needsVerification: false,
        },
        { status: 201 }
      )
    }

    try {
      await sendVerificationEmail(normalizedEmail, rawToken)
    } catch (emailError) {
      console.error("[auth/register] Verification email failed; auto-verifying account:", emailError)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      })
      return NextResponse.json(
        {
          message: "Account created. Email verification is temporarily unavailable, so you can log in now.",
          needsVerification: false,
        },
        { status: 201 }
      )
    }

    return NextResponse.json(
      { message: "Account created. Please check your email to verify your account.", needsVerification: true },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
