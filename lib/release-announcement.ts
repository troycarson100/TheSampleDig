import { prisma } from "@/lib/db"
import { PRODUCTS } from "@/lib/products"
import { RELEASE_RECIPIENT_USER_FILTER } from "@/lib/release-recipients"
import { unsubscribeUrl } from "@/lib/unsubscribe-token"
import {
  createBulkTransporter,
  releaseAnnouncementSubject,
  renderReleaseAnnouncementHtml,
  sendReleaseAnnouncementEmail,
} from "@/lib/email"
import type { PluginProduct } from "@/lib/plugin-products"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

// Sent per HTTP request. Small on purpose: DO App Platform will cut a long
// request, and a blast that dies mid-flight must never be the thing that
// decides whether customers got mailed. The admin UI calls sendBatch in a loop
// until done, which also gives it a real progress bar for free.
export const BATCH_SIZE = 25

export type Recipient = { userId: string; email: string }

/** Everyone who owns the product and still accepts email from us: the
 *  marketing opt-out and the version-alerts toggle both suppress. The rule
 *  lives in release-recipients.ts so the count in releasePreview and the
 *  send loop can never disagree about who is on the list.
 *  Comp-code redemptions create Purchase rows too, so gifted users are
 *  included - they own it exactly as much as a payer does. */
export async function releaseRecipients(product: PluginProduct): Promise<Recipient[]> {
  const rows = await prisma.purchase.findMany({
    where: { product, user: RELEASE_RECIPIENT_USER_FILTER },
    select: { user: { select: { id: true, email: true } } },
    orderBy: { createdAt: "asc" },
  })
  // Purchase is unique on (userId, product) and User.email is unique, so this
  // cannot contain duplicates - no dedupe pass needed.
  return rows.map((r) => ({ userId: r.user.id, email: r.user.email }))
}

export type ReleasePreview = {
  product: PluginProduct
  name: string
  version: string
  subject: string
  bodyHtml: string
  notes: string[]
  recipientCount: number
  announcement: {
    id: string
    createdAt: Date
    completedAt: Date | null
    sentCount: number
    failedCount: number
    failedEmails: string[]
    sentByEmail: string | null
  } | null
}

/** The changelog entry matching the product's CURRENT version. Returns null
 *  when they've drifted apart - shipping a version bump without adding its
 *  changelog entry should block the send rather than mail an empty list. */
export function currentReleaseNotes(product: PluginProduct) {
  const def = PRODUCTS[product]
  if (!def?.version) return null
  const entry = def.changelog?.find((c) => c.version === def.version)
  if (!entry || entry.notes.length === 0) return null
  return { version: def.version, notes: entry.notes, name: def.name }
}

export async function releasePreview(product: PluginProduct): Promise<ReleasePreview | null> {
  const release = currentReleaseNotes(product)
  if (!release) return null

  const [recipientCount, existing] = await Promise.all([
    prisma.purchase.count({ where: { product, user: RELEASE_RECIPIENT_USER_FILTER } }),
    prisma.releaseAnnouncement.findUnique({
      where: { product_version: { product, version: release.version } },
    }),
  ])

  return {
    product,
    name: release.name,
    version: release.version,
    // An in-flight or finished blast previews the body that was ACTUALLY
    // snapshotted, not a freshly rendered one - otherwise editing the
    // changelog after sending would silently rewrite history in the UI.
    subject: existing?.subject ?? releaseAnnouncementSubject(release.name, release.version),
    bodyHtml:
      existing?.bodyHtml ??
      renderReleaseAnnouncementHtml({ product: release.name, version: release.version, notes: release.notes }),
    notes: release.notes,
    recipientCount,
    announcement: existing
      ? {
          // Exposed so the admin UI can resume an incomplete blast directly
          // rather than re-claiming, which would always collide.
          id: existing.id,
          createdAt: existing.createdAt,
          completedAt: existing.completedAt,
          sentCount: existing.sentEmails.length,
          failedCount: existing.failedEmails.length,
          failedEmails: existing.failedEmails,
          sentByEmail: existing.sentByEmail,
        }
      : null,
  }
}

export type ClaimResult =
  | { ok: true; announcementId: string }
  | { ok: false; error: string }

/** Reserves (product, version) BEFORE anything is mailed. The unique index
 *  does the work: a concurrent or repeated claim loses the race and is told
 *  no. Nothing here sends - that's sendBatch, which refuses to run without a
 *  claim. This ordering is the whole safety story, since there is no unsend. */
export async function claimRelease(product: PluginProduct, sentByEmail: string | null): Promise<ClaimResult> {
  const release = currentReleaseNotes(product)
  if (!release) {
    return {
      ok: false,
      error: `No changelog entry matching ${product} v${PRODUCTS[product]?.version ?? "?"}. Add one to lib/products.ts before announcing.`,
    }
  }

  try {
    const row = await prisma.releaseAnnouncement.create({
      data: {
        product,
        version: release.version,
        subject: releaseAnnouncementSubject(release.name, release.version),
        bodyHtml: renderReleaseAnnouncementHtml({
          product: release.name,
          version: release.version,
          notes: release.notes,
        }),
        sentByEmail,
      },
    })
    return { ok: true, announcementId: row.id }
  } catch {
    // Unique violation - already claimed. Resuming an incomplete blast is a
    // separate, explicit action; this path never silently continues one.
    return {
      ok: false,
      error: `${product} v${release.version} has already been announced. Bump the version in lib/products.ts to send a new one.`,
    }
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

/** Mails the next BATCH_SIZE recipients who aren't already in sentEmails.
 *  Idempotent by construction: re-running only ever picks up addresses that
 *  have not been mailed, so a retried request cannot double-send. */
export async function sendBatch(announcementId: string): Promise<BatchResult> {
  const announcement = await prisma.releaseAnnouncement.findUnique({ where: { id: announcementId } })
  if (!announcement) throw new Error("No such announcement.")

  const product = announcement.product as PluginProduct
  const recipients = await releaseRecipients(product)

  // failedEmails are NOT skipped: a retry should get another go at an address
  // that hit a transient SMTP error. They're removed from the failed list if
  // they succeed this time.
  const alreadySent = new Set(announcement.sentEmails)
  const pending = recipients.filter((r) => !alreadySent.has(r.email))
  const batch = pending.slice(0, BATCH_SIZE)

  if (batch.length === 0) {
    await prisma.releaseAnnouncement.update({
      where: { id: announcementId },
      data: { completedAt: announcement.completedAt ?? new Date() },
    })
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      totalRecipients: recipients.length,
      totalSent: announcement.sentEmails.length,
      done: true,
    }
  }

  const transporter = createBulkTransporter()
  const sent: string[] = []
  const failed: string[] = []

  try {
    for (const r of batch) {
      try {
        await sendReleaseAnnouncementEmail(transporter, r.email, {
          subject: announcement.subject,
          html: announcement.bodyHtml,
          unsubscribeUrl: unsubscribeUrl(APP_URL, r.userId),
        })
        sent.push(r.email)
      } catch (error) {
        // One bad address must not abort the blast. It's recorded and the
        // admin can retry the batch, which will pick it up again.
        console.error(`[release] send failed for ${r.email}:`, error)
        failed.push(r.email)
      }
    }
  } finally {
    transporter.close()
  }

  const remaining = pending.length - batch.length
  const nextFailed = [
    ...announcement.failedEmails.filter((e) => !sent.includes(e)),
    ...failed.filter((e) => !announcement.failedEmails.includes(e)),
  ]

  const updated = await prisma.releaseAnnouncement.update({
    where: { id: announcementId },
    data: {
      sentEmails: { push: sent },
      failedEmails: nextFailed,
      // Only "done" once nothing is pending AND nothing failed - a blast with
      // outstanding failures stays open so the UI keeps offering the retry.
      completedAt: remaining === 0 && nextFailed.length === 0 ? new Date() : null,
    },
  })

  return {
    attempted: batch.length,
    sent: sent.length,
    failed: failed.length,
    totalRecipients: recipients.length,
    totalSent: updated.sentEmails.length,
    done: remaining === 0,
  }
}
