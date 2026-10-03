import type Stripe from "stripe"
import { prisma } from "@/lib/db"
import { PLUGIN_PRODUCTS } from "@/lib/plugin-products"
import { completeSetOffer, completeSetToken, type CompleteSetOffer } from "@/lib/complete-set-logic"

// "Complete your set", the I/O. The rules are in lib/complete-set-logic.ts.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

export function completeSetSecret(): string {
  return process.env.NEXTAUTH_SECRET ?? ""
}

export type CompleteSetForAccount = CompleteSetOffer & { token: string; url: string }

/** The offer open to this account right now, opened by its latest purchase,
 *  with the link that buys it - or null. */
export async function completeSetFor(userId: string, now: Date = new Date()): Promise<CompleteSetForAccount | null> {
  const purchases = await prisma.purchase.findMany({
    where: { userId, product: { in: [...PLUGIN_PRODUCTS] } },
    select: { product: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
  if (!purchases.length) return null
  const offer = completeSetOffer(purchases.map((p) => p.product), purchases[0].createdAt, now)
  const secret = completeSetSecret()
  if (!offer || !secret) return null
  const token = completeSetToken(secret, userId, offer.endsAt)
  return { ...offer, token, url: `${APP_URL}/api/cart/complete-set?t=${encodeURIComponent(token)}` }
}

/**
 * The Stripe coupon for a given discount. Its id is made from the amount, so
 * every offer of the same size shares one and nothing is created twice. A
 * coupon, never a promotion code: there is no code anyone could type in.
 */
export async function ensureCompleteSetCoupon(stripe: Stripe, amountOffCents: number): Promise<string> {
  const id = `sr-complete-set-${amountOffCents}`
  try {
    return (await stripe.coupons.retrieve(id)).id
  } catch (e) {
    if ((e as { code?: string }).code !== "resource_missing") throw e
  }
  try {
    const coupon = await stripe.coupons.create({
      id,
      amount_off: amountOffCents,
      currency: "usd",
      duration: "once",
      name: "Complete your set",
    })
    return coupon.id
  } catch (e) {
    // Two requests creating it at once: the loser finds the winner's.
    if ((e as { code?: string }).code === "resource_already_exists") return id
    throw e
  }
}
