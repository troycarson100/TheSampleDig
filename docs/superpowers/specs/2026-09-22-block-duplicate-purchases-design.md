# Block duplicate plugin purchases at checkout

**Date:** 2026-09-22
**Status:** approved design, ready for an implementation plan

## Goal

Stop anyone buying a plugin they already own, before any money moves. A guest
gives their email on our page, we check ownership against it, and we either
send them to their downloads or on to Stripe with that address locked in.

## Why

On 2026-09-22 a buyer paid $34 for the shft + drft bundle at 6:19am. He had
owned both plugins since 2026-09-15.

Every plugin checkout route already guards against this. `bundle/checkout`
returns `already_owned` (409) when the buyer owns both products;
`shft/checkout` and `drft/checkout` do the same for a single product. Every
one of those guards is wrapped in `if (buyer)`, and `buyer` comes from
`buyerFromSession(await auth())` — it exists only when the visitor is signed
in. This buyer was a guest. Guest checkout has no identity until Stripe
collects the email on its own hosted page, which is after our guard has run
and waved the session through.

The webhook then did its job correctly: it resolved the buyer by email, found
both products owned, granted nothing, and flagged both as duplicates. That
flag reached a `console.warn` and one line of a receipt email. Nothing else.

It stayed invisible for a second reason. `Purchase` is `@@unique([userId,
product])`, so a repeat purchase writes no row. Every sales figure on
`/admin/attribution` counts purchase rows, so the charge appeared nowhere in
our own reporting. It surfaced only because a Stripe total failed to match
the attribution page.

## Scope

**In:**

- An email field in the guest buy flow for plugins, before Stripe.
- The existing ownership guards running for guests, keyed on that email.
- `customer_email` locked into the Checkout Session so it cannot be swapped.
- One shared buy-button component, replacing four divergent copies.
- A duplicate detected by the webhook emails the site owner.

**Out:**

- **The SampleRoll Pro membership.** `app/api/stripe/checkout/route.ts` is a
  `mode: "subscription"` session and is not touched. Duplicate-buying a
  subscription is a different problem with different semantics.
- **Automatic refunds.** Rejected on 2026-09-22: Stripe does not return the
  payment processing fee on a refund, so every auto-refund costs real money
  on top of the one already lost. Blocking beforehand costs nothing.
- Recording repeat purchases in reporting. `@@unique([userId, product])`
  stands; the owner email is how a repeat charge becomes visible.
- Any cookie remembering the buyer's email. Considered and dropped: the field
  is asked for every time.

## Design

### 1. One shared buy button

Four components each own a copy of "POST to a checkout route, read the
response, redirect or show an error":

- `app/plugins/PluginsStore.tsx` — `BuyBtn`
- `app/offers/OffersView.tsx` — `BuyBtn`
- `app/shft/ShftLanding.tsx` — `BuyButton`
- `app/drft/DrftLanding.tsx` — `BuyButton`

The email gate has to live in all four or it is trivially bypassed by using a
different page. Four copies of a security-relevant check is the same shape of
problem `lib/plugin-products.ts` was written to solve, and its comment says
why: "Two copies of the grant map is exactly the kind of thing that drifts."

Extract one `components/PluginBuyButton.tsx` owning the whole interaction —
the fetch, the email field, the busy and error states, the owned state — and
have all four call sites use it. This is a prerequisite for the rest of the
design, not an optional tidy-up.

### 2. The guest email field

For a signed-out visitor the button reveals an inline email input and a
continue action, then posts `{ email }` to the same checkout route it calls
today. A signed-in visitor sees no field and nothing changes for them.

This is not a net-new field. It is the email Stripe collects anyway, moved
one screen earlier so it can be checked while refusing is still free.

### 3. Ownership check for guests

In all three plugin routes, the guard becomes:

    const email = buyer?.email ?? normalizedSubmittedEmail

and runs whenever `email` is present rather than only when `buyer` is.
The queries, the `already_owned` / `own_one` responses, and their 409 status
are unchanged — `PluginsStore` already treats 409 as a conflict.

A submitted email matching no account owns nothing and proceeds normally.
Matching is case-insensitive, consistent with `findByEmail` in
`lib/plugin-purchase-grant.ts`.

### 4. Locking the email into Stripe

`createPluginCheckoutSession` sets `customer_email` only for a signed-in
buyer today. It now sets it for a guest's submitted address too. Stripe
pre-fills that field and the buyer cannot change it, so the address that
passed the check is the address that pays.

**This must be verified in the Stripe sandbox before the gate is trusted.**
If Checkout turns out to allow editing a pre-filled email, the gate is
bypassable and section 6 becomes the only backstop.

### 5. Crossgrade pricing for guests

`shft/checkout` already swaps in `STRIPE_SHFT_CROSSGRADE_PRICE_ID` and
charges `PRICING.crossgrade.price` when a signed-in buyer owns `drft`.
Running that same block for guests means a signed-out owner of drft pays $15
rather than $19 for shft.

This is a fix, not a side effect: today a signed-out returning buyer silently
overpays by $4 for the same goods. The same change closes both.

### 6. Webhook: detect and alert, never refund

`grantPluginPurchase` already returns `duplicates: PluginProduct[]`, computed
per product by `isDuplicateGrant`. Today the webhook passes it to the receipt
email and does nothing else.

It now also emails the site owner: buyer email, product bought, products
already owned, amount charged, checkout session id. No money moves. The owner
decides whether to refund.

This is the backstop for anything the gate cannot catch — a race between two
tabs, or a pre-filled email that proved editable. It exists because this
incident hid in a `console.warn`, and a log line nobody reads is not
visibility.

### 7. Account enumeration

A 409 tells whoever submitted an address that it already owns a plugin, so
addresses can be probed for ownership.

Accepted. The information is low value — that a given address bought a music
plugin — and the alternative is a vague response that would be actively
misleading to genuine new buyers. Noted here so it is a decision rather than
an oversight. The existing rate limiter pattern in
`lib/resend-rate-limit.ts` should be applied to the guest check to keep bulk
probing impractical.

### 8. Edge cases

- **Email owns one product, buys the bundle.** Existing `own_one` 409 already
  covers it; the storefront already renders "complete the pair" for it.
- **Email owns nothing but belongs to an account.** Proceeds normally. The
  webhook attaches the purchase to that account exactly as it does today.
- **Two tabs, same email, both pass the check.** Both charge. Section 6
  catches it after the fact; the owner refunds by hand.
- **Guest submits a different address from the one owning their plugins.**
  Proceeds, and creates a separate account. Not a duplicate in our model and
  deliberately not treated as one.
- **Malformed or empty email.** 400 before any Stripe call, same validation
  shape as `app/api/plugins/resend-key/route.ts`.

### 9. Testing

- Ownership resolution: signed-in buyer, guest with a known email, guest with
  an unknown email, guest with a differently-cased email.
- Each route returns `already_owned` for a guest owning the product, and
  `own_one` for a guest owning one half of the bundle.
- Crossgrade price is selected for a guest owning the other plugin.
- Malformed email is rejected before any Stripe call.
- The shared button posts the email for a guest and omits it when signed in.

### 10. Files

- `components/PluginBuyButton.tsx` — new, shared.
- `app/plugins/PluginsStore.tsx`, `app/offers/OffersView.tsx`,
  `app/shft/ShftLanding.tsx`, `app/drft/DrftLanding.tsx` — use it, delete the
  local copies.
- `app/api/shft/checkout/route.ts`, `app/api/drft/checkout/route.ts`,
  `app/api/bundle/checkout/route.ts` — accept and check a guest email.
- `lib/plugin-checkout.ts` — set `customer_email` for guests.
- `app/api/stripe/webhook/route.ts` — owner alert on duplicates.
- `lib/email.ts` — the owner alert message.
