import { createHmac, timingSafeEqual } from "crypto"

// Unsubscribe links have to work from an email client, years later, with the
// recipient not signed in. That rules out a session, and storing a token per
// user per send would mean a column that grows forever. Instead the link
// carries a stateless HMAC over the user id: nothing to store, nothing to
// expire, and it cannot be forged without NEXTAUTH_SECRET.
//
// Deliberately NOT scoped to a product or a version. Someone clicking
// "unsubscribe" wants out of release notices, full stop - making them do it
// once per plugin is the kind of thing that gets a sender marked as spam.

const SCOPE = "product-updates"

function secret() {
  const value = process.env.NEXTAUTH_SECRET
  // Fail loudly at call time rather than silently signing with "undefined",
  // which would produce tokens that verify fine here and nowhere else.
  if (!value) throw new Error("NEXTAUTH_SECRET is required to sign unsubscribe links.")
  return value
}

function sign(userId: string) {
  return createHmac("sha256", secret()).update(`${SCOPE}:${userId}`).digest("base64url")
}

export function createUnsubscribeToken(userId: string) {
  return `${userId}.${sign(userId)}`
}

/** Returns the user id when the token is authentic, else null. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token) return null

  // The id is a cuid and contains no dots, so the LAST dot is the separator
  // regardless of what precedes it.
  const split = token.lastIndexOf(".")
  if (split <= 0 || split === token.length - 1) return null

  const userId = token.slice(0, split)
  const provided = Buffer.from(token.slice(split + 1))
  const expected = Buffer.from(sign(userId))

  // Length check first: timingSafeEqual throws on a length mismatch rather
  // than returning false.
  if (provided.length !== expected.length) return null
  return timingSafeEqual(provided, expected) ? userId : null
}

export function unsubscribeUrl(appUrl: string, userId: string) {
  return `${appUrl}/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(userId))}`
}
