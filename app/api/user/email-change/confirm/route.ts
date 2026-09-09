import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendEmailChangedNoticeEmail } from "@/lib/email"

// Opened from the confirmation email. Consuming this link is what proves the
// person can receive mail at the new address, so this is where the account
// actually moves.
//
// A GET that mutates, matching how /verify-email already consumes its token:
// it is opened from an inbox, the token is single use, and the effect is the
// one the recipient asked for.
function back(request: Request, params: string) {
  return NextResponse.redirect(new URL(`/settings?${params}`, request.url), 303)
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")
  if (!token) return back(request, "email-change=expired")

  const user = await prisma.user.findUnique({
    where: { emailChangeToken: token },
    select: {
      id: true,
      email: true,
      pendingEmail: true,
      emailChangeExpires: true,
    },
  })

  if (!user || !user.pendingEmail) return back(request, "email-change=expired")
  if (!user.emailChangeExpires || user.emailChangeExpires < new Date()) {
    return back(request, "email-change=expired")
  }

  // Re-check: another account could have claimed this address while the
  // change sat pending.
  const taken = await prisma.user.findFirst({
    where: { email: { equals: user.pendingEmail, mode: "insensitive" }, id: { not: user.id } },
    select: { id: true },
  })
  if (taken) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingEmail: null, emailChangeToken: null, emailChangeExpires: null },
    })
    return back(request, "email-change=taken")
  }

  const oldEmail = user.email
  const newEmail = user.pendingEmail

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: newEmail,
        // Opening this link proves they receive mail there, which is exactly
        // what verification means.
        emailVerified: new Date(),
        pendingEmail: null,
        emailChangeToken: null,
        emailChangeExpires: null,
      },
    })
  } catch (e) {
    // Almost certainly P2002 from a race on the unique email column.
    console.error("[email-change confirm] update failed", e)
    return back(request, "email-change=taken")
  }

  // Best effort: the address has already moved, and failing to warn the old
  // inbox must not undo that.
  try {
    await sendEmailChangedNoticeEmail(oldEmail, newEmail)
  } catch (e) {
    console.error("[email-change confirm] notice to the old address failed", e)
  }

  return back(request, `email-changed=${encodeURIComponent(newEmail)}`)
}
