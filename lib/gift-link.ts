import crypto from "node:crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { normalizeCompCode } from "@/lib/comp-code"
import { generateLicenseKey } from "@/lib/license-key"
import { PLUGIN_GRANTS, asCompProduct, type PluginProduct } from "@/lib/plugin-products"
import { downloadsFor, type DownloadLink } from "@/lib/plugin-purchase-logic"
import {
  claimTokenMatches,
  giftPlaceholderEmail,
  giftStatus,
  hashClaimToken,
  newClaimToken,
  showsKeys,
} from "@/lib/gift-link-logic"

// Gift links, the I/O. The rules are in lib/gift-link-logic.ts.
//
// Claiming makes an account for the gift at a placeholder address nobody can
// mail or sign in to, and grants the plugins onto it with their own licence
// keys - the same Purchase rows a sale or a comp code makes. The recipient
// can put a real email on it later (app/api/gift/[code]/email), which turns
// it into an ordinary account, or adds the gift to the one they already have.

export type GiftLinkRow = NonNullable<Awaited<ReturnType<typeof findGiftLink>>>

/** The gift link a code (with or without its GIFT- prefix) names, or null.
 *  Typed-in comp codes are not gift links and are never returned. */
export async function findGiftLink(raw: string) {
  const code = normalizeCompCode(raw)
  if (!code) return null
  const row = await prisma.compCode.findUnique({
    where: { code },
    include: { redeemedByUser: { select: { id: true, email: true, createdAt: true, passwordSetAt: true } } },
  })
  return row?.kind === "link" ? row : null
}

export type GiftItem = { product: PluginProduct; licenseKey: string; downloads: DownloadLink[] }

/** The keys and downloads a claimed gift gave, as the page shows them. Empty
 *  when the gift now lives on an account that predates it - see showsKeys. */
export async function giftItems(row: GiftLinkRow): Promise<GiftItem[]> {
  const owner = row.redeemedByUser
  if (!owner || !showsKeys(owner.createdAt, row.createdAt)) return []
  const products = PLUGIN_GRANTS[asCompProduct(row.product)]
  const purchases = await prisma.purchase.findMany({
    where: { userId: owner.id, product: { in: [...products] } },
    select: { product: true, licenseKey: true },
  })
  return products.flatMap((product) => {
    const p = purchases.find((x) => x.product === product)
    return p?.licenseKey ? [{ product, licenseKey: p.licenseKey, downloads: downloadsFor(product, p.licenseKey) }] : []
  })
}

/** Does this visitor hold the token for this gift? */
export function holdsGift(row: GiftLinkRow, token: string | null | undefined): boolean {
  return claimTokenMatches(token, row.claimTokenHash)
}

export type ClaimResult = { ok: true; token: string } | { ok: false; reason: "taken" | "revoked" | "expired" }

/**
 * Claim a gift for whoever pressed the button. Atomic: the comp code row is
 * only taken by a conditional update, so of two people pressing at once one
 * gets the gift and the other is told it is taken.
 */
export async function claimGiftLink(row: GiftLinkRow, now: Date = new Date()): Promise<ClaimResult> {
  const status = giftStatus(row, now)
  if (status === "claimed") return { ok: false, reason: "taken" }
  if (status === "revoked" || status === "expired") return { ok: false, reason: status }

  const token = newClaimToken()
  const claimTokenHash = hashClaimToken(token)

  // Reopened by an admin: the account and its keys stay as they are. Only the
  // token changes, so the browser that had it before is out and this one is in.
  if (status === "reopened") {
    const rebound = await prisma.compCode.updateMany({
      where: { id: row.id, kind: "link", redeemedAt: { not: null }, claimTokenHash: null },
      data: { claimTokenHash },
    })
    return rebound.count === 1 ? { ok: true, token } : { ok: false, reason: "taken" }
  }

  // The account comes first: the claim points at it. 32 random bytes nobody
  // knows for a password, at an address nothing can be sent to, and both
  // email switches off so no bulk send ever picks it up.
  const owner = await prisma.user.create({
    data: {
      email: giftPlaceholderEmail(crypto.randomBytes(9).toString("hex")),
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
      passwordSetAt: null,
      emailMarketingOptIn: false,
      productUpdateOptIn: false,
    },
    select: { id: true },
  })

  const claimed = await prisma.compCode.updateMany({
    where: {
      id: row.id,
      kind: "link",
      redeemedAt: null,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    data: { redeemedAt: now, redeemedByUserId: owner.id, claimTokenHash },
  })
  if (claimed.count === 0) {
    // Someone else got there first (or it was revoked a moment ago). The
    // account we made holds nothing and can be dropped.
    await prisma.user.delete({ where: { id: owner.id } }).catch(() => {})
    return { ok: false, reason: "taken" }
  }

  let firstPurchaseId: string | null = null
  for (const product of PLUGIN_GRANTS[asCompProduct(row.product)]) {
    const purchase = await prisma.purchase.upsert({
      where: { userId_product: { userId: owner.id, product } },
      create: { userId: owner.id, product, stripeSessionId: null, licenseKey: generateLicenseKey(product) },
      update: {},
      select: { id: true },
    })
    firstPurchaseId ??= purchase.id
  }

  // The admin table's audit link, as /api/comps/redeem keeps it. Best effort:
  // the gift has been given either way.
  try {
    if (firstPurchaseId) await prisma.compCode.update({ where: { id: row.id }, data: { purchaseId: firstPurchaseId } })
  } catch (e) {
    console.error("[gift claim] failed to link purchase to gift", e)
  }

  return { ok: true, token }
}
