import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { isCompProduct } from "@/lib/plugin-products"
import { grantPluginPurchase } from "@/lib/plugin-purchase-grant"
import { buyerLookupFor, downloadsFor } from "@/lib/plugin-purchase-logic"
import { mintSetPasswordUrl } from "@/lib/set-password"
import { completeSetFor } from "@/lib/complete-set"

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
// What a claim reveals: keys, download links and the set-password link only
// when the account was created by this checkout or the viewer is signed in
// as its owner; otherwise `withheld: true` and the buyer is pointed at the
// receipt email.
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
    // Stripe reports "no_payment_required" - not "paid" - when a discount
    // brings the total to zero, which is what a 100% promotion code does. The
    // session completed; there was simply nothing to charge. Refusing it here
    // showed giveaway buyers an error page while the webhook granted them the
    // product anyway. "unpaid" is still refused: that one really has not
    // settled.
    const settled =
      checkout.payment_status === "paid" || checkout.payment_status === "no_payment_required"
    if (!settled || !isCompProduct(product)) {
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

    // What the holder of the session id may see. Keys and the set-password
    // link are revealed only when the account was born from this very
    // checkout (there is nothing on it the session id did not just buy) or
    // the viewer is signed in as its owner. An account that predates the
    // session belongs to someone already here: a guest typing that email
    // into Stripe has proven nothing about owning it, so they learn only
    // where the receipt went. The receipt itself still goes to the inbox.
    //
    // `purchasedIds` is returned even when withheld: it is not a secret from
    // whoever holds this session id, since it's exactly what they just paid
    // for (session.metadata.product/products, resolved through the same
    // grant call that only a paid, settled session can trigger). Unlike
    // `items`, it carries no licence key, download link or set-password URL,
    // so it can safely clear the cart for a returning guest who is not
    // signed in as the account's owner.
    //
    // What this checkout itself paid for is a different matter, and is shown
    // even then: those keys were minted for this purchase, and the person
    // holding its session id is the person who paid for them. Without them a
    // buyer whose receipt never arrived was left with nothing to download
    // (2026-10-06). Only keys the account held before this checkout - its
    // duplicates - stay withheld, along with the set-password link.
    const signedIn = viewerId === result.userId
    if (!signedIn && !result.accountFromThisPurchase) {
      const fresh = result.items.filter((i) => !result.duplicates.includes(i.product))
      return NextResponse.json({
        ok: true,
        product,
        email: result.email,
        signedIn: false,
        withheld: fresh.length === 0,
        existingAccount: true,
        needsPassword: false,
        setPasswordUrl: null,
        duplicates: result.duplicates,
        items: fresh.map((i) => ({ ...i, downloads: downloadsFor(i.product, i.licenseKey) })),
        purchasedIds: result.items.map((i) => i.product),
        completeSet: null,
      })
    }

    // Only an account with no human-chosen password gets a set-password link
    // here, and only when it was created by this purchase (checked above).
    const setPasswordUrl = result.needsPassword ? await mintSetPasswordUrl(result.userId) : null

    // The rest of the set, for a day, to whoever may see this account's keys.
    // Best effort: the purchase is what this page is for.
    const completeSet = await completeSetFor(result.userId).catch((e) => {
      console.error("[plugins claim] complete-set offer failed", e)
      return null
    })

    return NextResponse.json({
      ok: true,
      product,
      email: result.email,
      signedIn,
      withheld: false,
      needsPassword: result.needsPassword,
      setPasswordUrl,
      duplicates: result.duplicates,
      items: result.items.map((i) => ({ ...i, downloads: downloadsFor(i.product, i.licenseKey) })),
      purchasedIds: result.items.map((i) => i.product),
      completeSet: completeSet
        ? {
            missing: completeSet.missing,
            price: completeSet.price,
            compareAt: completeSet.compareAt,
            endsAt: completeSet.endsAt.toISOString(),
            token: completeSet.token,
          }
        : null,
    })
  } catch (e) {
    console.error("[plugins claim]", e)
    return NextResponse.json({ error: "Could not verify your purchase." }, { status: 500 })
  }
}
