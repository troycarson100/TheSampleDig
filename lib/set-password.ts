import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { setPasswordPath } from "@/lib/plugin-purchase-logic"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

/** A receipt gets read days later; a password reset gets clicked in minutes. */
export const SET_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** A token with at least this much life left is reused rather than replaced,
 *  so the receipt email, the thanks page and a resend all carry the same link
 *  instead of each silently killing the last one. Forgot-password's 1-hour
 *  tokens never qualify and are always replaced. */
export const SET_PASSWORD_REUSE_MIN_MS = 24 * 60 * 60 * 1000

/**
 * Mint a set-password link for an account that has no human-chosen password
 * (User.passwordSetAt is null - one created by a guest plugin purchase).
 *
 * Reuses the password-reset columns, so the ordinary reset-password route
 * consumes it; the only differences are the longer expiry and the welcome
 * flag on the URL. Reuses a token that still has at least
 * SET_PASSWORD_REUSE_MIN_MS of life, so the webhook, the claim route and a
 * resend all hand out the same link; anything shorter-lived or expired is
 * replaced.
 *
 * Callers are responsible for the passwordSetAt check. Handing one of these
 * to an account that has a real password would let whoever holds the link
 * take the account over.
 */
export async function mintSetPasswordUrl(userId: string): Promise<string> {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordResetToken: true, passwordResetExpires: true },
  })
  const remaining = current?.passwordResetExpires ? current.passwordResetExpires.getTime() - Date.now() : 0
  if (current?.passwordResetToken && remaining >= SET_PASSWORD_REUSE_MIN_MS) {
    return `${APP_URL}${setPasswordPath(current.passwordResetToken)}`
  }

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
