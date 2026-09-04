import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token"

// No session required and none possible: this is reached from an email client,
// often on a device that has never signed in. The HMAC in the token IS the
// authorisation, and it only ever grants this one narrow write.
//
// POST rather than GET for the actual change, because mail scanners and link
// prefetchers follow GETs and would unsubscribe people who never clicked.
// Gmail's List-Unsubscribe One-Click also POSTs here directly.
export async function POST(request: Request) {
  let token: string | null = null

  // Two callers with two encodings: the confirm button on /unsubscribe sends
  // JSON, while a mail client's One-Click sends form data (or nothing but the
  // query string). Accept all three rather than 400 on the one that matters
  // most for deliverability.
  const url = new URL(request.url)
  token = url.searchParams.get("token")

  if (!token) {
    const contentType = request.headers.get("content-type") || ""
    try {
      if (contentType.includes("application/json")) {
        const body = (await request.json()) ?? {}
        if (typeof body.token === "string") token = body.token
      } else if (contentType.includes("form")) {
        const form = await request.formData()
        const value = form.get("token")
        if (typeof value === "string") token = value
      }
    } catch {
      // Fall through to the invalid-token response below.
    }
  }

  const userId = verifyUnsubscribeToken(token)
  if (!userId) {
    return NextResponse.json({ error: "This unsubscribe link is not valid." }, { status: 400 })
  }

  // updateMany, not update: a token for a since-deleted account should report
  // success rather than throw a 500 at a mail provider's One-Click bot.
  await prisma.user.updateMany({
    where: { id: userId },
    data: { productUpdateOptIn: false },
  })

  return NextResponse.json({ ok: true })
}
