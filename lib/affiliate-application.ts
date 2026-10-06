import { prisma } from "@/lib/db"
import { accountIdByEmail } from "@/lib/account-by-email"
import { adminEmails } from "@/lib/admin-emails"
import { generateDashboardToken } from "@/lib/affiliate"
import {
  APPLICATION_PLUGIN_LABEL,
  CREATOR_COMMISSION_PERCENT,
  suggestCode,
  type ApplicationInput,
  type ApplicationPlugin,
} from "@/lib/affiliate-application-logic"
import { creatorCountryName } from "@/lib/creator-countries"
import { sendCreatorApplicationNotice, sendCreatorWelcomeEmail } from "@/lib/email"

// The creator program's applications, the I/O. The rules are in
// affiliate-application-logic.ts; the form is app/creators.

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000"
}

export type SubmitResult = { ok: true; duplicate: boolean }

/**
 * Records an application and tells the admins. One open application per
 * address: a second while the first is pending is taken as a resend and
 * changes nothing, so a double-click or an impatient applicant can't fill the
 * admin's list.
 */
export async function submitApplication(input: ApplicationInput): Promise<SubmitResult> {
  const open = await prisma.affiliateApplication.findFirst({ where: { email: input.email, status: "pending" }, select: { id: true } })
  if (open) return { ok: true, duplicate: true }
  await prisma.affiliateApplication.create({ data: input })
  try {
    await sendCreatorApplicationNotice(adminEmails(), {
      ...input,
      country: creatorCountryName(input.country),
      plugin: APPLICATION_PLUGIN_LABEL[input.plugin as ApplicationPlugin] ?? input.plugin,
    })
  } catch (e) {
    // The application is saved and shows in /admin/affiliates either way.
    console.error("[creator application] admin notice failed", e)
  }
  return { ok: true, duplicate: false }
}

export type DecideResult =
  | { ok: true; affiliate?: { id: string; code: string; dashboardUrl: string }; emailed?: boolean }
  | { ok: false; error: string }

/**
 * Approves an application: makes the creator - at the program's rate, in the
 * country they applied from, linked to their Sample Roll account if they have
 * one - and emails them their dashboard. Claimed with a conditional update
 * first, so two admins (or two clicks) can't make two creators.
 */
export async function approveApplication(id: string): Promise<DecideResult> {
  const claimed = await prisma.affiliateApplication.updateMany({
    where: { id, status: "pending" },
    data: { status: "approved", decidedAt: new Date() },
  })
  if (claimed.count === 0) return { ok: false, error: "That application has already been decided." }
  const app = await prisma.affiliateApplication.findUniqueOrThrow({ where: { id } })

  try {
    const taken = new Set((await prisma.affiliate.findMany({ select: { code: true } })).map((a) => a.code))
    const userId = await accountIdByEmail(prisma, app.email)
    const linkedElsewhere = userId ? await prisma.affiliate.findUnique({ where: { userId }, select: { id: true } }) : null
    const affiliate = await prisma.affiliate.create({
      data: {
        code: suggestCode(app.name, taken),
        name: app.name,
        email: app.email,
        country: app.country,
        commissionType: "percent",
        commissionPercent: CREATOR_COMMISSION_PERCENT,
        dashboardToken: generateDashboardToken(),
        // An account can back only one creator; a second stays unlinked.
        userId: userId && !linkedElsewhere ? userId : null,
        notes: `Applied ${app.createdAt.toISOString().slice(0, 10)} for ${APPLICATION_PLUGIN_LABEL[app.plugin as ApplicationPlugin] ?? app.plugin}: ${app.message}`.slice(0, 2000),
      },
    })
    await prisma.affiliateApplication.update({ where: { id }, data: { affiliateId: affiliate.id } })

    const dashboardUrl = `${baseUrl()}/affiliate/${affiliate.dashboardToken}`
    const pluginPath = app.plugin === "all" ? "fltr" : app.plugin
    let emailed = false
    try {
      await sendCreatorWelcomeEmail(app.email, {
        name: app.name,
        code: affiliate.code,
        percent: CREATOR_COMMISSION_PERCENT,
        dashboardUrl,
        shareUrl: `${baseUrl()}/${pluginPath}?ref=${affiliate.code}`,
      })
      emailed = true
    } catch (e) {
      console.error("[creator application] welcome email failed", e)
    }
    return { ok: true, affiliate: { id: affiliate.id, code: affiliate.code, dashboardUrl }, emailed }
  } catch (e) {
    // Put it back so it can be approved again rather than stuck half-done.
    await prisma.affiliateApplication.update({ where: { id }, data: { status: "pending", decidedAt: null } }).catch(() => {})
    console.error("[creator application] approve failed", e)
    return { ok: false, error: "Couldn't create the creator. Nothing was sent - try again." }
  }
}

export async function declineApplication(id: string): Promise<DecideResult> {
  const r = await prisma.affiliateApplication.updateMany({ where: { id, status: "pending" }, data: { status: "declined", decidedAt: new Date() } })
  return r.count === 1 ? { ok: true } : { ok: false, error: "That application has already been decided." }
}
