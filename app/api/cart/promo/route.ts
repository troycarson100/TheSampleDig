import { NextResponse } from "next/server"
import Stripe from "stripe"
import { normalizePromoCode } from "@/lib/cart-promo"
import { lookupPromo } from "@/lib/cart-promo-lookup"
import { SlidingWindowLimiter } from "@/lib/resend-rate-limit"

// What is this promo code worth? Asked by the box in the cart drawer and on
// the checkout page, so the order can show its discount before the buyer
// leaves for Stripe.
//
// Nothing here changes what anyone is charged. /api/cart/checkout looks the
// code up again itself and takes nothing this route said on trust; a reply
// from here only ever decides what a page displays.
//
// Rate-limited per IP because every reply is a yes or a no about a code, which
// makes this route a way to guess codes if it answers as fast as it is asked.
// Ten a minute is the same allowance /api/cart/owned and /api/cart/checkout
// give, and is far more than someone typing a code they were given needs.
const MINUTE = 60_000
const perIp = new SlidingWindowLimiter(10, MINUTE)

export async function POST(request: Request) {
  // See /api/cart/checkout for why the fallback is a random key, not a shared one.
  const ip =
    request.headers.get("do-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    `unknown:${crypto.randomUUID()}`
  if (!perIp.allow(ip)) {
    return NextResponse.json({ reason: "rate_limited" }, { status: 429 })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ reason: "unavailable" }, { status: 503 })
  }

  const body: { code?: unknown } = (await request.json().catch(() => null)) ?? {}
  const code = normalizePromoCode(body.code)
  // A string that cannot be a code is answered the same way as a code that
  // does not exist, and without asking Stripe: there is nothing to look up.
  if (!code) {
    return NextResponse.json({ reason: "not_valid" }, { status: 404 })
  }

  try {
    const found = await lookupPromo(new Stripe(secret), code)
    if (!found) return NextResponse.json({ reason: "not_valid" }, { status: 404 })
    // The offer, never the promotion code's id: the page has no use for it,
    // and checkout finds its own.
    return NextResponse.json({ offer: found.offer })
  } catch (e) {
    console.error("[cart promo]", e)
    return NextResponse.json({ reason: "unavailable" }, { status: 502 })
  }
}
