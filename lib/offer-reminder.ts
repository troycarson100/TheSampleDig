import Stripe from "stripe"
import type { Transporter } from "nodemailer"
import { prisma } from "@/lib/db"
import { createBulkTransporter, sendMemberOfferEmail } from "@/lib/email"
import { formatCents } from "@/lib/cart-promo"
import { MEMBER_OFFER, formatOfferDate, memberOfferExpiry } from "@/lib/member-offer-logic"
import { renderOfferReminderHtml } from "@/lib/offer-reminder-email"
import {
  OFFER_REMINDER,
  bundleEndsOn,
  reminderExclusion,
  reminderPrices,
  reminderSubject,
  reminderVariant,
  type ReminderExclusion,
  type ReminderVariant,
} from "@/lib/offer-reminder-logic"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"
import { unsubscribeUrl } from "@/lib/unsubscribe-token"

// The reminder about the member offer, end to end: who it goes to, the two
// emails, and the send. The rules are in offer-reminder-logic.ts and the email
// is drawn in offer-reminder-email.ts.
//
// Shaped like member-offer.ts, and for the same reasons: claimed before anyone
// is mailed, sent in small batches the admin page loops over (DO App Platform
// cuts long requests), and safe to resume at any point. One difference: the
// whole list is written down when the reminder is claimed, because who has
// used their code is Stripe's to say and asking it for every batch would be
// a thousand calls. A batch still checks the handful of people it is about to
// mail, so someone who bought in the meantime is not told to.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

/** Small, like the offer's own batches: every request stays short. Each
 *  person costs a Stripe read as well as an email. */
export const BATCH_SIZE = 20

/** What a test send shows where a real code would be. Shaped like one, and
 *  not one: it is refused anywhere it is tried. */
const EXAMPLE_CODE = "SR10TEST00"

const VARIANTS: readonly ReminderVariant[] = ["bundle", "fltr"]

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.")
  return new Stripe(key)
}

const ownedPlugins = (purchases: { product: string }[]): PluginId[] =>
  purchases.map((p) => p.product).filter((p): p is PluginId => (PLUGIN_ORDER as readonly string[]).includes(p))

const USER_SELECT = {
  id: true,
  email: true,
  emailMarketingOptIn: true,
  productUpdateOptIn: true,
  purchases: { select: { product: true } },
} as const

type Emails = Record<ReminderVariant, { subject: string; bodyHtml: string }>

/** Both emails as they would go out now, for an offer whose codes run out at
 *  `expiresAt`. */
function draft(amountOffCents: number, expiresAt: Date, now: Date): Emails {
  const prices = reminderPrices(amountOffCents)
  const one = (variant: ReminderVariant) => ({
    subject: reminderSubject(variant, prices),
    bodyHtml: renderOfferReminderHtml({
      variant,
      prices,
      expires: formatOfferDate(expiresAt),
      bundleEnds: bundleEndsOn(now),
    }),
  })
  return { bundle: one("bundle"), fltr: one("fltr") }
}

/** Every code of this coupon that Stripe has seen used, by id and by text.
 *  The whole coupon is read, a hundred at a time, rather than filtering on
 *  `active`: `times_redeemed` is the fact, and it is on every code. */
async function redeemedCodes(stripe: Stripe, couponId: string): Promise<Set<string>> {
  const used = new Set<string>()
  for await (const pc of stripe.promotionCodes.list({ coupon: couponId, limit: 100 })) {
    if (pc.times_redeemed > 0) {
      used.add(pc.id)
      used.add(pc.code.toUpperCase())
    }
  }
  return used
}

/**
 * What the reminder needs from outside the database: Stripe's word on which
 * codes have been used, and something to send mail with. Named so that the
 * whole send - list, claim, batches, resume - can be run against a local
 * database with neither (scripts/verify-offer-reminder.ts). Everything else
 * uses liveDeps().
 */
export interface ReminderDeps {
  /** Every used code of a coupon, by promotion-code id and by its text. */
  redeemedCodes(couponId: string): Promise<Set<string>>
  /** Whether one promotion code has been used. Throws when Stripe does not say. */
  isRedeemed(promotionCodeId: string): Promise<boolean>
  /** A pooled transporter; the caller closes it. */
  openTransporter(): Transporter
}

export function liveDeps(): ReminderDeps {
  let stripe: Stripe | null = null
  const client = () => (stripe ??= stripeClient())
  return {
    redeemedCodes: (couponId) => redeemedCodes(client(), couponId),
    isRedeemed: async (id) => (await client().promotionCodes.retrieve(id)).times_redeemed > 0,
    openTransporter: createBulkTransporter,
  }
}

type Listed = { userId: string; email: string; code: string; variant: ReminderVariant }

type Audience =
  | { ok: false; error: string }
  | {
      ok: true
      offer: { id: string; amountOffCents: number; expiresAt: Date }
      recipients: Listed[]
      excluded: Record<ReminderExclusion, number>
    }

/**
 * Who the reminder would go to if it were sent now: the people the offer was
 * mailed to, less anyone reminderExclusion leaves out. Asks Stripe which codes
 * have been used, so it is slow (a few seconds) and it throws if Stripe does
 * not answer - a list made without knowing who has already bought is not one
 * to send to.
 */
async function reminderAudience(now: Date, deps: ReminderDeps): Promise<Audience> {
  const offer = await prisma.memberOffer.findUnique({ where: { slug: OFFER_REMINDER.offerSlug } })
  if (!offer || !offer.couponId) {
    return { ok: false, error: "The member offer has not been sent, so there is no code to remind anyone of." }
  }
  if (offer.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, error: "The member offer has expired. Its codes no longer work." }
  }

  const codes = await prisma.memberOfferCode.findMany({
    where: { offerId: offer.id, sentAt: { not: null } },
    select: { userId: true, code: true, promotionCodeId: true },
    orderBy: { sentAt: "asc" },
  })
  const users = await prisma.user.findMany({ where: { id: { in: codes.map((c) => c.userId) } }, select: USER_SELECT })
  const byId = new Map(users.map((u) => [u.id, u]))
  const used = await deps.redeemedCodes(offer.couponId)

  const recipients: Listed[] = []
  const excluded: Record<ReminderExclusion, number> = { "no-code": 0, redeemed: 0, "owns-fltr": 0, "opted-out": 0 }
  for (const c of codes) {
    const user = byId.get(c.userId)
    // The account has been deleted since: nobody to write to.
    if (!user) continue
    const owns = ownedPlugins(user.purchases)
    const why = reminderExclusion({
      userId: user.id,
      emailMarketingOptIn: user.emailMarketingOptIn,
      productUpdateOptIn: user.productUpdateOptIn,
      owns,
      codeSent: true,
      codeRedeemed: used.has(c.code.toUpperCase()) || (c.promotionCodeId !== null && used.has(c.promotionCodeId)),
    })
    if (why) excluded[why]++
    else recipients.push({ userId: user.id, email: user.email, code: c.code, variant: reminderVariant(owns) })
  }
  return {
    ok: true,
    offer: { id: offer.id, amountOffCents: offer.amountOffCents, expiresAt: offer.expiresAt },
    recipients,
    excluded,
  }
}

export type OfferReminderPreview = {
  slug: string
  amountOff: string
  /** Why it cannot be sent, or null when it can. */
  unavailable: string | null
  /** The two emails: as they would go out now or, once claimed, as they did. */
  emails: Emails
  /** Before a send: who it would go to if Send were pressed now. After: who
   *  was put on the list when it was. */
  recipientCount: number
  byVariant: Record<ReminderVariant, number>
  /** Who the offer went to but the reminder leaves out, and why. Null once
   *  claimed: the list is fixed then, and this would describe a different day. */
  excluded: Record<ReminderExclusion, number> | null
  reminder: {
    id: string
    createdAt: Date
    completedAt: Date | null
    sentCount: number
    skippedCount: number
    failedEmails: string[]
    sentByEmail: string | null
  } | null
}

const countVariants = (rows: { variant: string }[]): Record<ReminderVariant, number> => ({
  bundle: rows.filter((r) => r.variant === "bundle").length,
  fltr: rows.filter((r) => r.variant === "fltr").length,
})

export async function offerReminderPreview(
  now: Date = new Date(),
  deps: ReminderDeps = liveDeps(),
): Promise<OfferReminderPreview> {
  const head = { slug: OFFER_REMINDER.slug, amountOff: formatCents(MEMBER_OFFER.amountOffCents) }

  const existing = await prisma.memberOfferReminder.findUnique({ where: { slug: OFFER_REMINDER.slug } })
  if (existing) {
    const sends = await prisma.memberOfferReminderSend.findMany({
      where: { reminderId: existing.id },
      select: { email: true, variant: true, sentAt: true, failedAt: true, skippedAt: true },
    })
    return {
      ...head,
      unavailable: null,
      emails: {
        bundle: { subject: existing.subject, bodyHtml: existing.bodyHtml },
        fltr: { subject: existing.ownerSubject, bodyHtml: existing.ownerBodyHtml },
      },
      recipientCount: sends.length,
      byVariant: countVariants(sends),
      excluded: null,
      reminder: {
        id: existing.id,
        createdAt: existing.createdAt,
        completedAt: existing.completedAt,
        sentCount: sends.filter((s) => s.sentAt).length,
        skippedCount: sends.filter((s) => s.skippedAt).length,
        failedEmails: sends.filter((s) => !s.sentAt && !s.skippedAt && s.failedAt).map((s) => s.email),
        sentByEmail: existing.sentByEmail,
      },
    }
  }

  const found = await reminderAudience(now, deps)
  if (!found.ok) {
    return {
      ...head,
      unavailable: found.error,
      emails: draft(MEMBER_OFFER.amountOffCents, memberOfferExpiry(now), now),
      recipientCount: 0,
      byVariant: { bundle: 0, fltr: 0 },
      excluded: null,
      reminder: null,
    }
  }
  return {
    ...head,
    unavailable: found.recipients.length === 0 ? "Nobody is left to remind." : null,
    emails: draft(found.offer.amountOffCents, found.offer.expiresAt, now),
    recipientCount: found.recipients.length,
    byVariant: countVariants(found.recipients),
    excluded: found.excluded,
    reminder: null,
  }
}

export type ClaimResult = { ok: true; reminderId: string; recipientCount: number } | { ok: false; error: string }

const ALREADY = "This reminder has already been started. Resume it rather than starting it again."

/**
 * Starts the reminder: fixes who it goes to - as Stripe and the database have
 * it at this moment - and snapshots both emails, before anyone is mailed. The
 * reminder and its whole list are written together or not at all, and the
 * unique slug stops a second claim. Sending is sendOfferReminderBatch on the
 * id this returns.
 */
export async function claimOfferReminder(
  sentByEmail: string | null,
  now: Date = new Date(),
  deps: ReminderDeps = liveDeps(),
): Promise<ClaimResult> {
  if (await prisma.memberOfferReminder.findUnique({ where: { slug: OFFER_REMINDER.slug }, select: { id: true } })) {
    return { ok: false, error: ALREADY }
  }
  const found = await reminderAudience(now, deps)
  if (!found.ok) return found
  if (found.recipients.length === 0) return { ok: false, error: "Nobody is left to remind." }
  const emails = draft(found.offer.amountOffCents, found.offer.expiresAt, now)

  try {
    const reminderId = await prisma.$transaction(
      async (tx) => {
        const row = await tx.memberOfferReminder.create({
          data: {
            offerId: found.offer.id,
            slug: OFFER_REMINDER.slug,
            subject: emails.bundle.subject,
            bodyHtml: emails.bundle.bodyHtml,
            ownerSubject: emails.fltr.subject,
            ownerBodyHtml: emails.fltr.bodyHtml,
            sentByEmail,
          },
        })
        await tx.memberOfferReminderSend.createMany({
          data: found.recipients.map((r) => ({ reminderId: row.id, ...r })),
        })
        return row.id
      },
      { maxWait: 10_000, timeout: 30_000 },
    )
    return { ok: true, reminderId, recipientCount: found.recipients.length }
  } catch (error) {
    // Two presses at once: the slug let one through.
    if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002") {
      return { ok: false, error: ALREADY }
    }
    throw error
  }
}

export type BatchResult = {
  attempted: number
  sent: number
  failed: number
  /** Dropped at the last moment: bought fltr, used the code, or stopped
   *  taking email since the list was made. */
  skipped: number
  totalRecipients: number
  totalSent: number
  totalSkipped: number
  done: boolean
}

/**
 * Mails the next BATCH_SIZE people on the list who have not been mailed.
 *
 * Each person is checked again first - they may have bought, used their code
 * or unsubscribed in the hour since the list was made - and is stamped as sent
 * BEFORE the email goes, then unstamped if it fails. That way round, a request
 * that dies mid-send or a second tab pressing Resume can cost one person their
 * reminder; the other way round it would send someone two.
 */
export async function sendOfferReminderBatch(
  reminderId: string,
  now: Date = new Date(),
  deps: ReminderDeps = liveDeps(),
): Promise<BatchResult> {
  const reminder = await prisma.memberOfferReminder.findUnique({
    where: { id: reminderId },
    include: { offer: { select: { expiresAt: true } } },
  })
  if (!reminder) throw new Error("No such reminder.")
  if (reminder.offer.expiresAt.getTime() <= now.getTime()) {
    throw new Error("The member offer has expired. Nothing more will be sent.")
  }

  const pending = await prisma.memberOfferReminderSend.findMany({
    where: { reminderId, sentAt: null, skippedAt: null },
    select: { id: true, userId: true, code: true, failedAt: true },
    orderBy: { id: "asc" },
  })
  // Anyone not yet tried goes first, so an address that keeps failing waits
  // at the back rather than holding up the people behind it.
  const batch = [...pending.filter((p) => !p.failedAt), ...pending.filter((p) => p.failedAt)].slice(0, BATCH_SIZE)

  let sent = 0
  let failed = 0
  let skipped = 0

  if (batch.length > 0) {
    const users = await prisma.user.findMany({ where: { id: { in: batch.map((b) => b.userId) } }, select: USER_SELECT })
    const byId = new Map(users.map((u) => [u.id, u]))
    const codeRows = await prisma.memberOfferCode.findMany({
      where: { code: { in: batch.map((b) => b.code) } },
      select: { code: true, promotionCodeId: true },
    })
    const promotionCodeId = new Map(codeRows.map((c) => [c.code, c.promotionCodeId]))

    // Has this person's code been used since the list was made? "unknown" is
    // an answer too, and it is not a yes: they are left for the next batch.
    const redeemed = new Map<string, boolean | "unknown">()
    await Promise.all(
      batch.map(async (b) => {
        const id = promotionCodeId.get(b.code)
        if (!id) return void redeemed.set(b.code, "unknown")
        try {
          redeemed.set(b.code, await deps.isRedeemed(id))
        } catch (error) {
          console.error(`[offer reminder] could not read code ${b.code}:`, error)
          redeemed.set(b.code, "unknown")
        }
      }),
    )

    const transporter = deps.openTransporter()
    try {
      for (const row of batch) {
        const user = byId.get(row.userId)
        const used = redeemed.get(row.code) ?? "unknown"
        if (user && used === "unknown") {
          await prisma.memberOfferReminderSend.update({ where: { id: row.id }, data: { failedAt: new Date() } }).catch(() => {})
          failed++
          continue
        }
        const owns = user ? ownedPlugins(user.purchases) : []
        const why = user
          ? reminderExclusion({
              userId: user.id,
              emailMarketingOptIn: user.emailMarketingOptIn,
              productUpdateOptIn: user.productUpdateOptIn,
              owns,
              codeSent: true,
              codeRedeemed: used === true,
            })
          : "opted-out" // the account is gone
        if (!user || why) {
          await prisma.memberOfferReminderSend.update({ where: { id: row.id }, data: { skippedAt: new Date() } })
          skipped++
          continue
        }

        // What they own may have changed too: someone who bought shft this
        // morning must not be put the bundle this afternoon.
        const variant = reminderVariant(owns)
        const claimed = await prisma.memberOfferReminderSend.updateMany({
          where: { id: row.id, sentAt: null, skippedAt: null },
          data: { sentAt: new Date(), failedAt: null, variant, email: user.email },
        })
        // Another request got to them first.
        if (claimed.count === 0) continue

        try {
          await sendMemberOfferEmail(transporter, user.email, {
            subject: variant === "bundle" ? reminder.subject : reminder.ownerSubject,
            html: variant === "bundle" ? reminder.bodyHtml : reminder.ownerBodyHtml,
            code: row.code,
            unsubscribeUrl: unsubscribeUrl(APP_URL, user.id),
          })
          sent++
        } catch (error) {
          // One bad address must not stop the send. It is written down and a
          // later batch tries that person again.
          console.error(`[offer reminder] failed for ${user.email}:`, error)
          await prisma.memberOfferReminderSend
            .update({ where: { id: row.id }, data: { sentAt: null, failedAt: new Date() } })
            .catch(() => {})
          failed++
        }
      }
    } finally {
      transporter.close()
    }
  }

  const [totalRecipients, totalSent, totalSkipped] = await Promise.all([
    prisma.memberOfferReminderSend.count({ where: { reminderId } }),
    prisma.memberOfferReminderSend.count({ where: { reminderId, sentAt: { not: null } } }),
    prisma.memberOfferReminderSend.count({ where: { reminderId, skippedAt: { not: null } } }),
  ])
  const finished = totalSent + totalSkipped >= totalRecipients
  if (finished && !reminder.completedAt) {
    await prisma.memberOfferReminder.update({ where: { id: reminderId }, data: { completedAt: new Date() } })
  }

  return {
    attempted: batch.length,
    sent,
    failed,
    skipped,
    totalRecipients,
    totalSent,
    totalSkipped,
    // Not done while anyone is left - failures included, so the admin page
    // keeps offering the retry. A batch that got nowhere stops the loop
    // instead of spinning on the same people.
    done: finished || (sent === 0 && skipped === 0),
  }
}

/**
 * Both emails to one address, as they are or as they went, with an example
 * code that works nowhere. Nothing is recorded and nothing is asked of
 * Stripe. The unsubscribe link is `unsubscribeFor`'s own - the admin's - so a
 * test can never opt anyone else out.
 */
export async function sendOfferReminderTest(to: string, unsubscribeFor: string, now: Date = new Date()): Promise<void> {
  const reminder = await prisma.memberOfferReminder.findUnique({ where: { slug: OFFER_REMINDER.slug } })
  let emails: Emails
  if (reminder) {
    emails = {
      bundle: { subject: reminder.subject, bodyHtml: reminder.bodyHtml },
      fltr: { subject: reminder.ownerSubject, bodyHtml: reminder.ownerBodyHtml },
    }
  } else {
    const offer = await prisma.memberOffer.findUnique({ where: { slug: OFFER_REMINDER.offerSlug } })
    emails = draft(
      offer?.amountOffCents ?? MEMBER_OFFER.amountOffCents,
      offer?.expiresAt ?? memberOfferExpiry(now),
      now,
    )
  }
  const transporter = createBulkTransporter()
  try {
    for (const variant of VARIANTS) {
      await sendMemberOfferEmail(transporter, to, {
        subject: `[TEST, ${variant === "bundle" ? "owns nothing" : "owns a plugin"}] ${emails[variant].subject}`,
        html: emails[variant].bodyHtml,
        code: EXAMPLE_CODE,
        unsubscribeUrl: unsubscribeUrl(APP_URL, unsubscribeFor),
      })
    }
  } finally {
    transporter.close()
  }
}
