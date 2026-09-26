# Cart and checkout

Date: 2026-09-26
Branch: `feat/plugin-pages-redesign`
Spec A of the second increment. Spec B (nav dropdown and countdown ticker) is complete;
spec C (interactive hotspot hero) follows.

## Goal

Give the bundle a home and stop a returning customer paying for plugins they already own.

A slide-out cart holds any combination of plugins; a checkout page identifies the buyer
before payment; Stripe takes the money as it does today. Identification is the point — a
signed-out buyer is currently unidentifiable at the moment they pay, which is why the $59
bundle can be sold to someone who already owns two of it.

Once the cart exists, `/plugins` redirects to `/shft` as intended: the bundle no longer
needs a page.

## What the codebase already does — do not rebuild it

`lib/plugin-purchase-grant.ts` already finds or creates a user for a guest purchase and
stamps `emailVerified` at creation, with the reasoning in the code: the password is random
bytes nobody knows, so the only way onto the account is a link sent to that address.
`passwordSetAt` stays null so the receipt and login page offer "set a password", minted by
`lib/set-password.ts`. `/api/plugins/claim` lets `/thanks` show keys and downloads using the
Stripe session id as the credential.

So **accounts are already created and usable after a purchase.** This spec adds no parallel
account-creation path and changes nothing about verification. It adds only what is missing:
knowing who the buyer is *before* they pay.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Payment | Stripe Checkout, multi-line-item | Payment stays at Stripe; only the line items change |
| Cart pricing | Singles at single price; all three → $59 | The two-plugin bundle stays retired. No progressive tiers |
| Bundle presentation | One `Bundle — all three  −$18` line | Honest, and simpler than per-item reallocation |
| Checkout identity | Sign in, or email + confirm email | Lowest friction that still closes the hole |
| Accounts | Unchanged — created and verified post-purchase | The machinery exists and works |
| Anonymous path | None — an email is always given | An unidentifiable buyer is the hole. Buying without an account still works |
| Buy buttons | Add to cart and open the drawer | What makes a cart a cart; costs one click |

### What "no guest path" does and does not mean

It would be easy to read this as removing guest checkout, shipped 2026-09-07 and migrated
across 1,912 users. It is not.

A buyer still needs **no account, no password and no verification**. They type an email, pay,
and the existing machinery creates their verified account and mints a set-password link,
exactly as today. Nothing about that changes.

What changes is *where the email is typed*. Today it is typed into Stripe's hosted page;
here it is typed into ours, one step earlier, and passed to Stripe as `customer_email` so it
is prefilled rather than asked twice. **The net number of fields is the same, plus one
confirm-email box.**

So what is removed is **anonymous** checkout — reaching Stripe without telling the site who
you are — not guest checkout. Stripe collects that address either way; asking first is what
makes it possible to check what the buyer already owns before charging them.

The real costs are: one extra field, one page between the cart and Stripe, and the email
enumeration trade-off recorded below.

## Architecture

### 1. `lib/cart-pricing.ts` — pure, the heart of it

No React, no storage, fully unit-testable.

```ts
export interface CartLine { id: PluginId; price: number; msrp: number }

export interface CartTotals {
  lines: CartLine[]
  /** Sum of single prices, before any bundle discount. */
  subtotal: number
  /** True only when every plugin in PLUGIN_ORDER is present. */
  bundleApplied: boolean
  /** subtotal, or PRICING.bundle.price when bundleApplied. */
  total: number
  /** subtotal - total. Zero unless the bundle applied. */
  saving: number
  /** Combined MSRP, for the struck figure. */
  msrpTotal: number
}

export function cartTotals(ids: readonly PluginId[]): CartTotals
```

`bundleApplied` is derived from `PLUGIN_ORDER.length`, never a literal `3`. Input is
de-duplicated and ordered by `PLUGIN_ORDER` so the drawer's order never depends on click
order.

### 2. `lib/use-cart.ts` — client state

A `PluginId[]` in `localStorage` under one versioned key. **There are no quantities** — you
cannot own two of a plugin, so the cart is a set.

```ts
export interface Cart {
  ids: PluginId[]
  totals: CartTotals
  add(id: PluginId): void
  remove(id: PluginId): void
  addAll(): void
  clear(): void
  isOpen: boolean
  open(): void
  close(): void
  /** Items dropped because ownership resolved and the visitor already owns them. */
  dropped: PluginId[]
}
```

**Ownership-aware, like every other surface:** `add` refuses an owned plugin, and when
`usePluginOwnership()` resolves, any owned id already in the cart is removed and reported in
`dropped` so the drawer can say why. While ownership is `loading` or `error`, the cart does
not drop anything — unknown ownership never drives a destructive action.

Stored state is validated on read: unknown ids (a removed plugin, a tampered value) are
discarded rather than trusted.

### 3. `components/CartDrawer.tsx`

Slide-out from the right. Each line: the plugin's `PluginGlyph`, name, category, its price
struck against MSRP, and a remove control. Then the bundle saving line when it applies, the
total, and **Checkout →**.

Empty state names what it is for and links to `/shft` rather than sitting blank.

Accessibility, following what the dropdown had to fix: `role="dialog"` with `aria-modal`,
focus moved into the drawer on open and restored on close, `Escape` closes, focus trapped
while open, and the page behind it inert. Respects `prefers-reduced-motion` for the slide.

### 4. `app/checkout/page.tsx`

Order summary on the right, from `cartTotals`. On the left, two ways to identify:

- **Sign in** — an existing account; ownership is then known exactly.
- **Email + confirm email** — no password. The confirm field is load-bearing: licence keys
  are delivered by email and there is no verification step to catch a typo.

Submitting with an email looks up what that address owns. Anything owned is removed from the
cart, and the page says so plainly before payment rather than after.

**Known trade-off — email enumeration.** Telling an anonymous visitor "this address already
owns drft" reveals whether an email has an account. The information is low value and the
alternative is silently altering someone's cart, which is worse. Mitigations: the check is
rate-limited per IP following `lib/resend-rate-limit.ts`, responds identically in timing for
known and unknown addresses, and never reveals anything beyond the plugins in the cart being
checked. Recorded here so it is a considered trade-off rather than an oversight.

### 5. `app/api/cart/checkout/route.ts`

One route replaces the three per-product routes' bundle role.

- Accepts the cart ids and either a session or an email.
- **Re-checks ownership server-side**, by user id or by email. The client's cart is never
  trusted — a stale tab or a crafted request must not buy an owned plugin. Returns
  `409 { reason: "already_owned", owns: [...] }`.
- Builds line items: the single bundle price when every plugin is present, otherwise one
  line item per plugin at its own price id.
- Stamps `metadata.products` with the comma-joined plugin list.
- Refuses when any required Stripe price id is unset, reaching the existing
  `503 "Checkout opens at launch."` branch rather than charging something wrong.

### 6. Granting an arbitrary set

`lib/plugin-purchase-grant.ts:157` currently loops `PLUGIN_GRANTS[product]`. It gains a list
resolved from `metadata.products` when present, falling back to `PLUGIN_GRANTS[product]` for
every existing session shape. Validated against `isPluginProduct` — metadata is attacker-
adjacent input, not a trusted list.

Nothing else in the grant path changes: licence minting, the receipt, the duplicate alert,
affiliate referral and `emailVerified` all keep working as they do.

### 7. What this retires

- `/api/bundle/checkout` folds into the cart route; `lib/bundle-eligibility.ts` moves with
  it, generalised from "may they buy the bundle" to "which of these do they already own".
- `/plugins` redirects to `/shft`. `app/plugins/PluginsStore.tsx` and its stylesheet are
  deleted.
- Every bundle CTA repoints to opening the cart: the sale strip, the rail pill, the dropdown
  row, and `lib/site-alerts.ts`.
- `checkoutUrls`' `CancelPath` gains `/checkout`.

## Verification

**Unit (`npx tsx --test`):** `cartTotals` across empty, one, two and three items; that the
bundle applies only at the full set; that the saving equals subtotal minus total; that
duplicate ids collapse; that ordering follows `PLUGIN_ORDER` regardless of input order.
Ownership filtering in the checkout route's pure helper, including the case where the cart
holds only owned items.

**Browser (`scripts/verify-cart.mjs`):** adding from a Buy button and from the rail pill;
the drawer's lines, saving line and total; removing an item; the bundle line appearing and
disappearing as the third item is added and removed; persistence across reload; keyboard
access and focus restoration; the empty state.

**Ownership states**, seeded against the local database as in previous increments: an owned
plugin cannot be added; an owned plugin already in storage is dropped on load with an
explanation; checkout with an owned item is refused server-side even when the client sends
it anyway.

**The money path end to end** in Stripe test mode: a two-item cart charges the sum of
singles; a three-item cart charges $59; the webhook grants exactly the purchased set; the
receipt lists them; `/thanks` shows the keys.

## Out of scope

The interactive hotspot hero (spec C). Consolidating `useOwnsShft` into
`usePluginOwnership`, deferred from spec B's review. Any change to how accounts are created,
verified, or password-set after purchase.

## Owner actions

- Nothing new in Stripe: the cart uses the per-plugin price ids and the bundle price id that
  already exist, under the names renamed in the first increment.
- Decide whether the `/offers` redirect still earns its place once `/plugins` also redirects.
