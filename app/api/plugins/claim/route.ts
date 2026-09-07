import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { isCompProduct } from "@/lib/plugin-products"
import { grantPluginPurchase } from "@/lib/plugin-purchase-grant"
import { buyerLookupFor, downloadsFor } from "@/lib/plugin-purchase-logic"
import { mintSetPasswordUrl } from "@/lib/set-password"

// Called by /thanks with the Stripe checkout session id. Confirms the session
// is a paid plugin purchase, grants it (self-healing if the webhook is slow,
// a no-op if it was fast) and returns everything the page shows: keys,
// download links, and how to get onto the account.
//
// Who may claim:
//   - A signed-in purchase names its buyer in the session; only that account
//     may claim it, as before.
//   - A guest purchase names nobody. The session id is the credential: an
//     unguessable token Stripe hands only to the buyer's browser on the
//     success redirect, and the same pattern Stripe's own success pages use.
//
// It never sends email. The webhook does that, once.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 })
  }

  let sessionId: unknown
  try {
    sessionId = (await request.json())?.sessionId
  } catch {
    /* handled below */
  }
  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "Missing session id." }, { status: 400 })
  }

  try {
    const checkout = await new Stripe(secret).checkout.sessions.retrieve(sessionId)
    const product = checkout.metadata?.product
    if (checkout.payment_status !== "paid" || !isCompProduct(product)) {
      return NextResponse.json({ error: "No completed purchase for that session." }, { status: 403 })
    }

    const lookup = buyerLookupFor(checkout)
    const session = await auth()
    const viewerId = session?.user?.id ?? null
    if (lookup.kind === "user" && lookup.id !== viewerId) {
      return NextResponse.json({ error: "That purchase belongs to another account." }, { status: 403 })
    }

    const result = await grantPluginPurchase(checkout)
    if (!result) {
      return NextResponse.json({ error: "Could not verify your purchase." }, { status: 500 })
    }

    // Only an account with no human-chosen password gets a set-password link
    // here. That account was created by this very purchase and holds nothing
    // the session id does not already reveal. An account with a real password
    // is never handed one - that would be a takeover path.
    const setPasswordUrl = result.needsPassword ? await mintSetPasswordUrl(result.userId) : null

    return NextResponse.json({
      ok: true,
      product,
      email: result.email,
      signedIn: viewerId === result.userId,
      needsPassword: result.needsPassword,
      setPasswordUrl,
      duplicates: result.duplicates,
      items: result.items.map((i) => ({ ...i, downloads: downloadsFor(i.product, i.licenseKey) })),
    })
  } catch (e) {
    console.error("[plugins claim]", e)
    return NextResponse.json({ error: "Could not verify your purchase." }, { status: 500 })
  }
}
