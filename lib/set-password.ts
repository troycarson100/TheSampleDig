import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { setPasswordPath } from "@/lib/plugin-purchase-logic"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

/** A receipt gets read days later; a password reset gets clicked in minutes. */
export const SET_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Mint a set-password link for an account that has no human-chosen password
 * (User.passwordSetAt is null - one created by a guest plugin purchase).
 *
 * Reuses the password-reset columns, so the ordinary reset-password route
 * consumes it; the only differences are the longer expiry and the welcome
 * flag on the URL. Overwrites any earlier token: only the newest link needs
 * to work, and forgot-password re-mints on demand.
 *
 * Callers are responsible for the passwordSetAt check. Handing one of these
 * to an account that has a real password would let whoever holds the link
 * take the account over.
 */
export async function mintSetPasswordUrl(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetToken: token,
      passwordResetExpires: new Date(Date.now() + SET_PASSWORD_TTL_MS),
    },
  })
  return `${APP_URL}${setPasswordPath(token)}`
}
