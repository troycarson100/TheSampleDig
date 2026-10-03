import { prisma } from "@/lib/db"
import { memberOfferUrl, sendReleaseAnnouncementEmail, createBulkTransporter } from "@/lib/email"
import { completeSetLink } from "@/lib/complete-set"
import { formatOfferDate } from "@/lib/member-offer-logic"
import { liveDeps, type ReminderDeps } from "@/lib/offer-reminder"
import { PLUGIN_ORDER, PLUGINS, type PluginId } from "@/lib/plugins"
import { unsubscribeUrl } from "@/lib/unsubscribe-token"
import { fillVideoEmail, renderVideoEmailTemplate } from "@/lib/video-email-html"
import {
  VIDEO_EMAIL,
  setMissing,
  videoParts,
  videoSubject,
  videoVariant,
  type VideoExclusion,
  type VideoParts,
} from "@/lib/video-email-logic"

// The fltr video email, end to end: who it goes to, the email, and the send.
// The rules are in video-email-logic.ts, the drawing in video-email-html.ts.
//
// Built on the first reminder's machinery (lib/offer-reminder.ts) and its two
// tables, under its own slug: the list is fixed and the email snapshotted when
// Send is first pressed, batches are small and resumable, and each person is
// checked again just before they are mailed - a code used or a plugin bought
// in the meantime changes what they get, or whether they get it at all.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
export const VIDEO_BATCH_SIZE = 20
const EXAMPLE_CODE = "SR10TEST00"

const USER_SELECT = {
  id: true,
  email: true,
  emailMarketingOptIn: true,
  productUpdateOptIn: true,
  purchases: { select: { product: true } },
} as const

const owned = (purchases: { product: string }[]): PluginId[] =>
  purchases.map((p) => p.product).filter((p): p is PluginId => (PLUGIN_ORDER as readonly string[]).includes(p))

const names = (ids: readonly PluginId[]) => ids.map((id) => PLUGINS[id].name).join(" + ")

function template(amountOffCents: number, codeExpiresAt: Date): string {
  return renderVideoEmailTemplate({
    amountOffCents,
    codeExpires: formatOfferDate(codeExpiresAt),
    setEnds: formatOfferDate(VIDEO_EMAIL.setEndsAt),
  })
}

type Listed = { userId: string; email: string; code: string; variant: string }
type Audience =
  | { ok: false; error: string }
  | {
      ok: true
      offer: { id: string; amountOffCents: number; expiresAt: Date }
      recipients: Listed[]
      excluded: Record<VideoExclusion, number>
    }

/** Everyone the email would go to now, and what each would get: anyone the
 *  member offer reached, plus anyone who owns exactly one plugin. */
async function videoAudience(now: Date, deps: ReminderDeps): Promise<Audience> {
  const offer = await prisma.memberOffer.findUnique({ where: { slug: VIDEO_EMAIL.offerSlug } })
  if (!offer || !offer.couponId) return { ok: false, error: "The member offer has not been sent." }
  if (offer.expiresAt.getTime() <= now.getTime()) return { ok: false, error: "The member offer has expired." }

  const codes = await prisma.memberOfferCode.findMany({
    where: { offerId: offer.id, sentAt: { not: null } },
    select: { userId: true, code: true, promotionCodeId: true },
  })
  const codeFor = new Map(codes.map((c) => [c.userId, c]))
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { in: codes.map((c) => c.userId) } },
        { purchases: { some: { product: { in: [...PLUGIN_ORDER] } } } },
      ],
    },
    select: USER_SELECT,
    orderBy: { createdAt: "asc" },
  })
  const used = await deps.redeemedCodes(offer.couponId)

  const recipients: Listed[] = []
  const excluded: Record<VideoExclusion, number> = { "opted-out": 0, "nothing-to-offer": 0 }
  for (const u of users) {
    const c = codeFor.get(u.id)
    const parts = videoParts({
      emailMarketingOptIn: u.emailMarketingOptIn,
      productUpdateOptIn: u.productUpdateOptIn,
      owns: owned(u.purchases),
      code: c?.code ?? null,
      codeRedeemed: c ? used.has(c.code.toUpperCase()) || (c.promotionCodeId !== null && used.has(c.promotionCodeId)) : false,
    })
    if (typeof parts === "string") excluded[parts]++
    else recipients.push({ userId: u.id, email: u.email, code: parts.code ? c!.code : "", variant: videoVariant(parts) })
  }
  return { ok: true, offer: { id: offer.id, amountOffCents: offer.amountOffCents, expiresAt: offer.expiresAt }, recipients, excluded }
}

const VARIANTS = ["code", "set", "code+set"] as const
const countVariants = (rows: { variant: string }[]) =>
  Object.fromEntries(VARIANTS.map((v) => [v, rows.filter((r) => r.variant === v).length])) as Record<(typeof VARIANTS)[number], number>

/** The email as three people would get it - code only, set only, both - with
 *  example values, for the admin page. */
function samples(tpl: string): { variant: string; subject: string; html: string }[] {
  const example = (p: VideoParts, ownsNone: boolean) =>
    fillVideoEmail(tpl, {
      code: p.code ? EXAMPLE_CODE : null,
      offerUrl: p.code ? memberOfferUrl(EXAMPLE_CODE) : null,
      setUrl: p.set ? `${APP_URL}/fltr` : null,
      setOwned: p.set ? "shft" : null,
      setNames: p.set ? "drft + fltr" : null,
      ownsNone,
      unsubscribeUrl: `${APP_URL}/unsubscribe`,
    })
  return [
    { variant: "code (owns nothing)", subject: videoSubject({ code: true, set: false }), html: example({ code: true, set: false }, true) },
    { variant: "set (owns one, code used)", subject: videoSubject({ code: false, set: true }), html: example({ code: false, set: true }, false) },
    { variant: "code+set (owns one)", subject: videoSubject({ code: true, set: true }), html: example({ code: true, set: true }, false) },
  ]
}

export type VideoEmailPreview = {
  slug: string
  unavailable: string | null
  samples: { variant: string; subject: string; html: string }[]
  recipientCount: number
  byVariant: Record<(typeof VARIANTS)[number], number>
  excluded: Record<VideoExclusion, number> | null
  send: {
    id: string
    createdAt: Date
    completedAt: Date | null
    sentCount: number
    skippedCount: number
    failedEmails: string[]
  } | null
}

export async function videoEmailPreview(now: Date = new Date(), deps: ReminderDeps = liveDeps()): Promise<VideoEmailPreview> {
  const existing = await prisma.memberOfferReminder.findUnique({ where: { slug: VIDEO_EMAIL.slug } })
  if (existing) {
    const sends = await prisma.memberOfferReminderSend.findMany({
      where: { reminderId: existing.id },
      select: { email: true, variant: true, sentAt: true, failedAt: true, skippedAt: true },
    })
    return {
      slug: VIDEO_EMAIL.slug,
      unavailable: null,
      samples: samples(existing.bodyHtml),
      recipientCount: sends.length,
      byVariant: countVariants(sends),
      excluded: null,
      send: {
        id: existing.id,
        createdAt: existing.createdAt,
        completedAt: existing.completedAt,
        sentCount: sends.filter((s) => s.sentAt).length,
        skippedCount: sends.filter((s) => s.skippedAt).length,
        failedEmails: sends.filter((s) => !s.sentAt && !s.skippedAt && s.failedAt).map((s) => s.email),
      },
    }
  }
  const found = await videoAudience(now, deps)
  const offer = await prisma.memberOffer.findUnique({ where: { slug: VIDEO_EMAIL.offerSlug } })
  const tpl = template(offer?.amountOffCents ?? 1000, offer?.expiresAt ?? VIDEO_EMAIL.setEndsAt)
  if (!found.ok) {
    return { slug: VIDEO_EMAIL.slug, unavailable: found.error, samples: samples(tpl), recipientCount: 0, byVariant: countVariants([]), excluded: null, send: null }
  }
  return {
    slug: VIDEO_EMAIL.slug,
    unavailable: found.recipients.length === 0 ? "Nobody to send it to." : null,
    samples: samples(tpl),
    recipientCount: found.recipients.length,
    byVariant: countVariants(found.recipients),
    excluded: found.excluded,
    send: null,
  }
}

export type VideoClaim = { ok: true; id: string; recipientCount: number } | { ok: false; error: string }
const ALREADY = "This email has already been started. Resume it rather than starting it again."

/** Fixes the list and snapshots the email, before anyone is mailed. The row
 *  and its list go in together or not at all; the slug refuses a second. */
export async function claimVideoEmail(sentByEmail: string | null, now: Date = new Date(), deps: ReminderDeps = liveDeps()): Promise<VideoClaim> {
  if (await prisma.memberOfferReminder.findUnique({ where: { slug: VIDEO_EMAIL.slug }, select: { id: true } })) {
    return { ok: false, error: ALREADY }
  }
  const found = await videoAudience(now, deps)
  if (!found.ok) return found
  if (found.recipients.length === 0) return { ok: false, error: "Nobody to send it to." }
  const tpl = template(found.offer.amountOffCents, found.offer.expiresAt)
  try {
    const id = await prisma.$transaction(
      async (tx) => {
        const row = await tx.memberOfferReminder.create({
          data: {
            offerId: found.offer.id,
            slug: VIDEO_EMAIL.slug,
            // The subjects of the two main versions; each send picks its own.
            subject: videoSubject({ code: true, set: false }),
            bodyHtml: tpl,
            ownerSubject: videoSubject({ code: false, set: true }),
            ownerBodyHtml: tpl,
            sentByEmail,
          },
        })
        await tx.memberOfferReminderSend.createMany({ data: found.recipients.map((r) => ({ reminderId: row.id, ...r })) })
        return row.id
      },
      { maxWait: 10_000, timeout: 30_000 },
    )
    return { ok: true, id, recipientCount: found.recipients.length }
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002") return { ok: false, error: ALREADY }
    throw error
  }
}

export type VideoBatch = {
  attempted: number
  sent: number
  failed: number
  skipped: number
  totalRecipients: number
  totalSent: number
  totalSkipped: number
  done: boolean
}

/**
 * Mails the next few people on the list. Each is checked again first: their
 * code may have been used and their plugins may have changed, which changes
 * what their email holds - or leaves nothing to send, and they are skipped.
 * Stamped as sent before the email goes and unstamped if it fails, so a
 * crash or a second tab can cost someone their email but never send two.
 */
export async function sendVideoEmailBatch(id: string, now: Date = new Date(), deps: ReminderDeps = liveDeps()): Promise<VideoBatch> {
  const row = await prisma.memberOfferReminder.findUnique({ where: { id }, include: { offer: { select: { expiresAt: true } } } })
  if (!row || row.slug !== VIDEO_EMAIL.slug) throw new Error("No such email.")
  if (row.offer.expiresAt.getTime() <= now.getTime()) throw new Error("The member offer has expired. Nothing more will be sent.")

  const pending = await prisma.memberOfferReminderSend.findMany({
    where: { reminderId: id, sentAt: null, skippedAt: null },
    select: { id: true, userId: true, code: true, failedAt: true },
    orderBy: { id: "asc" },
  })
  const batch = [...pending.filter((p) => !p.failedAt), ...pending.filter((p) => p.failedAt)].slice(0, VIDEO_BATCH_SIZE)
  let sent = 0
  let failed = 0
  let skipped = 0

  if (batch.length > 0) {
    const users = await prisma.user.findMany({ where: { id: { in: batch.map((b) => b.userId) } }, select: USER_SELECT })
    const byId = new Map(users.map((u) => [u.id, u]))
    const withCode = batch.filter((b) => b.code)
    const codeRows = await prisma.memberOfferCode.findMany({ where: { code: { in: withCode.map((b) => b.code) } }, select: { code: true, promotionCodeId: true } })
    const pcId = new Map(codeRows.map((c) => [c.code, c.promotionCodeId]))
    const redeemed = new Map<string, boolean | "unknown">()
    await Promise.all(
      withCode.map(async (b) => {
        const pc = pcId.get(b.code)
        if (!pc) return void redeemed.set(b.code, "unknown")
        try {
          redeemed.set(b.code, await deps.isRedeemed(pc))
        } catch (error) {
          console.error(`[video email] could not read code ${b.code}:`, error)
          redeemed.set(b.code, "unknown")
        }
      }),
    )

    const transporter = deps.openTransporter()
    try {
      for (const b of batch) {
        const user = byId.get(b.userId)
        const used = b.code ? (redeemed.get(b.code) ?? "unknown") : false
        if (user && used === "unknown") {
          await prisma.memberOfferReminderSend.update({ where: { id: b.id }, data: { failedAt: new Date() } }).catch(() => {})
          failed++
          continue
        }
        const owns = user ? owned(user.purchases) : []
        const parts = user
          ? videoParts({
              emailMarketingOptIn: user.emailMarketingOptIn,
              productUpdateOptIn: user.productUpdateOptIn,
              owns,
              code: b.code || null,
              codeRedeemed: used === true,
            })
          : ("opted-out" as const)
        const setUrl = typeof parts !== "string" && parts.set ? await completeSetLink(b.userId, VIDEO_EMAIL.setEndsAt, now) : null
        // A set part with no link to put in it is no set part.
        const final: VideoParts | VideoExclusion =
          typeof parts === "string" ? parts : { code: parts.code, set: parts.set && Boolean(setUrl) }
        if (!user || typeof final === "string" || (!final.code && !final.set)) {
          await prisma.memberOfferReminderSend.update({ where: { id: b.id }, data: { skippedAt: new Date() } })
          skipped++
          continue
        }

        const claimed = await prisma.memberOfferReminderSend.updateMany({
          where: { id: b.id, sentAt: null, skippedAt: null },
          data: { sentAt: new Date(), failedAt: null, variant: videoVariant(final), email: user.email },
        })
        if (claimed.count === 0) continue

        const unsub = unsubscribeUrl(APP_URL, user.id)
        const html = fillVideoEmail(row.bodyHtml, {
          code: final.code ? b.code : null,
          offerUrl: final.code ? memberOfferUrl(b.code) : null,
          setUrl: final.set ? setUrl : null,
          setOwned: final.set ? names(owns) : null,
          setNames: final.set ? names(setMissing(owns)) : null,
          ownsNone: owns.length === 0,
          unsubscribeUrl: unsub,
        })
        try {
          await sendReleaseAnnouncementEmail(transporter, user.email, { subject: videoSubject(final), html, unsubscribeUrl: unsub })
          sent++
        } catch (error) {
          console.error(`[video email] failed for ${user.email}:`, error)
          await prisma.memberOfferReminderSend.update({ where: { id: b.id }, data: { sentAt: null, failedAt: new Date() } }).catch(() => {})
          failed++
        }
      }
    } finally {
      transporter.close()
    }
  }

  const [totalRecipients, totalSent, totalSkipped] = await Promise.all([
    prisma.memberOfferReminderSend.count({ where: { reminderId: id } }),
    prisma.memberOfferReminderSend.count({ where: { reminderId: id, sentAt: { not: null } } }),
    prisma.memberOfferReminderSend.count({ where: { reminderId: id, skippedAt: { not: null } } }),
  ])
  const finished = totalSent + totalSkipped >= totalRecipients
  if (finished && !row.completedAt) await prisma.memberOfferReminder.update({ where: { id }, data: { completedAt: new Date() } })
  return { attempted: batch.length, sent, failed, skipped, totalRecipients, totalSent, totalSkipped, done: finished || (sent === 0 && skipped === 0) }
}

/** All three versions to one address, with an example code and the admin's
 *  own unsubscribe link. Nothing is recorded. */
export async function sendVideoEmailTest(to: string, unsubscribeFor: string): Promise<void> {
  const existing = await prisma.memberOfferReminder.findUnique({ where: { slug: VIDEO_EMAIL.slug } })
  const offer = await prisma.memberOffer.findUnique({ where: { slug: VIDEO_EMAIL.offerSlug } })
  const tpl = existing?.bodyHtml ?? template(offer?.amountOffCents ?? 1000, offer?.expiresAt ?? VIDEO_EMAIL.setEndsAt)
  const unsub = unsubscribeUrl(APP_URL, unsubscribeFor)
  const transporter = createBulkTransporter()
  try {
    for (const s of samples(tpl)) {
      await sendReleaseAnnouncementEmail(transporter, to, {
        subject: `[TEST, ${s.variant}] ${s.subject}`,
        html: s.html.split(`${APP_URL}/unsubscribe`).join(unsub),
        unsubscribeUrl: unsub,
      })
    }
  } finally {
    transporter.close()
  }
}
