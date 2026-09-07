import crypto from "node:crypto"
import bcrypt from "bcryptjs"
import type Stripe from "stripe"
import { prisma } from "@/lib/db"
import { PLUGIN_GRANTS, isCompProduct, type PluginProduct } from "@/lib/plugin-products"
import { generateLicenseKey } from "@/lib/license-key"
import { recordAffiliateReferral } from "@/lib/affiliate"
import { snapshotForVisitor } from "@/lib/attribution-snapshot"
import { buyerLookupFor, isDuplicateGrant, isAccountFromSession } from "@/lib/plugin-purchase-logic"

// The one place a paid Stripe Checkout Session becomes Purchase rows. Called by
// the webhook and by /api/plugins/claim, in either order, any number of times:
// every write is create-or-read, so the second caller changes nothing.
//
// It never sends email. The webhook does that, once.

export type GrantItem = { product: PluginProduct; licenseKey: string }

export type GrantResult = {
  userId: string
  email: string
  /** User.passwordSetAt is null: the account was created by a purchase and
   *  nobody has chosen a password. Callers offer "set a password". */
  needsPassword: boolean
  /** The account was created at or after this checkout began, i.e. by this
   *  purchase. Only then may the thanks page show keys and offer a password
   *  to whoever holds the session id; see isAccountFromSession. */
  accountFromThisPurchase: boolean
  items: GrantItem[]
  /** Products this email already owned before this checkout began. The
   *  charge is a duplicate; nothing was regranted. */
  duplicates: PluginProduct[]
}

type Buyer = { id: string; email: string; passwordSetAt: Date | null; createdAt: Date }

const buyerSelect = { id: true, email: true, passwordSetAt: true, createdAt: true } as const

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002"

async function findByEmail(email: string): Promise<Buyer | null> {
  return prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: buyerSelect })
}

async function resolveBuyer(session: Stripe.Checkout.Session): Promise<Buyer | null> {
  const lookup = buyerLookupFor(session)
  if (lookup.kind === "none") {
    console.warn(`[plugin grant] session ${session.id} has neither a user id nor an email`)
    return null
  }
  if (lookup.kind === "user") {
    const user = await prisma.user.findUnique({ where: { id: lookup.id }, select: buyerSelect })
    if (!user) console.warn(`[plugin grant] session ${session.id} names unknown user ${lookup.id}`)
    return user
  }

  // Guest. An existing account is used as-is - never verified, never touched.
  const existing = await findByEmail(lookup.email)
  if (existing) return existing

  // No account: create one. The password is 32 random bytes nobody knows, so
  // the only way onto this account is a link sent to this address - which is
  // why emailVerified can be stamped now. passwordSetAt stays null so the
  // receipt and the login page say "set a password" rather than "sign in".
  const attribution = session.metadata?.attrVisitorId
    ? await snapshotForVisitor(session.metadata.attrVisitorId)
    : null
  try {
    return await prisma.user.create({
      data: {
        email: lookup.email,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
        emailVerified: new Date(),
        passwordSetAt: null,
        emailMarketingOptIn: true,
        ...(attribution ?? {}),
      },
      select: buyerSelect,
    })
  } catch (e) {
    // The webhook and the claim route can both try to create this user at
    // once. The loser re-reads the winner's row.
    if (!isUniqueViolation(e)) throw e
    return findByEmail(lookup.email)
  }
}

async function grantOne(
  buyer: Buyer,
  product: PluginProduct,
  session: Stripe.Checkout.Session,
  stampSession: boolean,
): Promise<{ id: string; licenseKey: string; duplicate: boolean }> {
  const where = { userId_product: { userId: buyer.id, product } }
  let row = await prisma.purchase.findUnique({ where })
  let duplicate = false

  if (row) {
    duplicate = isDuplicateGrant(row.createdAt, session.created)
    if (duplicate) {
      console.warn(
        `[plugin grant] duplicate purchase: ${buyer.email} already owned ${product} (session ${session.id})`,
      )
    }
  } else {
    try {
      row = await prisma.purchase.create({
        data: {
          userId: buyer.id,
          product,
          // stripeSessionId is @unique on Purchase: one session stamps one row
          // (the first product of a bundle), the rule the webhook always kept.
          stripeSessionId: stampSession ? session.id : null,
          licenseKey: generateLicenseKey(product),
        },
      })
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      row = await prisma.purchase.findUnique({ where })
      if (!row) throw e
    }
  }

  // Never regenerate an existing key - the buyer may already have it typed
  // into the plugin. Only fill a null one (rows from before licensing), and
  // only if nobody else has since: licenseKey:null in the WHERE makes a
  // concurrent fill lose cleanly, and the re-read returns whichever key won.
  if (!row.licenseKey) {
    await prisma.purchase.updateMany({
      where: { id: row.id, licenseKey: null },
      data: { licenseKey: generateLicenseKey(product) },
    })
    row = (await prisma.purchase.findUnique({ where: { id: row.id } })) ?? row
  }
  if (!row.licenseKey) throw new Error(`[plugin grant] purchase ${row.id} still has no licence key`)

  return { id: row.id, licenseKey: row.licenseKey, duplicate }
}

/**
 * Grant whatever `session.metadata.product` covers to whoever paid. Returns
 * null, after logging, when the session is not a plugin purchase or names
 * nobody we can grant to.
 */
export async function grantPluginPurchase(session: Stripe.Checkout.Session): Promise<GrantResult | null> {
  const product = session.metadata?.product
  if (!isCompProduct(product)) return null

  const buyer = await resolveBuyer(session)
  if (!buyer) return null

  const items: GrantItem[] = []
  const duplicates: PluginProduct[] = []
  let firstPurchaseId: string | null = null
  let first = true
  for (const p of PLUGIN_GRANTS[product]) {
    const granted = await grantOne(buyer, p, session, first)
    first = false
    firstPurchaseId ??= granted.id
    items.push({ product: p, licenseKey: granted.licenseKey })
    if (granted.duplicate) duplicates.push(p)
  }

  // One referral per checkout, hung off the first granted row (the
  // AffiliateReferral <-> Purchase relation is one-to-one). Idempotent.
  if (firstPurchaseId) await recordAffiliateReferral(session, firstPurchaseId)

  return {
    userId: buyer.id,
    email: buyer.email,
    needsPassword: buyer.passwordSetAt === null,
    accountFromThisPurchase: isAccountFromSession(buyer.createdAt, session.created),
    items,
    duplicates,
  }
}
