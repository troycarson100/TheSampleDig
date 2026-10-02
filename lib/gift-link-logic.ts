import crypto from "node:crypto"

// Gift links: the rules, pure. No Prisma, no next/headers, relative imports
// only, so `npx tsx --test` loads it directly. lib/gift-link.ts does the I/O.
//
// A gift link is a comp code (kind "link") claimed from /gift/<code> by
// whoever taps Claim first - no account, no email. The browser that claims it
// gets a token; the token is what lets that person back in, from a cookie on
// that browser or from their private link on another device.

/** Accounts made for a gift that nobody has put an email on yet live at this
 *  domain. `.invalid` is reserved (RFC 2606): no mail can ever be delivered
 *  there, and no one can register or reset a password with it. */
export const GIFT_PLACEHOLDER_DOMAIN = "gifts.sampleroll.invalid"

export function giftPlaceholderEmail(nonce: string): string {
  return `gift-${nonce.toLowerCase()}@${GIFT_PLACEHOLDER_DOMAIN}`
}

export function isGiftPlaceholderEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${GIFT_PLACEHOLDER_DOMAIN}`)
}

/** The claim token: 32 random bytes, URL-safe. Only its hash is stored. */
export function newClaimToken(): string {
  return crypto.randomBytes(32).toString("base64url")
}

export function hashClaimToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

/** Does this token belong to this hash? Constant-time on the hashes. */
export function claimTokenMatches(token: string | null | undefined, hash: string | null | undefined): boolean {
  if (!token || !hash) return false
  const a = Buffer.from(hashClaimToken(token), "hex")
  const b = Buffer.from(hash, "hex")
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** One cookie per gift, so someone sent two links keeps both. */
export function giftCookieName(giftId: string): string {
  return `sr_gift_${giftId}`
}

/** Chrome caps a cookie's life at 400 days; asking for more just gets that. */
export const GIFT_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60

/** The link's path: the code without its GIFT- prefix, which reads as noise
 *  in "/gift/GIFT-...". normalizeCompCode accepts it either way. */
export function giftPath(code: string): string {
  return `/gift/${code.replace(/^GIFT-/, "")}`
}

export type GiftRow = {
  redeemedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date | null
  claimTokenHash: string | null
}

export type GiftStatus = "open" | "claimed" | "reopened" | "revoked" | "expired"

/**
 * Claimed beats revoked and expired: once someone has the plugins, the link
 * is theirs, and neither stops it working for them. A claimed link with no
 * token was reopened by an admin (the recipient lost it), and can be claimed
 * again - onto the same account, with the same keys.
 */
export function giftStatus(row: GiftRow, now: Date = new Date()): GiftStatus {
  if (row.redeemedAt) return row.claimTokenHash ? "claimed" : "reopened"
  if (row.revokedAt) return "revoked"
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return "expired"
  return "open"
}

export type GiftView = "claim" | "mine" | "taken" | "revoked" | "expired"

/** What the page shows a visitor, given the link's status and whether they
 *  hold its token. */
export function giftView(status: GiftStatus, holdsToken: boolean): GiftView {
  if (status === "claimed") return holdsToken ? "mine" : "taken"
  if (status === "open" || status === "reopened") return "claim"
  return status
}

/**
 * May the gift page show this account's keys to whoever holds the token? Only
 * while the account is the gift's own - made when it was claimed, after the
 * link itself was made. Once the gift has been saved into an account that
 * already existed, that account may hold things the gift never gave, so the
 * page sends them to sign in instead.
 */
export function showsKeys(accountCreatedAt: Date, giftCreatedAt: Date): boolean {
  return accountCreatedAt.getTime() >= giftCreatedAt.getTime()
}
