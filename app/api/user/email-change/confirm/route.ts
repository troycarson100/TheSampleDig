import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendEmailChangedNoticeEmail } from "@/lib/email"

// Opened from the confirmation email. Consuming this link is what proves the
// person can receive mail at the new address, so this is where the account
// actually moves.
//
// A GET that mutates, because it is opened from an inbox and the effect is the
// one the recipient asked for. Note this differs from /verify-email, which is a
// client page that POSTs: a link scanner doing a plain GET can consume THIS
// token, so a human clicking later lands on the expired page. The proof of
// delivery still holds - the scanner sits at the new address - but the failure
// mode is worth knowing.
//
// The redirect target is built from the configured app URL, NOT from
// request.url. DigitalOcean App Platform serves the app on an internal origin,
// so in production request.url is https://localhost:8080 and a redirect
// derived from it sends the buyer to a page their browser cannot reach - while
// the account change has already committed, so it looks like a failure that
// actually succeeded. Locally the two are identical, which is why this only
// showed up against the deployed site. This is the same value the confirmation
// link itself was built from, so it is known to reach us.
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

function back(params: string) {
  return NextResponse.redirect(`${APP_URL}/settings?${params}`, 303)
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")
  if (!token) return back("email-change=expired")

  const user = await prisma.user.findUnique({
    where: { emailChangeToken: token },
    select: {
      id: true,
      email: true,
      pendingEmail: true,
      emailChangeExpires: true,
    },
  })

  if (!user || !user.pendingEmail) return back("email-change=expired")
  if (!user.emailChangeExpires || user.emailChangeExpires < new Date()) {
    return back("email-change=expired")
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
    return back("email-change=taken")
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
    // Match the pre-check path above: a change that can never succeed must not
    // stay pending, or settings keeps advertising it until it expires.
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { pendingEmail: null, emailChangeToken: null, emailChangeExpires: null },
      })
    } catch (clearError) {
      console.error("[email-change confirm] could not clear the pending change", clearError)
    }
    return back("email-change=taken")
  }

  // Best effort: the address has already moved, and failing to warn the old
  // inbox must not undo that.
  try {
    await sendEmailChangedNoticeEmail(oldEmail, newEmail)
  } catch (e) {
    console.error("[email-change confirm] notice to the old address failed", e)
  }

  return back(`email-changed=${encodeURIComponent(newEmail)}`)
}
