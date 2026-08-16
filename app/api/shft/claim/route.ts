import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordAffiliateReferral } from "@/lib/affiliate"
import { generateLicenseKey } from "@/lib/license-key"

// Called by the success page with the Stripe checkout session id. Confirms the
// session is a paid shft purchase belonging to the signed-in user, then records
// the Purchase immediately (self-heals if the webhook is delayed) so the
// /products page shows the download right away.
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
    const isShft = checkout.metadata?.product === "shft"
    const buyerId = checkout.client_reference_id ?? checkout.metadata?.userId
    if (!paid || !isShft || buyerId !== session.user.id) {
      return NextResponse.json({ error: "No completed shft purchase for your account." }, { status: 403 })
    }

    const purchase = await prisma.purchase.upsert({
      where: { userId_product: { userId: session.user.id, product: "shft" } },
      create: {
        userId: session.user.id,
        product: "shft",
        stripeSessionId: checkout.id,
        licenseKey: generateLicenseKey(),
      },
      update: { stripeSessionId: checkout.id },
    })
    // The webhook may have created this row before licence keys existed, or
    // before this deploy. Fill the gap rather than leaving a keyless purchase.
    if (!purchase.licenseKey) {
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: { licenseKey: generateLicenseKey() },
      })
    }
    await recordAffiliateReferral(checkout, purchase.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[shft claim]", e)
    return NextResponse.json({ error: "Could not verify your purchase." }, { status: 500 })
  }
}
