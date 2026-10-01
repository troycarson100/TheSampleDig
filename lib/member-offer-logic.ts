import { createHmac } from "crypto"
import { PLUGIN_ORDER, type PluginId } from "./plugins"

// The "$10 off any plugin" thank-you to the people who already had an account
// when fltr launched. The rules, pure: no Prisma, no Stripe, no mail, so each
// can be tested on its own. lib/member-offer.ts does the I/O with them.

/** The offer, as the site knows it. One offer: a second one would be a new
 *  slug, and the database refuses to claim the same slug twice. */
export const MEMBER_OFFER = {
  slug: "members-10-off-2026-10",
  amountOffCents: 1000,
  /** How long a code lasts, from the moment Send is first pressed. */
  days: 30,
  /** What Stripe shows beside the discount at checkout and on the receipt. */
  couponName: "Sample Roll member - $10 off",
} as const

const DAY_MS = 86_400_000

/** When every code in the offer stops working: `days` after the send began. */
export function memberOfferExpiry(claimedAt: Date, days: number = MEMBER_OFFER.days): Date {
  return new Date(claimedAt.getTime() + days * DAY_MS)
}

// No 0/O or 1/I/L: a code gets read off an email and typed, sometimes.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
/** Every code starts with this, so one can be recognised at a glance - in the
 *  Stripe dashboard, in a support email, in the cart. */
export const MEMBER_CODE_PREFIX = "SR10"

/**
 * One person's code: derived, not random. The same person and offer always
 * get the same code, which is what makes a failed batch safe to run again -
 * the retry asks Stripe for the code it may already have made, rather than
 * making them a second one. Keyed with a server secret, so a code cannot be
 * worked out from someone's account id.
 *
 * Letters and digits only: the site's promo box, and Stripe, take nothing else.
 */
export function memberOfferCode(secret: string, slug: string, userId: string): string {
  if (!secret) throw new Error("A secret is required to derive member codes.")
  const digest = createHmac("sha256", secret).update(`member-offer:${slug}:${userId}`).digest()
  let out = MEMBER_CODE_PREFIX
  for (let i = 0; i < 6; i++) out += ALPHABET[digest[i] % ALPHABET.length]
  return out
}

/** Codes made for a test send start with this instead, so a test code can
 *  never be mistaken for, or collide with, a member's own. */
export const TEST_CODE_PREFIX = "SRTEST"

/** A working code for a test send to the admin: random, since it belongs to
 *  nobody and is never made twice. `pick` is injectable for tests. */
export function testOfferCode(pick: (max: number) => number): string {
  let out = TEST_CODE_PREFIX
  for (let i = 0; i < 6; i++) out += ALPHABET[pick(ALPHABET.length)]
  return out
}

/** How long a test code works: long enough to try it out properly, short
 *  enough that one forwarded by mistake is soon worth nothing. */
export const TEST_CODE_DAYS = 3

export interface Candidate {
  userId: string
  email: string
  createdAt: Date
  emailMarketingOptIn: boolean
  productUpdateOptIn: boolean
  /** The plugins this account owns. */
  owns: readonly PluginId[]
}

/**
 * Who is offered a code. An account made at or before the cutoff, that still
 * takes email from us - both switches, the same rule release emails follow -
 * and that has something left to buy. Someone who owns the whole range would
 * be getting a discount on nothing.
 */
export function isMemberOfferRecipient(c: Candidate, cutoffAt: Date): boolean {
  if (c.createdAt.getTime() > cutoffAt.getTime()) return false
  if (!c.emailMarketingOptIn || !c.productUpdateOptIn) return false
  return PLUGIN_ORDER.some((id) => !c.owns.includes(id))
}

/** The date a code stops working, the way the email and the cart say it:
 *  "30 October". In Pacific time, where the business is, so the date printed
 *  is the date it is there when the code runs out. */
export function formatOfferDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Los_Angeles" })
}
