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
  // and exposes the real client in do-connecting-ip; production always has
  // one or the other. A fallback to a single fixed key would put every
  // client missing both (local dev, or a misconfigured proxy) in one shared
  // bucket, letting them lock each other out - a random per-request key
  // instead leaves that path effectively unthrottled rather than unfairly
  // throttled, which is fine since it is not a shape production traffic has.
  const ip =
    request.headers.get("do-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    `unknown:${crypto.randomUUID()}`
  if (!perIp.allow(ip)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ owned: [] })
  }

  // Plain, pre-lowercased equals - not Prisma's `mode: "insensitive"`, which
  // compiles to an unescaped ILIKE and lets "%"/"_" in the address act as
  // wildcards ("%@%.%" would match anyone, defeating the rate limit above).
  // Safe because every write to User.email normalises to lowercase first -
  // see the identical comment on findByEmail in lib/plugin-purchase-grant.ts.
  //
  // Wrapped because a shape that still passes the regex above (e.g. an
  // embedded NUL byte) can make Postgres itself raise on the query - that is
  // still just "this isn't an address we know", the same as any other
  // no-match, not a fault worth a 500.
  let user: { id: string } | null
  try {
    user = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    })
  } catch (e) {
    console.error("[cart owned] lookup failed", e)
    return NextResponse.json({ owned: [] })
  }
  if (!user) return NextResponse.json({ owned: [] })

  const purchases = await prisma.purchase.findMany({
    where: { userId: user.id, product: { in: [...PLUGIN_PRODUCTS] } },
    select: { product: true },
  })
  return NextResponse.json({ owned: purchases.map((p) => p.product) })
}
