import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { PLUGIN_PRODUCTS } from "@/lib/plugin-products"
import { SlidingWindowLimiter } from "@/lib/resend-rate-limit"

// What does this email already own? Used by the checkout page before payment,
// so a returning buyer's cart can be trimmed of what they already have before
// they ever reach Stripe. The actual guard is still /api/cart/checkout, which
// looks this up again itself rather than trusting whatever this endpoint (or
// the client) said a moment earlier.
//
// Telling an anonymous visitor which plugins an address owns reveals that the
// address has an account. That is the price of not silently altering someone's
// cart, and it is bounded: nothing beyond plugin ownership is revealed, the
// response is shaped identically for a known and an unknown address, and the
// rate limit below makes enumerating addresses impractical.
const MINUTE = 60_000
const perIp = new SlidingWindowLimiter(10, MINUTE)

export async function POST(request: Request) {
  // DigitalOcean App Platform puts its own ingress address in x-forwarded-for
  // and exposes the real client in do-connecting-ip; locally there is neither.
  const ip =
    request.headers.get("do-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  if (!perIp.allow(ip)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ owned: [] })
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ owned: [] })

  const purchases = await prisma.purchase.findMany({
    where: { userId: user.id, product: { in: [...PLUGIN_PRODUCTS] } },
    select: { product: true },
  })
  return NextResponse.json({ owned: purchases.map((p) => p.product) })
}
