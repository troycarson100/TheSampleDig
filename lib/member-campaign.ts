import { prisma } from "@/lib/db"
import { createBulkTransporter, memberOfferUrl, sendReleaseAnnouncementEmail } from "@/lib/email"
import { completeSetLink } from "@/lib/complete-set"
import { formatOfferDate } from "@/lib/member-offer-logic"
import { liveDeps, type ReminderDeps } from "@/lib/offer-reminder"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"
import { unsubscribeUrl } from "@/lib/unsubscribe-token"

// A designed email to members, put together per person, sent in batches. The
// machinery under the fltr video email (lib/video-email.ts) and the bundle
// email (lib/bundle-email.ts); each of those is a Campaign: who gets what,
// the subject, and the drawing. This file is the rest, and is the first
// reminder's machinery (lib/offer-reminder.ts) and tables generalised:
//
//   - claimed once, under the campaign's slug, before anyone is mailed: the
//     list is fixed and the email snapshotted, so what was previewed is what
//     every batch sends
//   - sent in small batches the admin page loops over (DO cuts long requests)
//   - each person checked again just before they are mailed - a code used, a
//     plugin bought or an unsubscribe since the list changes what they get,
//     or leaves them out
//   - stamped as sent before the email goes and unstamped if it fails, so a
//     crash or a second tab can cost someone their email but never send two

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
export const CAMPAIGN_BATCH_SIZE = 20

/** One reader, as a campaign decides about them. */
export type Person = {
  userId: string
  email: string
  emailMarketingOptIn: boolean
  productUpdateOptIn: boolean
  owns: PluginId[]
  /** Their member code, or null if the offer never reached them. */
  code: string | null
  codeRedeemed: boolean
}

/** The per-person links a campaign's email can carry. */
export type Links = {
  /** The member-offer link that carries their code, when they have one unused. */
  offerUrl: string | null
  /** Their complete-your-set link, when the campaign asked for one and they have an offer. */
  setUrl: string | null
  unsubscribeUrl: string
}

export interface Campaign<P> {
  slug: string
  /** The member offer whose codes the campaign may carry. */
  offerSlug: string
  /** Who is considered: everyone the member offer reached plus every owner of
   *  a plugin, or every account that takes email. */
  candidates: "code-holders-and-owners" | "everyone"
  /** When the complete-set links it carries stop working. */
  setEndsAt: Date
  /** What this person's email holds, or why they get none. */
  parts(p: Person): P | string
  /** Whether these parts need a complete-set link. */
  wantsSet(p: P): boolean
  /** The same parts without the complete-set part: what is sent when no link
   *  could be made. A string leaves them out. */
  withoutSet(p: P): P | string
  /** A short name for these parts, for the admin's counts. */
  variant(p: P): string
  variants: readonly string[]
  subject(p: P): string
  /** The email as a template, with each person's parts still to go in. */
  template(o: { amountOffCents: number; codeExpires: string; setEnds: string }): string
  /** One person's email from the template. */
  fill(template: string, p: P, person: Person, links: Links): string
  /** Example emails for the admin page and the test send, from the template. */
  samples(template: string): { variant: string; subject: string; html: string }[]
}

const USER_SELECT = {
  id: true,
  email: true,
  emailMarketingOptIn: true,
  productUpdateOptIn: true,
  purchases: { select: { product: true } },
} as const

const ownedPlugins = (purchases: { product: string }[]): PluginId[] =>
  purchases.map((p) => p.product).filter((p): p is PluginId => (PLUGIN_ORDER as readonly string[]).includes(p))

function templateFor<P>(c: Campaign<P>, amountOffCents: number, codeExpiresAt: Date): string {
  return c.template({ amountOffCents, codeExpires: formatOfferDate(codeExpiresAt), setEnds: formatOfferDate(c.setEndsAt) })
}

type Listed = { userId: string; email: string; code: string; variant: string }
type Audience =
  | { ok: false; error: string }
  | { ok: true; offer: { id: string; amountOffCents: number; expiresAt: Date }; recipients: Listed[]; excluded: Record<string, number> }

async function audience<P>(c: Campaign<P>, now: Date, deps: ReminderDeps): Promise<Audience> {
  const offer = await prisma.memberOffer.findUnique({ where: { slug: c.offerSlug } })
  if (!offer || !offer.couponId) return { ok: false, error: "The member offer has not been sent." }
  if (offer.expiresAt.getTime() <= now.getTime()) return { ok: false, error: "The member offer has expired." }

  const codes = await prisma.memberOfferCode.findMany({
    where: { offerId: offer.id, sentAt: { not: null } },
    select: { userId: true, code: true, promotionCodeId: true },
  })
  const codeFor = new Map(codes.map((x) => [x.userId, x]))
  const users = await prisma.user.findMany({
    where:
      c.candidates === "everyone"
        ? { emailMarketingOptIn: true, productUpdateOptIn: true }
        : { OR: [{ id: { in: codes.map((x) => x.userId) } }, { purchases: { some: { product: { in: [...PLUGIN_ORDER] } } } }] },
    select: USER_SELECT,
    orderBy: { createdAt: "asc" },
  })
  const used = await deps.redeemedCodes(offer.couponId)

  const recipients: Listed[] = []
  const excluded: Record<string, number> = {}
  for (const u of users) {
    const x = codeFor.get(u.id)
    const codeRedeemed = x ? used.has(x.code.toUpperCase()) || (x.promotionCodeId !== null && used.has(x.promotionCodeId)) : false
    const parts = c.parts({
      userId: u.id,
      email: u.email,
      emailMarketingOptIn: u.emailMarketingOptIn,
      productUpdateOptIn: u.productUpdateOptIn,
      owns: ownedPlugins(u.purchases),
      code: x?.code ?? null,
      codeRedeemed,
    })
    if (typeof parts === "string") excluded[parts] = (excluded[parts] ?? 0) + 1
    // A code is kept on the row only while it is unused: the batch asks Stripe
    // about it again, and a used one has nothing more to say.
    else recipients.push({ userId: u.id, email: u.email, code: x && !codeRedeemed ? x.code : "", variant: c.variant(parts) })
  }
  return { ok: true, offer: { id: offer.id, amountOffCents: offer.amountOffCents, expiresAt: offer.expiresAt }, recipients, excluded }
}

const countVariants = (variants: readonly string[], rows: { variant: string }[]) =>
  Object.fromEntries(variants.map((v) => [v, rows.filter((r) => r.variant === v).length])) as Record<string, number>

export type CampaignPreview = {
  slug: string
  unavailable: string | null
  samples: { variant: string; subject: string; html: string }[]
  recipientCount: number
  byVariant: Record<string, number>
  excluded: Record<string, number> | null
  send: { id: string; createdAt: Date; completedAt: Date | null; sentCount: number; skippedCount: number; failedEmails: string[] } | null
}

export async function campaignPreview<P>(c: Campaign<P>, now: Date = new Date(), deps: ReminderDeps = liveDeps()): Promise<CampaignPreview> {
  const existing = await prisma.memberOfferReminder.findUnique({ where: { slug: c.slug } })
  if (existing) {
    const sends = await prisma.memberOfferReminderSend.findMany({
      where: { reminderId: existing.id },
      select: { email: true, variant: true, sentAt: true, failedAt: true, skippedAt: true },
    })
    return {
      slug: c.slug,
      unavailable: null,
      samples: c.samples(existing.bodyHtml),
      recipientCount: sends.length,
      byVariant: countVariants(c.variants, sends),
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
  const offer = await prisma.memberOffer.findUnique({ where: { slug: c.offerSlug } })
  const tpl = templateFor(c, offer?.amountOffCents ?? 1000, offer?.expiresAt ?? c.setEndsAt)
  const found = await audience(c, now, deps)
  if (!found.ok) return { slug: c.slug, unavailable: found.error, samples: c.samples(tpl), recipientCount: 0, byVariant: countVariants(c.variants, []), excluded: null, send: null }
  return {
    slug: c.slug,
    unavailable: found.recipients.length === 0 ? "Nobody to send it to." : null,
    samples: c.samples(tpl),
    recipientCount: found.recipients.length,
    byVariant: countVariants(c.variants, found.recipients),
    excluded: found.excluded,
    send: null,
  }
}

export type CampaignClaim = { ok: true; id: string; recipientCount: number } | { ok: false; error: string }
const ALREADY = "This email has already been started. Resume it rather than starting it again."

export async function claimCampaign<P>(c: Campaign<P>, sentByEmail: string | null, now: Date = new Date(), deps: ReminderDeps = liveDeps()): Promise<CampaignClaim> {
  if (await prisma.memberOfferReminder.findUnique({ where: { slug: c.slug }, select: { id: true } })) return { ok: false, error: ALREADY }
  const found = await audience(c, now, deps)
  if (!found.ok) return found
  if (found.recipients.length === 0) return { ok: false, error: "Nobody to send it to." }
  const tpl = templateFor(c, found.offer.amountOffCents, found.offer.expiresAt)
  const [first] = c.samples(tpl)
  try {
    const id = await prisma.$transaction(
      async (tx) => {
        const row = await tx.memberOfferReminder.create({
          data: {
            offerId: found.offer.id,
            slug: c.slug,
            // The template is the snapshot. The subject columns hold an example
            // for the record; each send works out its own.
            subject: first?.subject ?? c.slug,
            bodyHtml: tpl,
            ownerSubject: first?.subject ?? c.slug,
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

export type CampaignBatch = {
  attempted: number
  sent: number
  failed: number
  skipped: number
  totalRecipients: number
  totalSent: number
  totalSkipped: number
  done: boolean
}

export async function sendCampaignBatch<P>(c: Campaign<P>, id: string, now: Date = new Date(), deps: ReminderDeps = liveDeps()): Promise<CampaignBatch> {
  const row = await prisma.memberOfferReminder.findUnique({ where: { id }, include: { offer: { select: { expiresAt: true } } } })
  if (!row || row.slug !== c.slug) throw new Error("No such email.")
  if (row.offer.expiresAt.getTime() <= now.getTime()) throw new Error("The member offer has expired. Nothing more will be sent.")

  const pending = await prisma.memberOfferReminderSend.findMany({
    where: { reminderId: id, sentAt: null, skippedAt: null },
    select: { id: true, userId: true, code: true, failedAt: true },
    orderBy: { id: "asc" },
  })
  // Anyone not yet tried goes first, so an address that keeps failing waits
  // at the back rather than holding up the people behind it.
  const batch = [...pending.filter((p) => !p.failedAt), ...pending.filter((p) => p.failedAt)].slice(0, CAMPAIGN_BATCH_SIZE)
  let sent = 0
  let failed = 0
  let skipped = 0

  if (batch.length > 0) {
    const users = await prisma.user.findMany({ where: { id: { in: batch.map((b) => b.userId) } }, select: USER_SELECT })
    const byId = new Map(users.map((u) => [u.id, u]))
    const withCode = batch.filter((b) => b.code)
    const codeRows = await prisma.memberOfferCode.findMany({ where: { code: { in: withCode.map((b) => b.code) } }, select: { code: true, promotionCodeId: true } })
    const pcId = new Map(codeRows.map((x) => [x.code, x.promotionCodeId]))
    // "unknown" is an answer too, and it is not a no: they wait for a later batch.
    const redeemed = new Map<string, boolean | "unknown">()
    await Promise.all(
      withCode.map(async (b) => {
        const pc = pcId.get(b.code)
        if (!pc) return void redeemed.set(b.code, "unknown")
        try {
          redeemed.set(b.code, await deps.isRedeemed(pc))
        } catch (error) {
          console.error(`[${c.slug}] could not read code ${b.code}:`, error)
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
        const person: Person | null = user
          ? {
              userId: user.id,
              email: user.email,
              emailMarketingOptIn: user.emailMarketingOptIn,
              productUpdateOptIn: user.productUpdateOptIn,
              owns: ownedPlugins(user.purchases),
              code: b.code || null,
              codeRedeemed: used === true,
            }
          : null
        let parts: P | string = person ? c.parts(person) : "account-gone"
        let setUrl: string | null = null
        if (typeof parts !== "string" && c.wantsSet(parts)) {
          setUrl = await completeSetLink(b.userId, c.setEndsAt, now)
          if (!setUrl) parts = c.withoutSet(parts)
        }
        if (!person || typeof parts === "string") {
          await prisma.memberOfferReminderSend.update({ where: { id: b.id }, data: { skippedAt: new Date() } })
          skipped++
          continue
        }

        const claimed = await prisma.memberOfferReminderSend.updateMany({
          where: { id: b.id, sentAt: null, skippedAt: null },
          data: { sentAt: new Date(), failedAt: null, variant: c.variant(parts), email: person.email },
        })
        // Another request got to them first.
        if (claimed.count === 0) continue

        const unsub = unsubscribeUrl(APP_URL, person.userId)
        const offerUrl = person.code && !person.codeRedeemed ? memberOfferUrl(person.code) : null
        const html = c.fill(row.bodyHtml, parts, person, { offerUrl, setUrl, unsubscribeUrl: unsub })
        try {
          await sendReleaseAnnouncementEmail(transporter, person.email, { subject: c.subject(parts), html, unsubscribeUrl: unsub })
          sent++
        } catch (error) {
          // One bad address must not stop the send. It is written down and a
          // later batch tries that person again.
          console.error(`[${c.slug}] failed for ${person.email}:`, error)
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
  // Not done while anyone is left - failures included, so the admin page
  // keeps offering the retry. A batch that got nowhere stops the loop.
  return { attempted: batch.length, sent, failed, skipped, totalRecipients, totalSent, totalSkipped, done: finished || (sent === 0 && skipped === 0) }
}

/** Every sample version to one address, with example values and the admin's
 *  own unsubscribe link. Nothing is recorded and nothing is asked of Stripe. */
export async function sendCampaignTest<P>(c: Campaign<P>, to: string, unsubscribeFor: string): Promise<void> {
  const existing = await prisma.memberOfferReminder.findUnique({ where: { slug: c.slug } })
  const offer = await prisma.memberOffer.findUnique({ where: { slug: c.offerSlug } })
  const tpl = existing?.bodyHtml ?? templateFor(c, offer?.amountOffCents ?? 1000, offer?.expiresAt ?? c.setEndsAt)
  const unsub = unsubscribeUrl(APP_URL, unsubscribeFor)
  const transporter = createBulkTransporter()
  try {
    for (const s of c.samples(tpl)) {
      await sendReleaseAnnouncementEmail(transporter, to, {
        subject: `[TEST, ${s.variant}] ${s.subject}`,
        html: s.html.split(SAMPLE_UNSUBSCRIBE).join(unsub),
        unsubscribeUrl: unsub,
      })
    }
  } finally {
    transporter.close()
  }
}

/** What samples() puts where the unsubscribe link goes; a test send swaps in
 *  the admin's own. */
export const SAMPLE_UNSUBSCRIBE = `${APP_URL}/unsubscribe`
