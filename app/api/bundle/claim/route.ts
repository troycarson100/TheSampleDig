import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordAffiliateReferral } from "@/lib/affiliate"
import { generateLicenseKey } from "@/lib/license-key"

// Called by /plugins after a bundle purchase. Confirms the session is a paid
// bundle purchase belonging to the signed-in user, then records BOTH Purchase
// rows immediately (self-heals if the webhook is delayed).
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 })
  }

  let sessionId: string | undefined
  try {
    sessionId = (await request.json())?.sessionId
  } catch {
    /* handled below */
  }
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "Missing session id." }, { status: 400 })
  }

  try {
    const stripe = new Stripe(secret)
    const checkout = await stripe.checkout.sessions.retrieve(sessionId)
    const paid = checkout.payment_status === "paid"
    const isBundle = checkout.metadata?.product === "bundle"
    const buyerId = checkout.client_reference_id ?? checkout.metadata?.userId
    if (!paid || !isBundle || buyerId !== session.user.id) {
      return NextResponse.json({ error: "No completed bundle purchase for your account." }, { status: 403 })
    }

    // Grant both plugins. Upsert never regenerates an existing key, and the
    // updateMany-with-null-WHERE key fill is race-safe against the webhook.
    let shftPurchaseId: string | null = null
    for (const product of ["shft", "drft"] as const) {
      const purchase = await prisma.purchase.upsert({
        where: { userId_product: { userId: session.user.id, product } },
        create: {
          userId: session.user.id,
          product,
          stripeSessionId: checkout.id,
          licenseKey: generateLicenseKey(),
        },
        update: { stripeSessionId: checkout.id },
      })
      if (!purchase.licenseKey) {
        await prisma.purchase.updateMany({
          where: { id: purchase.id, licenseKey: null },
          data: { licenseKey: generateLicenseKey() },
        })
      }
      if (product === "shft") shftPurchaseId = purchase.id
    }
    // One referral per checkout session — against the shft row only (the
    // relation is one-to-one; crediting both rows would double-pay).
    if (shftPurchaseId) {
      await recordAffiliateReferral(checkout, shftPurchaseId)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[bundle claim]", e)
    return NextResponse.json({ error: "Could not verify your purchase." }, { status: 500 })
  }
}
