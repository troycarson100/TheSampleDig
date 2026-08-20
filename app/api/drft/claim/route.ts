import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordAffiliateReferral } from "@/lib/affiliate"
import { generateLicenseKey } from "@/lib/license-key"

// Called by the success page with the Stripe checkout session id. Confirms the
// session is a paid drft purchase belonging to the signed-in user, then records
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
    const isDrft = checkout.metadata?.product === "drft"
    const buyerId = checkout.client_reference_id ?? checkout.metadata?.userId
    if (!paid || !isDrft || buyerId !== session.user.id) {
      return NextResponse.json({ error: "No completed drft purchase for your account." }, { status: 403 })
    }

    const purchase = await prisma.purchase.upsert({
      where: { userId_product: { userId: session.user.id, product: "drft" } },
      create: {
        userId: session.user.id,
        product: "drft",
        stripeSessionId: checkout.id,
        licenseKey: generateLicenseKey(),
      },
      update: { stripeSessionId: checkout.id },
    })
    // The webhook and this route can run concurrently on the same purchase.
    // updateMany with licenseKey:null in the WHERE means the loser writes
    // nothing, so the buyer is never emailed a key that lost the race.
    if (!purchase.licenseKey) {
      await prisma.purchase.updateMany({
        where: { id: purchase.id, licenseKey: null },
        data: { licenseKey: generateLicenseKey() },
      })
    }
    await recordAffiliateReferral(checkout, purchase.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[drft claim]", e)
    return NextResponse.json({ error: "Could not verify your purchase." }, { status: 500 })
  }
}
