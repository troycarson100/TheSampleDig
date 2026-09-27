import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createPluginCheckoutSession, readAffiliateCodeFromCookie, buyerFromSession } from "@/lib/plugin-checkout"
import { checkCart } from "@/lib/cart-ownership"
import { cartTotals } from "@/lib/cart-pricing"
import { PLUGIN_PRODUCTS, type PluginProduct } from "@/lib/plugin-products"
import { SlidingWindowLimiter } from "@/lib/resend-rate-limit"

// Checkout for an arbitrary cart of plugins, built from a cart's worth of
// localStorage state or a hand-crafted request body - neither is trusted for
// what it may buy. What the buyer owns is looked up fresh, here, from their
// session or the email they give us, and checked against the cart with
// checkCart before a single price id is touched. A previous review on this
// branch found a bundle route hardcoded to two of the three plugins, letting
// an owner of the third read as owning nothing and pay full price for a
// bundle containing it; this route builds its line items from what checkCart
// says is actually sellable, not from a fixed list, so that shape of bug
// cannot recur here.
//
// The guest email path was a second version of the same bug: an unvalidated
// address was checked for ownership but never bound to the session Stripe
// actually charged, so the checked identity and the charged identity could
// differ - on a typo, or on purpose. Both halves are fixed together below:
// the address is validated the same way /api/cart/owned validates it, and it
// is passed to Stripe as customer_email, which Stripe renders read-only, so
// the address that was checked is the address Checkout collects payment for.
//
// Rate-limited per IP for the same reason /api/cart/owned is: the 409 replies
// below say exactly what an address owns, which makes this route as good an
// ownership oracle as that one if left unthrottled.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MINUTE = 60_000
// Tighter than /api/cart/owned's 10/min: every request here also creates a
// real (if unpaid) Stripe Checkout Session, not just a read, so there is more
// reason to keep it low. A genuine buyer does not POST here more than a
// couple of times a minute even fumbling a cart or an email typo; 5/min still
// leaves room for that while cutting full-speed ownership enumeration to a
// fifth of what /api/cart/owned already limits it to.
const perIp = new SlidingWindowLimiter(5, MINUTE)

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

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const body: { ids?: unknown; email?: unknown } = (await request.json().catch(() => null)) ?? {}
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : []
  const postedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""

  // Rule 1: resolve the buyer. A signed-in session always wins over a posted
  // email. A guest's email must look like an email - a malformed or empty
  // one is refused outright rather than silently treated as "owns nothing",
  // which is what let a one-character string sail through as an identity.
  const session = await auth()
  const buyer = buyerFromSession(session)
  if (!buyer && !EMAIL_RE.test(postedEmail)) {
    return NextResponse.json({ error: "Sign in or provide a valid email to check out." }, { status: 400 })
  }

  // Rule 2: what does this buyer actually own? Never taken from the request.
  const ownedIds = await ownedProductsFor(buyer?.id ?? null, postedEmail)

  // Rule 3: the client's cart is never trusted. A cart with some owned items
  // reports "already_owned" and names them, even when it is fully owned -
  // that is still accurate and actionable. "empty" is reserved for a cart
  // that names nothing owned at all: nothing valid was requested to begin
  // with (an empty or all-garbage `ids`). Checking owned first is what makes
  // a fully-owned cart say what it owns instead of falsely claiming there was
  // nothing there.
  const check = checkCart(ids, ownedIds)
  if (check.owned.length > 0) {
    return NextResponse.json({ reason: "already_owned", owns: check.owned }, { status: 409 })
  }
  if (check.empty) {
    return NextResponse.json({ reason: "empty" }, { status: 409 })
  }

  // Rule 4: one line item at the bundle price when the sellable set is every
  // plugin, otherwise one line item per plugin at its own price.
  const totals = cartTotals(check.sellable)
  const priced = totals.bundleApplied
    ? { product: "bundle" as const, lineItems: [withPrice(process.env.STRIPE_BUNDLE3_PRICE_ID)] }
    : { product: check.sellable[0], lineItems: check.sellable.map((id) => withPrice(SINGLE_PRICE_ENV[id])) }

  // Rule 5: a charge must never go out at the wrong price. If any price this
  // cart needs is unset, refuse rather than fall back to something else.
  if (priced.lineItems.some((item) => item === null)) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const affiliateCode = await readAffiliateCodeFromCookie("cart checkout")

  try {
    const checkout = await createPluginCheckoutSession(new Stripe(secret), {
      product: priced.product,
      lineItems: priced.lineItems as { price: string; quantity: number }[],
      // The /thanks pixel must report what was actually charged, which is
      // the (possibly bundle-discounted) cart total, not the sum of list
      // prices for whatever was requested.
      paid: totals.total,
      cancelPath: "/checkout",
      buyer,
      affiliateCode,
      // A guest's email was just checked, above, for exactly this cart. Binding
      // it here (Stripe renders customer_email read-only) is what makes that
      // check mean anything - without it, the checked address and the address
      // that gets charged and granted could be two different people.
      guestEmail: postedEmail,
      // The grant path (lib/plugin-purchase-grant.ts) resolves this list
      // first, falling back to PLUGIN_GRANTS[product] only when it is absent
      // - so a partial cart grants exactly what was sold, not a fixed pair.
      metadata: { products: check.sellable.join(",") },
    })
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    console.error("[cart checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}

const SINGLE_PRICE_ENV: Record<PluginProduct, string | undefined> = {
  shft: process.env.STRIPE_SHFT29_PRICE_ID,
  drft: process.env.STRIPE_DRFT29_PRICE_ID,
  fltr: process.env.STRIPE_FLTR_PRICE_ID,
}

function withPrice(priceId: string | undefined): { price: string; quantity: number } | null {
  return priceId ? { price: priceId, quantity: 1 } : null
}

/** What this buyer owns, looked up by user id when signed in or by email for
 *  a guest - never taken from the request body. Unknown user, unknown email,
 *  or no email at all all resolve to "owns nothing", the same shape checkCart
 *  already treats a brand-new buyer as. */
async function ownedProductsFor(userId: string | null, email: string): Promise<string[]> {
  let ownerId = userId
  if (!ownerId) {
    if (!email) return []
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    })
    if (!user) return []
    ownerId = user.id
  }
  const purchases = await prisma.purchase.findMany({
    where: { userId: ownerId, product: { in: [...PLUGIN_PRODUCTS] } },
    select: { product: true },
  })
  return purchases.map((p) => p.product)
}
