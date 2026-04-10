import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Stripe from "stripe"
import { prisma } from "@/lib/db"

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  )
}

/** Whether this user has a Stripe Customer (can open the billing portal). */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })

    return NextResponse.json({ eligible: Boolean(user?.stripeCustomerId) })
  } catch (e) {
    console.error("[Stripe billing-portal GET]", e)
    return NextResponse.json({ error: "Failed to load billing state" }, { status: 500 })
  }
}

/** Create a Stripe Customer Portal session (cancel subscription, trial, payment method, invoices). */
export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 500 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Subscribe from Pricing & Pro first." },
        { status: 400 }
      )
    }

    const stripe = new Stripe(secret)
    const baseUrl = appBaseUrl().replace(/\/$/, "")
    const returnUrl = `${baseUrl}/settings`

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    })

    if (!portalSession.url) {
      return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 })
    }

    return NextResponse.json({ url: portalSession.url })
  } catch (e: unknown) {
    console.error("[Stripe billing-portal POST]", e)
    const message = e instanceof Error ? e.message : "Portal failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
