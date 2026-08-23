import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizeCompCode } from "@/lib/comp-code"
import { decideRedemption, type RedeemRefuseReason } from "@/lib/comp-code-redemption"
import { generateLicenseKey } from "@/lib/license-key"
import { sendPluginPurchaseEmail } from "@/lib/email"
import {
  PLUGIN_GRANTS,
  PRODUCT_LABEL,
  asCompProduct,
  type PluginProduct,
} from "@/lib/plugin-products"

// Keyed off RedeemRefuseReason (not a generic Record<string, ...>) so a
// reason added to decideRedemption's union without a matching entry here is
// a compile error. Left as a runtime lookup miss, STATUS[reason] would be
// undefined and NextResponse.json({..., status: undefined}) silently
// defaults to 200 - a refused redemption reported to the client as success.
const MESSAGES: Record<RedeemRefuseReason, string> = {
  not_found: "We don't recognize that code.",
  revoked: "That code has been cancelled.",
  expired: "That code has expired.",
  already_redeemed: "That code has already been redeemed.",
  // Generic fallback only: the route replaces this with a message naming the
  // code's own product, which it knows and this static map cannot.
  already_owned: "You already own that - see My Products.",
}

const STATUS: Record<RedeemRefuseReason, number> = {
  not_found: 404,
  revoked: 410,
  expired: 410,
  already_redeemed: 410,
  already_owned: 409,
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 })
  }

  let body: { code?: string }
  try {
    // A body that is valid JSON but not an object (e.g. the literal text
    // "null") parses without throwing; coerce it to {} so the field
    // validation below handles it as an ordinary missing-field 400 instead
    // of a bare property access throwing an uncaught TypeError.
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  const code = normalizeCompCode(body.code ?? "")
  if (!code) {
    return NextResponse.json({ error: "That code doesn't look right." }, { status: 400 })
  }

  const row = await prisma.compCode.findUnique({ where: { code } })

  // What this code grants. A bundle grants two products, so ownership is only
  // a refusal when the redeemer already owns EVERY product it would grant -
  // someone who bought shft can still redeem a bundle comp and get drft from
  // it, rather than being told "you already own that" and losing the code.
  const compProduct = asCompProduct(row?.product)
  const grantProducts = PLUGIN_GRANTS[compProduct]

  const owned = row
    ? await prisma.purchase.findMany({
        where: { userId: session.user.id, product: { in: [...grantProducts] } },
        select: { product: true },
      })
    : []
  const ownedSet = new Set(owned.map((p) => p.product))
  const missing = grantProducts.filter((p) => !ownedSet.has(p))

  const decision = decideRedemption(row, missing.length === 0)
  if (decision.action === "refuse") {
    const error =
      decision.reason === "already_owned"
        ? `You already own ${PRODUCT_LABEL[compProduct]} - see My Products.`
        : MESSAGES[decision.reason]
    return NextResponse.json({ error, reason: decision.reason }, { status: STATUS[decision.reason] })
  }

  // Claim the CODE first, atomically: only the request whose conditional
  // update actually matches a row (redeemedAt still null) wins. This closes
  // the same race claim/route.ts already closes for the license-key backfill
  // - a conditional updateMany, never a read-then-write. revokedAt is
  // re-checked here too (not just against the earlier decideRedemption read
  // above) so this update is the single authoritative gate against a code
  // revoked in the narrow window between that read and this claim, not just
  // a cross-check against a stale read.
  const claimed = await prisma.compCode.updateMany({
    where: { id: row!.id, redeemedAt: null, revokedAt: null },
    data: { redeemedAt: new Date(), redeemedByUserId: session.user.id },
  })
  if (claimed.count === 0) {
    return NextResponse.json(
      { error: MESSAGES.already_redeemed, reason: "already_redeemed" },
      { status: 410 },
    )
  }

  // Grant every product the code covers. Upsert, not create: if this same
  // account somehow double-submits before the first request's write lands, the
  // second call reuses the existing purchase and mints no second key, matching
  // the "never regenerate" rule the paid path already follows. Only `missing`
  // is granted, so a partially-owned bundle tops up rather than touching the
  // product the buyer already paid for.
  const emailItems: { product: PluginProduct; licenseKey: string | null }[] = []
  let linkPurchaseId: string | null = null

  for (const product of missing) {
    const purchase = await prisma.purchase.upsert({
      where: { userId_product: { userId: session.user.id, product } },
      create: {
        userId: session.user.id,
        product,
        stripeSessionId: null,
        licenseKey: generateLicenseKey(product),
      },
      update: {},
    })
    linkPurchaseId ??= purchase.id
    emailItems.push({ product, licenseKey: purchase.licenseKey })
  }

  // Best-effort link for the admin audit view. If this fails the grant has
  // already happened - the user already has their purchase and key - so it
  // is logged, not surfaced as an error. purchaseId is @unique and singular,
  // so a bundle links to the first row it created; the code's own `product`
  // column is what records that it granted both.
  try {
    if (linkPurchaseId)
      await prisma.compCode.update({ where: { id: row!.id }, data: { purchaseId: linkPurchaseId } })
  } catch (e) {
    console.error("[comps redeem] failed to link purchase to comp code", e)
  }

  try {
    await sendPluginPurchaseEmail(session.user.email!, emailItems)
  } catch (e) {
    console.error("[comps redeem] purchase email failed", e)
  }

  return NextResponse.json({ ok: true })
}
