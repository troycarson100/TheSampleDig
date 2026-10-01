import Stripe from "stripe"
import { prisma } from "@/lib/db"
import { formatCents } from "@/lib/cart-promo"
import {
  createBulkTransporter,
  memberOfferSubject,
  renderMemberOfferHtml,
  sendMemberOfferEmail,
} from "@/lib/email"
import { randomInt } from "crypto"
import {
  MEMBER_OFFER,
  TEST_CODE_DAYS,
  formatOfferDate,
  isMemberOfferRecipient,
  memberOfferCode,
  memberOfferExpiry,
  testOfferCode,
} from "@/lib/member-offer-logic"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"
import { unsubscribeUrl } from "@/lib/unsubscribe-token"

// The "$10 off any plugin" thank-you to existing accounts, end to end: who it
// goes to, the Stripe coupon and one single-use promotion code per person, the
// email, and - once it has been sent - the code the cart applies for a signed-in
// member. The rules themselves are in member-offer-logic.ts.
//
// Shaped like release-announcement.ts, and for the same reasons: claimed before
// anything is created or mailed, sent in small batches the admin page loops
// over (DO App Platform cuts long requests), and safe to resume at any point.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

/** Small, like a release blast, and for the same reason: every request stays
 *  short. Each person here costs a Stripe call as well as an email. */
export const BATCH_SIZE = 20

const AMOUNT = formatCents(MEMBER_OFFER.amountOffCents)

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.")
  return new Stripe(key)
}

function codeSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to derive member codes.")
  return secret
}

export type Recipient = { userId: string; email: string }

/** Everyone the offer goes to, as of `cutoffAt`. The query narrows it the way
 *  the database can; isMemberOfferRecipient decides, so the count shown before
 *  sending and the list that is mailed can never disagree. */
export async function memberOfferRecipients(cutoffAt: Date): Promise<Recipient[]> {
  const users = await prisma.user.findMany({
    where: { createdAt: { lte: cutoffAt }, emailMarketingOptIn: true, productUpdateOptIn: true },
    select: {
      id: true,
      email: true,
      createdAt: true,
      emailMarketingOptIn: true,
      productUpdateOptIn: true,
      purchases: { select: { product: true } },
    },
    orderBy: { createdAt: "asc" },
  })
  return users
    .filter((u) =>
      isMemberOfferRecipient(
        {
          userId: u.id,
          email: u.email,
          createdAt: u.createdAt,
          emailMarketingOptIn: u.emailMarketingOptIn,
          productUpdateOptIn: u.productUpdateOptIn,
          owns: u.purchases.map((p) => p.product).filter((p): p is PluginId => (PLUGIN_ORDER as readonly string[]).includes(p)),
        },
        cutoffAt,
      ),
    )
    .map((u) => ({ userId: u.id, email: u.email }))
}

export type MemberOfferPreview = {
  slug: string
  amountOff: string
  days: number
  subject: string
  bodyHtml: string
  /** Before a send: who it would go to if Send were pressed now. After: who it
   *  is going to, as of the moment it began. */
  recipientCount: number
  offer: {
    id: string
    createdAt: Date
    completedAt: Date | null
    cutoffAt: Date
    expiresAt: Date
    sentCount: number
    failedEmails: string[]
    sentByEmail: string | null
  } | null
}

/** The email as it would go out now - or, once claimed, as it did. */
function draft(expiresAt: Date) {
  return {
    subject: memberOfferSubject(AMOUNT),
    bodyHtml: renderMemberOfferHtml({ amountOff: AMOUNT, expires: formatOfferDate(expiresAt) }),
  }
}

export async function memberOfferPreview(now: Date = new Date()): Promise<MemberOfferPreview> {
  const existing = await prisma.memberOffer.findUnique({ where: { slug: MEMBER_OFFER.slug } })
  const cutoffAt = existing?.cutoffAt ?? now
  const recipients = await memberOfferRecipients(cutoffAt)
  const fresh = draft(memberOfferExpiry(now))

  let sent: { email: string; sentAt: Date | null; failedAt: Date | null }[] = []
  if (existing) {
    sent = await prisma.memberOfferCode.findMany({
      where: { offerId: existing.id },
      select: { email: true, sentAt: true, failedAt: true },
    })
  }

  return {
    slug: MEMBER_OFFER.slug,
    amountOff: AMOUNT,
    days: MEMBER_OFFER.days,
    subject: existing?.subject ?? fresh.subject,
    bodyHtml: existing?.bodyHtml ?? fresh.bodyHtml,
    recipientCount: recipients.length,
    offer: existing
      ? {
          id: existing.id,
          createdAt: existing.createdAt,
          completedAt: existing.completedAt,
          cutoffAt: existing.cutoffAt,
          expiresAt: existing.expiresAt,
          sentCount: sent.filter((c) => c.sentAt).length,
          failedEmails: sent.filter((c) => !c.sentAt && c.failedAt).map((c) => c.email),
          sentByEmail: existing.sentByEmail,
        }
      : null,
  }
}

export type ClaimResult = { ok: true; offerId: string } | { ok: false; error: string }

/**
 * Starts the offer. Fixes the cutoff and the expiry at this moment, snapshots
 * the email, and makes the Stripe coupon every code will point at - before
 * anything is mailed. The unique slug stops a second claim; resuming a send
 * that stopped partway is sendMemberOfferBatch on the id this returns.
 */
export async function claimMemberOffer(sentByEmail: string | null, now: Date = new Date()): Promise<ClaimResult> {
  const expiresAt = memberOfferExpiry(now)
  const email = draft(expiresAt)

  let offerId: string
  try {
    const row = await prisma.memberOffer.create({
      data: {
        slug: MEMBER_OFFER.slug,
        amountOffCents: MEMBER_OFFER.amountOffCents,
        cutoffAt: now,
        expiresAt,
        subject: email.subject,
        bodyHtml: email.bodyHtml,
        sentByEmail,
      },
    })
    offerId = row.id
  } catch {
    return { ok: false, error: "This offer has already been started. Resume it rather than starting it again." }
  }

  await ensureCoupon(offerId)
  return { ok: true, offerId }
}

/** The offer's Stripe coupon: $10 off, once, in US dollars, on anything. Made
 *  with an idempotency key, so a claim that died after the row was written can
 *  be finished by the next batch without making a second coupon. */
async function ensureCoupon(offerId: string): Promise<string> {
  const offer = await prisma.memberOffer.findUniqueOrThrow({ where: { id: offerId } })
  if (offer.couponId) return offer.couponId
  const coupon = await stripeClient().coupons.create(
    {
      amount_off: offer.amountOffCents,
      currency: "usd",
      duration: "once",
      name: MEMBER_OFFER.couponName,
      // Nothing can be redeemed after this, whatever the codes say.
      redeem_by: Math.floor(offer.expiresAt.getTime() / 1000),
      metadata: { memberOffer: offer.slug },
    },
    { idempotencyKey: `member-offer-coupon:${offer.slug}` },
  )
  await prisma.memberOffer.update({ where: { id: offerId }, data: { couponId: coupon.id } })
  return coupon.id
}

/** One person's promotion code in Stripe, made once. The code and the
 *  idempotency key are both derived from the person, so a retry gets the same
 *  code back rather than a second one. */
async function ensurePromotionCode(
  stripe: Stripe,
  opts: { couponId: string; code: string; userId: string; slug: string; expiresAt: Date },
): Promise<string> {
  try {
    const pc = await stripe.promotionCodes.create(
      {
        promotion: { type: "coupon", coupon: opts.couponId },
        code: opts.code,
        max_redemptions: 1,
        expires_at: Math.floor(opts.expiresAt.getTime() / 1000),
        metadata: { memberOffer: opts.slug, userId: opts.userId },
      },
      { idempotencyKey: `member-offer-code:${opts.slug}:${opts.userId}` },
    )
    return pc.id
  } catch (e) {
    // A code with this text already exists: made by an earlier attempt whose
    // idempotency window has passed. It is this person's, so use it.
    const found = await stripe.promotionCodes.list({ code: opts.code, limit: 1 })
    if (found.data[0]) return found.data[0].id
    throw e
  }
}

export type BatchResult = {
  attempted: number
  sent: number
  failed: number
  totalRecipients: number
  totalSent: number
  done: boolean
}

/**
 * Makes codes for, and mails, the next BATCH_SIZE people who have not been
 * mailed. Everyone is written down before anything is made or sent for them,
 * and everything made is made idempotently, so a batch that dies anywhere can
 * be run again without a second code or a second email.
 */
export async function sendMemberOfferBatch(offerId: string, now: Date = new Date()): Promise<BatchResult> {
  const offer = await prisma.memberOffer.findUnique({ where: { id: offerId } })
  if (!offer) throw new Error("No such offer.")
  if (offer.expiresAt.getTime() <= now.getTime()) throw new Error("This offer has expired. Nothing more will be sent.")

  const couponId = await ensureCoupon(offerId)
  const recipients = await memberOfferRecipients(offer.cutoffAt)
  const done = new Set(
    (await prisma.memberOfferCode.findMany({ where: { offerId, sentAt: { not: null } }, select: { userId: true } })).map(
      (c) => c.userId,
    ),
  )
  const pending = recipients.filter((r) => !done.has(r.userId))
  const batch = pending.slice(0, BATCH_SIZE)

  if (batch.length === 0) {
    await prisma.memberOffer.update({ where: { id: offerId }, data: { completedAt: offer.completedAt ?? now } })
    return { attempted: 0, sent: 0, failed: 0, totalRecipients: recipients.length, totalSent: done.size, done: true }
  }

  const stripe = stripeClient()
  const secret = codeSecret()
  const transporter = createBulkTransporter()
  let sent = 0
  let failed = 0

  try {
    for (const r of batch) {
      const code = memberOfferCode(secret, offer.slug, r.userId)
      try {
        const row = await prisma.memberOfferCode.upsert({
          where: { offerId_userId: { offerId, userId: r.userId } },
          create: { offerId, userId: r.userId, email: r.email, code },
          update: {},
        })
        if (!row.promotionCodeId) {
          const promotionCodeId = await ensurePromotionCode(stripe, {
            couponId, code: row.code, userId: r.userId, slug: offer.slug, expiresAt: offer.expiresAt,
          })
          await prisma.memberOfferCode.update({ where: { id: row.id }, data: { promotionCodeId } })
        }
        await sendMemberOfferEmail(transporter, r.email, {
          subject: offer.subject,
          html: offer.bodyHtml,
          code: row.code,
          unsubscribeUrl: unsubscribeUrl(APP_URL, r.userId),
        })
        await prisma.memberOfferCode.update({ where: { id: row.id }, data: { sentAt: new Date(), failedAt: null } })
        sent++
      } catch (error) {
        // One bad address, or one Stripe hiccup, must not stop the send. It is
        // written down and the next batch tries that person again.
        console.error(`[member offer] failed for ${r.email}:`, error)
        await prisma.memberOfferCode
          .updateMany({ where: { offerId, userId: r.userId }, data: { failedAt: new Date() } })
          .catch(() => {})
        failed++
      }
    }
  } finally {
    transporter.close()
  }

  const totalSent = done.size + sent
  const finished = totalSent >= recipients.length
  if (finished) await prisma.memberOffer.update({ where: { id: offerId }, data: { completedAt: new Date() } })

  return {
    attempted: batch.length,
    sent,
    failed,
    totalRecipients: recipients.length,
    totalSent,
    // Not done while anyone is left - failures included, so the admin page
    // keeps offering the retry. A batch in which every attempt failed stops
    // the loop instead of spinning on the same people.
    done: finished || (sent === 0 && failed > 0),
  }
}

/**
 * A real, working code sent to one address, to try the whole thing before the
 * real send: the same email, a single-use $10 code in Stripe that the promo box
 * and checkout take, and a link that puts it on the cart. It does not start
 * the offer - no cutoff is fixed, nothing is recorded, nobody else is mailed -
 * and it is not tied to any account, so it applies through the link (or typed
 * into the box), not by being signed in.
 *
 * Its own coupon, named as a test, so test redemptions never count against the
 * offer's in Stripe. Expires in TEST_CODE_DAYS.
 */
export async function sendMemberOfferTestCode(
  to: string,
  unsubscribeFor: string,
  now: Date = new Date(),
): Promise<{ code: string; expiresAt: Date }> {
  const stripe = stripeClient()
  const expiresAt = new Date(now.getTime() + TEST_CODE_DAYS * 86_400_000)
  const coupon = await stripe.coupons.create(
    {
      amount_off: MEMBER_OFFER.amountOffCents,
      currency: "usd",
      duration: "once",
      name: `${MEMBER_OFFER.couponName} (test)`,
      metadata: { memberOffer: MEMBER_OFFER.slug, test: "1" },
    },
    // One test coupon a day is plenty; the key makes a second test that day
    // reuse it rather than make another.
    { idempotencyKey: `member-offer-test-coupon:${MEMBER_OFFER.slug}:${now.toISOString().slice(0, 10)}` },
  )
  const code = testOfferCode(randomInt)
  await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code,
    max_redemptions: 1,
    expires_at: Math.floor(expiresAt.getTime() / 1000),
    metadata: { memberOffer: MEMBER_OFFER.slug, test: "1", sentTo: to },
  })

  const email = draft(memberOfferExpiry(now))
  const transporter = createBulkTransporter()
  try {
    await sendMemberOfferEmail(transporter, to, {
      subject: `[TEST] ${email.subject}`,
      html: email.bodyHtml,
      code,
      unsubscribeUrl: unsubscribeUrl(APP_URL, unsubscribeFor),
    })
  } finally {
    transporter.close()
  }
  return { code, expiresAt }
}

/** The code a signed-in member's cart applies by itself: theirs, mailed, and
 *  not yet expired. Whether it has been used is Stripe's to say - the cart asks
 *  it, like any code, and drops one that is refused. */
export async function memberCodeFor(userId: string, now: Date = new Date()): Promise<{ code: string; expiresAt: Date } | null> {
  const row = await prisma.memberOfferCode.findFirst({
    where: { userId, sentAt: { not: null }, offer: { expiresAt: { gt: now } } },
    select: { code: true, offer: { select: { expiresAt: true } } },
    orderBy: { createdAt: "desc" },
  })
  return row ? { code: row.code, expiresAt: row.offer.expiresAt } : null
}
