import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { PLUGIN_PRODUCTS, isPluginProduct } from "@/lib/plugin-products"
import {
  claimRelease,
  releasePreview,
  sendBatch,
  currentReleaseNotes,
} from "@/lib/release-announcement"
import {
  createBulkTransporter,
  sendReleaseAnnouncementEmail,
  releaseAnnouncementSubject,
  renderReleaseAnnouncementHtml,
} from "@/lib/email"
import { unsubscribeUrl } from "@/lib/unsubscribe-token"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

/** Every product's current version, recipient count, rendered email and
 *  whether it has already been announced. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const releases = await Promise.all(PLUGIN_PRODUCTS.map((p) => releasePreview(p)))

  return NextResponse.json({
    releases: PLUGIN_PRODUCTS.map((product, i) => ({
      product,
      // null when lib/products.ts has a version with no matching changelog
      // entry - surfaced in the UI as a blocked send rather than hidden.
      preview: releases[i],
    })),
  })
}

type Body = {
  product?: unknown
  // "test"  - send the real email to the signed-in admin only, nothing recorded
  // "claim" - reserve (product, version); refuses if already announced
  // "batch" - mail the next chunk of an existing claim
  action?: unknown
  announcementId?: unknown
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  let body: Body
  try {
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  if (!isPluginProduct(body.product)) {
    return NextResponse.json({ error: "Pick a product: shft or drft." }, { status: 400 })
  }
  const product = body.product
  const adminEmail = session.user?.email ?? null

  if (body.action === "test") {
    if (!adminEmail) return NextResponse.json({ error: "No admin address to send to." }, { status: 400 })

    const release = currentReleaseNotes(product)
    if (!release) {
      return NextResponse.json(
        { error: `No changelog entry matching the current ${product} version.` },
        { status: 400 },
      )
    }

    // Rendered fresh rather than read from a claim: the whole point of the
    // test is to see what the NEXT blast would look like, before claiming.
    const transporter = createBulkTransporter()
    try {
      await sendReleaseAnnouncementEmail(transporter, adminEmail, {
        subject: `[TEST] ${releaseAnnouncementSubject(release.name, release.version)}`,
        html: renderReleaseAnnouncementHtml({
          product: release.name,
          version: release.version,
          notes: release.notes,
        }),
        // The admin's own real token, so the unsubscribe link in the test is
        // the live one and clicking it genuinely opts them out - better to
        // find that out here than in the blast.
        unsubscribeUrl: unsubscribeUrl(APP_URL, session.user!.id!),
      })
    } catch (error) {
      console.error("[releases] test send failed:", error)
      return NextResponse.json({ error: "Test send failed. Check the SMTP settings." }, { status: 500 })
    } finally {
      transporter.close()
    }

    return NextResponse.json({ ok: true, sentTo: adminEmail })
  }

  if (body.action === "claim") {
    const result = await claimRelease(product, adminEmail)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
    return NextResponse.json({ announcementId: result.announcementId })
  }

  if (body.action === "batch") {
    if (typeof body.announcementId !== "string") {
      return NextResponse.json({ error: "announcementId is required." }, { status: 400 })
    }
    // Confirms the id belongs to the product named in the body, so a stale
    // client can't drive a batch against a different product's blast.
    const announcement = await prisma.releaseAnnouncement.findUnique({
      where: { id: body.announcementId },
      select: { product: true },
    })
    if (!announcement || announcement.product !== product) {
      return NextResponse.json({ error: "No such announcement." }, { status: 404 })
    }

    try {
      return NextResponse.json(await sendBatch(body.announcementId))
    } catch (error) {
      console.error("[releases] batch failed:", error)
      return NextResponse.json({ error: "Batch failed. Retry to pick up where it stopped." }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
