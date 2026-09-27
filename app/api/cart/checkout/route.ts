import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createPluginCheckoutSession, readAffiliateCodeFromCookie, buyerFromSession } from "@/lib/plugin-checkout"
import { resolveCartIdentity, decideCartContents } from "@/lib/cart-checkout-decision"
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
// Rate-limited per IP for the same reason /api/cart/owned is: every response
// below (a 409 naming what's owned, and even the outcome of a 400 or a 200)
// says something about the address asked about, which makes this route as
// good an ownership oracle as that one if left unthrottled.
const MINUTE = 60_000
// Matches /api/cart/owned's 10/min exactly, rather than being stricter: the
// disclosure this defends against is the same shape and size as that
// endpoint's. The cost that's unique to this route - one unpaid Stripe
// Checkout Session - only applies to the outcomes that actually reach
// Stripe (a 200), not to the 400/409s a legitimate buyer's retries mostly
// produce (an email typo, a cart with an owned item still in it); an
// abandoned unpaid session costs nothing and simply expires. Counting only
// successful session creations was considered instead, but that would let an
// attacker send unlimited 409-triggering requests at full speed - the
// already_owned reply is itself the leak this limiter exists to slow down,
// not just a successful charge - so every outcome counts against the limit.
const perIp = new SlidingWindowLimiter(10, MINUTE)

export async function POST(request: Request) {
  // DigitalOcean App Platform puts its own ingress address in x-forwarded-for
  // and exposes the real client in do-connecting-ip; production always has
  // one or the other. Locally, or behind a proxy that sets neither, there is
  // no way to tell requests apart - falling back to a fixed "unknown" key
  // would put every such client in one shared bucket, so five unrelated
  // people sharing that gap could lock each other out. A random per-request
  // key instead means this path is effectively unthrottled rather than
  // unfairly throttled; it is not a live gap in production; where an IP is
  // always present.
  const ip =
    request.headers.get("do-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    `unknown:${crypto.randomUUID()}`
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
  // email, but never silently: a posted email that disagrees with the
  // session's is refused, naming the session's address, rather than charging
  // and granting an identity the buyer never confirmed on this page (a page
  // can render the guest form because useSession() hasn't yet picked up a
  // sign-in that happened in another tab). A guest's email must look like an
  // email - a malformed or empty one is refused outright rather than
  // silently treated as "owns nothing", which is what let a one-character
  // string sail through as an identity. See lib/cart-checkout-decision.ts.
  const session = await auth()
  const buyer = buyerFromSession(session)
  const identity = resolveCartIdentity({ postedEmail, buyer })
  if (identity.kind === "invalid-identity") {
    return NextResponse.json({ error: "Sign in or provide a valid email to check out." }, { status: 400 })
  }
  if (identity.kind === "session-email-mismatch") {
    return NextResponse.json(
      { reason: "session_email_mismatch", sessionEmail: identity.sessionEmail },
      { status: 409 },
    )
  }

  // Rule 2: what does this buyer actually own? Never taken from the request.
  // The lookup itself can throw on an input that looks like an email but
  // isn't one Postgres will accept (e.g. an embedded NUL byte raises an
  // uncaught encoding error) - that is still an input problem, not a server
  // fault, so it is a 400 too rather than an unhandled 500.
  let ownedIds: string[]
  try {
    ownedIds = await ownedProductsFor(buyer?.id ?? null, postedEmail)
  } catch (e) {
    console.error("[cart checkout] ownership lookup failed", e)
    return NextResponse.json({ error: "Sign in or provide a valid email to check out." }, { status: 400 })
  }

  // Rule 3: the client's cart is never trusted. A cart with some owned items
  // reports "already_owned" and names them, even when it is fully owned -
  // that is still accurate and actionable. "empty" is reserved for a cart
  // that names nothing owned at all: nothing valid was requested to begin
  // with (an empty or all-garbage `ids`). Checking owned first is what makes
  // a fully-owned cart say what it owns instead of falsely claiming there was
  // nothing there.
  const decision = decideCartContents({ ids, ownedIds })
  if (decision.kind === "already-owned") {
    return NextResponse.json({ reason: "already_owned", owns: decision.owns }, { status: 409 })
  }
  if (decision.kind === "empty") {
    return NextResponse.json({ reason: "empty" }, { status: 409 })
  }

  // Rule 4: one line item at the bundle price when the sellable set is every
  // plugin, otherwise one line item per plugin at its own price.
  const priced = decision.bundleApplied
    ? { product: "bundle" as const, lineItems: [withPrice(process.env.STRIPE_BUNDLE3_PRICE_ID)] }
    : { product: decision.sellable[0], lineItems: decision.sellable.map((id) => withPrice(SINGLE_PRICE_ENV[id])) }

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
      paid: decision.paid,
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
      // A dedicated option, not raw `metadata`: "products" decides what gets
      // granted, so it belongs with the other reserved fields
      // createPluginCheckoutSession alone controls, not a caller-supplied key.
      products: decision.sellable,
    })
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    // An address that passes EMAIL_RE's loose shape check can still be one
    // Stripe's own, stricter validation rejects (e.g. a quoted display name).
    // That is an input problem on our side of the line - our own message,
    // not Stripe's internal error text, and a 400, not a 500.
    if (e instanceof Stripe.errors.StripeInvalidRequestError && e.param === "customer_email") {
      console.error("[cart checkout] Stripe rejected the guest email", e)
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }
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
 *  already treats a brand-new buyer as.
 *
 *  Looked up with a plain, pre-lowercased equals - not Prisma's
 *  `mode: "insensitive"`, which compiles to an unescaped ILIKE, letting "%"
 *  and "_" in the posted address act as wildcards ("rev_y@x.com" would match
 *  "revXy@x.com"; "%@%.%" would match anyone, defeating the rate limit
 *  below). Safe because every write to User.email normalises to lowercase
 *  first - see the identical comment on findByEmail in
 *  lib/plugin-purchase-grant.ts, which this mirrors on purpose. */
async function ownedProductsFor(userId: string | null, email: string): Promise<string[]> {
  let ownerId = userId
  if (!ownerId) {
    if (!email) return []
    const user = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
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
