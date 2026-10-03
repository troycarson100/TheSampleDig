import { createHmac, timingSafeEqual } from "crypto"
import { PLUGIN_PRODUCTS, type PluginProduct } from "./plugin-products"
import { PRICING } from "./products"

// "Complete your set": straight after someone buys, the plugins they still
// don't own, for less, for a day. The rules, pure - lib/complete-set.ts does
// the I/O. Shown on /thanks and in the receipt; bought through
// /api/cart/complete-set.
//
// The bundle is only ever sold to someone who owns none of the three, so
// until this, a buyer of one plugin had no reason to come back for the rest.

/** What the rest of the set costs, by how many plugins are left. */
export const COMPLETE_SET_PRICE: Record<number, number> = { 1: 19, 2: 39 }

/** How long the offer runs, from the purchase that opened it. */
export const COMPLETE_SET_HOURS = 24

export type CompleteSetOffer = {
  missing: PluginProduct[]
  price: number
  /** What they would pay for `missing` at the usual prices. */
  compareAt: number
  /** In whole US cents: what the Stripe coupon takes off those prices. */
  discountCents: number
  endsAt: Date
}

/**
 * The offer for someone who owns `owned`, opened by a purchase at `openedAt`,
 * or null - when they own none (the bundle is theirs to buy) or all three,
 * or the day has passed.
 */
export function completeSetOffer(owned: readonly string[], openedAt: Date, now: Date = new Date()): CompleteSetOffer | null {
  return completeSetOfferUntil(owned, new Date(openedAt.getTime() + COMPLETE_SET_HOURS * 3_600_000), now)
}

/**
 * The same offer, running until a given moment rather than for a day from a
 * purchase - what a signed link carries. The purchase links end a day after
 * the purchase; a link in a campaign email ends when the campaign does.
 */
export function completeSetOfferUntil(owned: readonly string[], endsAt: Date, now: Date = new Date()): CompleteSetOffer | null {
  const missing = PLUGIN_PRODUCTS.filter((p) => !owned.includes(p))
  const price = COMPLETE_SET_PRICE[missing.length]
  if (price === undefined || missing.length === PLUGIN_PRODUCTS.length) return null
  if (endsAt.getTime() <= now.getTime()) return null
  const compareAt = missing.reduce((sum, p) => sum + PRICING[p].price, 0)
  if (price >= compareAt) return null
  return { missing, price, compareAt, discountCents: (compareAt - price) * 100, endsAt }
}

// ---- the link ------------------------------------------------------------
// The thanks page and the receipt carry a token naming the account and when
// the offer ends, signed with a server secret. It is all the buyer needs - a
// guest who bought minutes ago has no session to sign in with. What it buys
// is worked out again when it is used, from what the account owns then.

const b64 = (s: string) => Buffer.from(s).toString("base64url")
const sign = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(`complete-set:${payload}`).digest("base64url")

export function completeSetToken(secret: string, userId: string, endsAt: Date): string {
  if (!secret) throw new Error("A secret is required to sign complete-set links.")
  const payload = b64(`${userId}.${Math.floor(endsAt.getTime() / 1000)}`)
  return `${payload}.${sign(secret, payload)}`
}

/** The account and end time a token names, or null if it is forged, mangled
 *  or past its end. */
export function readCompleteSetToken(
  secret: string,
  token: unknown,
  now: Date = new Date(),
): { userId: string; endsAt: Date } | null {
  if (!secret || typeof token !== "string") return null
  const [payload, mac, extra] = token.split(".")
  if (!payload || !mac || extra !== undefined) return null
  const want = Buffer.from(sign(secret, payload))
  const got = Buffer.from(mac)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  const [userId, endsUnix] = Buffer.from(payload, "base64url").toString().split(".")
  const endsAt = new Date(Number(endsUnix) * 1000)
  if (!userId || Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= now.getTime()) return null
  return { userId, endsAt }
}
