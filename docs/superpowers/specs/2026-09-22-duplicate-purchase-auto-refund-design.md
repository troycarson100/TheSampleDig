# Auto-refund duplicate plugin purchases

**Date:** 2026-09-22
**Status:** approved design, ready for an implementation plan

## Goal

When someone pays for a plugin they already own, refund them automatically,
tell them why, and tell the site owner it happened. Nobody should be able to
buy the same product twice and simply be charged for it.

## Why

On 2026-09-22 a buyer paid $34 for the shft + drft bundle at 6:19am. He had
owned both plugins since 2026-09-15. He was charged in full, and nothing
anywhere raised a flag.

Both checkout routes already guard against this. `bundle/checkout` returns
`already_owned` (409) when the buyer owns both products, and `shft/checkout`
and `drft/checkout` do the same for a single product. Every one of those
guards is wrapped in `if (buyer)`, and `buyer` comes from
`buyerFromSession(await auth())` — it exists only when the visitor is signed
in. This buyer was a guest. Guest checkout has no identity until Stripe
collects the email on its own hosted page, which is after our guard has run
and waved the session through.

The webhook then did its job correctly: it resolved the buyer by email, found
both products already owned, granted nothing, and flagged both as duplicates.
That flag went to a `console.warn` and to a line in the receipt email. No
refund, no alert.

It was invisible for a second reason. `Purchase` is `@@unique([userId,
product])`, so a repeat purchase creates no row. Every sales figure on
`/admin/attribution` counts purchase rows, so the charge appears nowhere in
our own reporting. It surfaced only because a Stripe total failed to match
the attribution page.

## Scope

**In:**

- Detect a duplicate purchase in the Stripe webhook and refund it.
- Full refund when every product in the purchase was already owned.
- Partial refund when some were, priced so the buyer ends up paying the
  crossgrade price a signed-in buyer would have been charged.
- Replace the buyer's duplicate-flagged receipt with one explaining the refund.
- Email the site owner on every auto-refund.

**Out:**

- Any change to the checkout routes. The signed-in guards stay as they are.
- Any pre-payment email check in the guest flow. Rejected deliberately: it
  adds a step to the flow guest checkout exists to remove, and the webhook
  catches every case including typo'd and alternate addresses.
- Any change to affiliate clawback policy. See section 6.
- Recording repeat purchases in reporting. `@@unique([userId, product])`
  stands; the owner email is how repeat charges become visible.

## Design

### 1. Detection

No new detection logic. `grantPluginPurchase` already returns
`duplicates: PluginProduct[]`, documented as "Products this email already
owned before this checkout began. The charge is a duplicate; nothing was
regranted." It is computed by `isDuplicateGrant(row.createdAt,
session.created)` per product, which is true exactly when the purchase row
predates the checkout session.

Today the webhook passes that array to the receipt email and does nothing
else with it. The change acts on it:

    result.duplicates.length === 0              -> normal receipt, unchanged
    result.duplicates.length === items.length   -> full refund
    0 < result.duplicates.length < items.length -> partial refund

Keying off `duplicates` rather than "was this a guest" means signed-in race
conditions — two tabs, a double-click, a retried webhook against a fresh
grant — are covered by the same path.

### 2. Refund amount

A pure function in `lib/duplicate-refund.ts`. It takes **the amount actually
charged** (`session.amount_total`, in cents) and the duplicate list, and
returns an amount **in cents** — the unit `stripe.refunds.create` expects.
`PRICING` is in whole dollars and must be multiplied by 100 at the boundary;
the function never mixes units.

It works from the real charged amount, not from `PRICING` list values,
because a promotion code or an affiliate discount means the buyer may have
paid less than list. Refunding a list price against a discounted charge would
over-refund.

| Bought  | Already owned  | Refund                                    |
|---------|----------------|-------------------------------------------|
| bundle  | shft + drft    | the entire `amount_total`                 |
| bundle  | shft (or drft) | `amount_total - crossgrade`, floored at 0 |
| shft    | shft           | the entire `amount_total`                 |
| drft    | drft           | the entire `amount_total`                 |

A full duplicate refunds the whole charge rather than a computed figure, so
it cannot over-refund whatever the buyer actually paid. Only the partial case
does arithmetic, and it is floored at zero so a heavily discounted bundle can
never produce a negative refund.

The partial case mirrors what `shft/checkout` already does for a signed-in
owner of drft: it swaps in `STRIPE_SHFT_CROSSGRADE_PRICE_ID` and charges
`PRICING.crossgrade.price`. The refund brings a guest to the same place.

A bundle bought by someone owning neither product is not a duplicate and is
not touched.

### 3. Issuing the refund

`stripe.refunds.create({ payment_intent, amount })` from the webhook, after
the grant and before the email.

- **Idempotency key derived from the checkout session id.** Stripe retries
  webhooks; a retry must not refund twice. This is the single most important
  detail in the implementation.
- **Failure is contained.** A failed refund is logged and reported in the
  owner email as needing manual action. It must never throw out of the
  handler: an exception returns 500, Stripe retries the whole event, and the
  grant runs again.
- The refund fires Stripe's `charge.refunded`, which the webhook already
  handles. That path is untouched.

### 4. Buyer email

Replaces the current duplicate-flagged receipt rather than adding a second
message. It states that they already own the products, when they bought them,
their existing licence keys and download links, and that the charge has been
refunded with the amount.

The existing `duplicates` branch of `sendPluginPurchaseEmail` becomes this
message. A purchase with no duplicates is unaffected.

### 5. Owner email

One email per auto-refund, through the existing SMTP transport: buyer email,
product bought, products already owned, amount refunded, checkout session id,
and whether the refund succeeded.

This exists because the incident above hid in a `console.warn`. A log line
nobody reads is not visibility.

### 6. Affiliate commission

An auto-refund triggers `charge.refunded`, whose handler claws back the whole
commission on any refund, full or partial (v1 policy). **This is intended and
stays.** A partial refund therefore costs the affiliate their full commission
on a sale where the buyer kept a plugin. Decided deliberately on 2026-09-22;
recorded here so it is not rediscovered as a bug.

### 7. Edge cases

- **Comp-code redemption of an owned product.** Out of scope: comps take no
  payment, and `comps/redeem` already refuses when every granted product is
  owned.
- **Zero-value checkout** (100% promotion code). `payment_status` is
  `no_payment_required` and there is nothing to refund. Skip, but still send
  the "you already own this" email.
- **Refund already issued manually** before the webhook ran. Stripe rejects
  the second refund; treat as success and report it in the owner email.
- **A duplicate detected by the claim route rather than the webhook.** The
  claim route never sends email and must not move money. The webhook stays
  the only place that refunds.

### 8. Testing

Pure-logic tests, no Stripe calls, matching how `plugin-checkout-logic.test.ts`
is structured:

- Refund amount for all four rows of the table in section 2.
- Zero duplicates returns no refund.
- A bundle where both products are new returns no refund.
- A discounted bundle (paid less than list) with one product owned refunds
  `paid - crossgrade`, not `$19` — the case that would over-refund if the
  function worked from `PRICING` instead of the charge.
- A bundle discounted below the crossgrade price with one product owned
  refunds 0, never a negative number.
- Amounts are returned in cents: a full duplicate bundle at list price
  returns `3400`, not `34`.
- Idempotency: the same session id yields the same idempotency key.

### 9. Files

- `lib/duplicate-refund.ts` — new. Amount calculation and idempotency key.
- `lib/duplicate-refund.test.ts` — new.
- `app/api/stripe/webhook/route.ts` — act on `result.duplicates`.
- `lib/email.ts` — the duplicate branch becomes a refund message; add the
  owner notification.
