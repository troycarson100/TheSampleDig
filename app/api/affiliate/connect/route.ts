import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ensureOnboardingUrl } from "@/lib/affiliate-stripe"

// Starts (or resumes) Stripe Express onboarding for a creator. Identified by
// their private dashboard token, or by the signed-in linked account.
export async function POST(request: Request) {
  let token: string | null = null
  try {
    token = (await request.json())?.token ?? null
  } catch {
    /* session path */
  }

  let affiliate = null
  if (token && typeof token === "string") {
    affiliate = await prisma.affiliate.findUnique({ where: { dashboardToken: token } })
  } else {
    const session = await auth()
    if (session?.user?.id) {
      affiliate = await prisma.affiliate.findUnique({ where: { userId: session.user.id } })
    }
  }
  if (!affiliate || !affiliate.active) {
    return NextResponse.json({ error: "Unknown affiliate." }, { status: 404 })
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const returnUrl = token ? `${baseUrl}/affiliate/${token}` : `${baseUrl}/affiliate`

  try {
    const url = await ensureOnboardingUrl(affiliate.id, returnUrl)
    return NextResponse.json({ url })
  } catch (e) {
    console.error("[affiliate connect]", e)
    const raw = e instanceof Error ? e.message : ""
    // Stripe's words when the platform hasn't finished Connect's own setup.
    // That is ours to fix, not the creator's, so they are told it in theirs.
    const message = /signed up for Connect|connect.*(not|isn't) (enabled|activated)/i.test(raw)
      ? "Payouts aren't switched on yet - Sample Roll is finishing setting them up. Your earnings still collect here in the meantime."
      : raw || "Stripe setup is unavailable right now."
    // 422, never 503: DigitalOcean swaps a 503 for its own HTML error page,
    // so the reason never reached the button, which then failed to parse it
    // ("Unexpected token '<'", 2026-10-05).
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
