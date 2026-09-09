import crypto from "node:crypto"
import { prisma } from "@/lib/db"

/** Long enough that a link found the next morning still works, short enough
 *  that an abandoned request does not sit around indefinitely. */
export const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Record a pending address change and return its one-shot token.
 *
 * Overwrites any earlier pending change on the account: only the newest link
 * should work, and the older address was never adopted, so nothing is lost.
 * The account's own `email` is untouched here - it moves only when the token
 * is confirmed.
 */
export async function mintEmailChangeToken(userId: string, pendingEmail: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  await prisma.user.update({
    where: { id: userId },
    data: {
      pendingEmail,
      emailChangeToken: token,
      emailChangeExpires: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
    },
  })
  return token
}
