import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { accountIdByEmail } from "@/lib/account-by-email"
import { isGiftPlaceholderEmail } from "@/lib/gift-link-logic"
import { mintSetPasswordUrl } from "@/lib/set-password"

// "Save to my account", from the gift email. Opening it proves the person can
// read mail at that address, so this is where the gift moves there:
//
//   - No account has the address: the gift's own account takes it, and the
//     recipient goes straight on to set a password.
//   - An account already has it: the gift's plugins move onto that account
//     (any it already owns stay where they are - it has its own key for
//     those), and the recipient is sent to sign in.
//
// A GET that mutates, like /api/user/email-change/confirm, and for the same
// reason: it is opened from an inbox. Redirects are built from the app URL,
// never request.url - see the note in that route.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

function back(gift: string | null, saved: string) {
  const slug = gift && /^[0-9A-Z-]{12,20}$/i.test(gift) ? gift : null
  return NextResponse.redirect(slug ? `${APP_URL}/gift/${slug}?saved=${saved}` : `${APP_URL}/login`, 303)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  const gift = url.searchParams.get("gift")
  if (!token) return back(gift, "expired")

  const user = await prisma.user.findUnique({
    where: { emailChangeToken: token },
    select: { id: true, email: true, pendingEmail: true, emailChangeExpires: true },
  })
  if (!user || !user.pendingEmail || !isGiftPlaceholderEmail(user.email)) return back(gift, "expired")
  if (!user.emailChangeExpires || user.emailChangeExpires < new Date()) return back(gift, "expired")

  const email = user.pendingEmail
  const clearPending = { pendingEmail: null, emailChangeToken: null, emailChangeExpires: null }
  const existingId = await accountIdByEmail(prisma, email, user.id)

  if (existingId) {
    await prisma.$transaction(async (tx) => {
      const owned = await tx.purchase.findMany({ where: { userId: existingId }, select: { product: true } })
      await tx.purchase.updateMany({
        where: { userId: user.id, product: { notIn: owned.map((p) => p.product) } },
        data: { userId: existingId },
      })
      await tx.compCode.updateMany({ where: { redeemedByUserId: user.id }, data: { redeemedByUserId: existingId } })
      await tx.user.update({ where: { id: user.id }, data: clearPending })
    })
    return back(gift, "merged")
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { email, emailVerified: new Date(), ...clearPending },
    })
  } catch (e) {
    // P2002: the address was taken in the moment since the check above.
    // Opening the link again takes the merge path.
    console.error("[gift confirm] update failed", e)
    return back(gift, "retry")
  }

  return NextResponse.redirect(await mintSetPasswordUrl(user.id), 303)
}
