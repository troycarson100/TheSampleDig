# Guest checkout for plugins

**Date:** 2026-09-07
**Status:** approved design, ready for an implementation plan

## Goal

Let anyone buy shft, drft, or the bundle without signing in first. Stripe
collects the email, the webhook provisions the account, and the buyer gets
their licence key and installers immediately on a success page and again by
email. Signing in becomes something you do to *manage* a purchase, never
something you must do to *make* one.

## Why

Every checkout route today returns 401 for a visitor without a session, and
the storefront then bounces them to `/login`. For someone with no account the
path to a card form is: Buy, login page, Register (return path dropped),
submit, leave for the inbox, click verify, land on plain login (return path
dropped again), sign in, land on `/dig`, find the plugin page, click Buy again.
An email round trip and two dead ends sit in front of the price. If the
verification email lands in spam the sale is simply gone. Nothing measures
how many people stop at the wall.

## Scope

In:

- Checkout without a session for shft, drft, and the bundle.
- One shared grant helper used by the webhook and the claim route, replacing
  the four copies of the grant logic.
- A `/thanks` success page that shows keys and download links.
- Licence-key-authenticated installer downloads, so the receipt email can carry
  direct links.
- A receipt email that adapts to whether the account has a password.
- A lost-key page that resends the receipt to an email address.
- The account plumbing that makes the above safe: a `passwordSetAt` column,
  password reset verifying the email, and clearer login and register messages
  for purchase-created accounts.
- Guest pricing nudges on the storefront and an InitiateCheckout pixel event.

Out (follow-ups, not in this plan):

- Stripe's promotional-consent checkbox for guests. Guests get the site's
  existing default (`emailMarketingOptIn = true`), same as a signup that
  leaves the box ticked.
- Automatic refunds of duplicate purchases. They are detected and surfaced;
  the refund is manual.
- Magic-link or passwordless sign-in.
- Carrying `callbackUrl` through register and verify. The wall is gone, so
  this matters far less.
- DKIM for Office 365 on sampleroll.com. This is a DNS task for the owner:
  two CNAME records at GoDaddy plus enabling signing in the Microsoft 365
  Defender portal. SPF already passes and DMARC is monitor-only.

## Design

### 1. Checkout routes

`POST /api/shft/checkout`, `/api/drft/checkout`, `/api/bundle/checkout` keep
their paths and their signed-in behaviour. The change is what happens without
a session.

Signed in (unchanged): ownership checks, 409 `already_owned` / `own_one`,
crossgrade pricing, `client_reference_id` and `metadata.userId` set,
`customer_email` prefilled.

Guest (new): no ownership check is possible, so the full price is charged and
no crossgrade is offered. The session is created with no
`client_reference_id`, no `metadata.userId`, no `customer_email`, and
`metadata.guest = "1"` so it reads clearly in the Stripe dashboard. Stripe
Checkout collects the email itself. `customer_creation: "always"` stays.

Shared code moves into `lib/plugin-checkout.ts`:

- `readAffiliateCodeFromCookie()` — the `shft_ref` cookie lookup that all
  three routes duplicate today.
- `checkoutUrls(product, paid, cancelPath)` — pure. Success is
  `/thanks?session_id={CHECKOUT_SESSION_ID}&product=<shft|drft|bundle>&paid=<n>`,
  cancel is `<cancelPath>?purchase=canceled` (cancelPath is `/shft`,
  `/drft`, or `/plugins`).
- `createPluginCheckoutSession(stripe, { product, priceId, paid, cancelPath,
  buyer, affiliateCode })` — builds the session with the common line item,
  creator-code custom field, attribution metadata, and the buyer fields only
  when `buyer` is non-null.

Each route keeps its own price selection and ownership guards and calls the
helper for the session.

### 2. Buyer resolution and grant helper

New `lib/plugin-purchase-grant.ts`, the one place that turns a paid Stripe
Checkout Session into Purchase rows.

```
grantPluginPurchase(session) -> GrantResult | null

GrantResult = {
  userId: string
  email: string
  needsPassword: boolean         // user.passwordSetAt is null
  items: { product: "shft" | "drft"; licenseKey: string }[]
  duplicates: ("shft" | "drft")[] // products this email already owned
}
```

Steps:

1. `session.metadata.product` must be a comp product (`shft`, `drft`,
   `bundle`), otherwise return null. The grant list comes from
   `PLUGIN_GRANTS`.
2. Resolve the buyer with the pure helper `buyerLookupFor(session)`:
   - `client_reference_id ?? metadata.userId` present: `{ kind: "user", id }`.
     Look the user up by id. Missing user is logged and returns null.
   - Otherwise `customer_details.email ?? customer_email`, trimmed and
     lowercased: `{ kind: "email", email }`.
   - Neither: `{ kind: "none" }`, logged, returns null.
3. For `kind: "email"`, find the user case-insensitively. If none exists,
   create one:
   - `passwordHash` of 32 random bytes (nobody knows it).
   - `emailVerified = now`. The only way to obtain a password on this account
     is a link sent to that address, which is itself the verification.
   - `passwordSetAt = null`.
   - `emailMarketingOptIn = true` (site default).
   - Attribution columns from `metadata.attrVisitorId` via a new
     `snapshotForVisitor(visitorId)` extracted from `readAttributionSnapshot`,
     so a guest signup is attributed exactly like a form signup.
   - Wrapped in try/catch on Prisma `P2002`: the webhook and the claim route
     can both try to create the same user at once. The loser re-reads by
     email.
   - An existing account is never modified here. In particular an unverified
     account stays unverified (see Security).
4. For each product in the grant list, in order:
   - `findUnique` on `(userId, product)`. If absent, `create` with
     `stripeSessionId` on the first product only (it is `@unique` on
     Purchase) and a freshly minted key. Catch `P2002` and re-read.
   - If a row already existed and `row.createdAt < new Date(session.created *
     1000)`, it predates this checkout: record the product in `duplicates`,
     leave `stripeSessionId` alone, and log a warning naming the session id,
     email, and product. A row created after the session was created belongs
     to this same checkout (the other of the webhook/claim pair got there
     first) and is not a duplicate.
   - Backfill a null `licenseKey` with the existing conditional
     `updateMany({ where: { id, licenseKey: null } })` then re-read, the same
     race-safe pattern the webhook uses today.
5. `recordAffiliateReferral(session, firstPurchaseId)` once. Already
   idempotent.
6. Return the result. The helper never sends email.

Never regenerate an existing key. That rule is unchanged.

### 3. Webhook

`checkout.session.completed` for a plugin product becomes:

```
const result = await grantPluginPurchase(session)
if (!result) { warn; break }
const setPasswordUrl = result.needsPassword ? await mintSetPasswordUrl(result.userId) : null
await sendPluginPurchaseEmail(result.email, result.items, { setPasswordUrl, duplicates: result.duplicates })
```

`mintSetPasswordUrl` writes a 32-byte hex token into the existing
`passwordResetToken` / `passwordResetExpires` columns with a 7-day expiry and
returns `/reset-password?token=<t>&welcome=1`. Minting overwrites any earlier
token, which is fine: only the newest email's link needs to work, and
forgot-password re-mints on demand.

The old "send an email with null keys when there is no buyer" branch goes
away. A guest session always carries an email; a session with neither a user
nor an email is logged and skipped.

Subscription handling and `charge.refunded` are untouched.

### 4. Claim route and the thanks page

`POST /api/plugins/claim { sessionId }` replaces `/api/shft/claim`,
`/api/drft/claim`, and `/api/bundle/claim`, which are deleted. The three
storefront success handlers that called them are replaced by the thanks page.

Authorization:

- Retrieve the session from Stripe. `payment_status` must be `paid` and
  `metadata.product` a comp product, else 403.
- If the session carries a user id (a signed-in purchase), the caller must be
  signed in as that user, else 403. This is today's rule.
- If the session carries no user id (a guest purchase), the session id is the
  credential. It is an unguessable Stripe token that Stripe's own success-page
  pattern is built around, and the buyer is the only party Stripe redirects
  with it.

Then `grantPluginPurchase(session)`, which is idempotent with the webhook in
either order. Response:

```
{
  ok: true,
  product: "shft" | "drft" | "bundle",
  email: string,
  signedIn: boolean,          // caller has a session for this account
  needsPassword: boolean,
  setPasswordUrl: string | null,   // only when needsPassword
  duplicates: string[],
  items: [{
    product, licenseKey,
    downloads: [{ id, label, href }]   // href carries the key, see §5
  }]
}
```

`setPasswordUrl` is minted here only when `needsPassword` is true. That account
was created by this purchase and holds nothing the session id does not already
reveal, so handing its holder a set-password link adds no new exposure. An
account with a real password never gets one from this route.

The claim route does not send email. The webhook does. If the webhook is
delayed or misconfigured the page still shows everything and links to the
lost-key page.

`/thanks` is a client page under `app/thanks/page.tsx` in the `/products`
visual style (SiteNav header, `theme-vinyl`, narrow column). On mount it:

1. Reads `session_id`, `product`, `paid` from the URL.
2. Fires the Meta pixel `Purchase` event with `content_name = product` and
   `value = paid`. This moves out of the three storefront pages.
3. Calls the claim route.

States:

- No `session_id`: "Nothing to claim here" with links to `/plugins` and
  `/products`.
- Loading: "Confirming your purchase…".
- Error: "We couldn't confirm that purchase. If you were charged, your key is
  on its way by email" with the lost-key link.
- Success: heading "You're in". For each item: product name, the key in a
  monospace block with a copy button, and one button per asset (macOS
  installer, Windows installer, manual). Then "We've also sent this to
  {email}. Check spam if it isn't there, or resend it" linking to
  `/lost-key`. Then the account block:
  - `needsPassword`: "Set a password to see this on My Products, manage your
    machines, and re-download any time" with a button to `setPasswordUrl`.
  - `signedIn`: "Go to My Products".
  - Otherwise: "Sign in with {email} to see this on My Products" linking to
    `/login?callbackUrl=/products`.
  - `duplicates` non-empty: "It looks like {email} already owned {names}. The
    duplicate charge will be refunded. Reply to your receipt if it hasn't
    landed in a few days."

`WindowsInstallNote` is shown when a Windows installer is listed, as on
`/products`.

### 5. Key-authenticated downloads

`GET /api/products/[product]/download?asset=<id>&key=<licence key>`.

When `key` is present it is the credential: normalise with
`normalizeLicenseKey`, look up the Purchase by `licenseKey`, and require
`purchase.product === product`. No session is consulted. When `key` is absent
the route behaves exactly as today (session plus ownership).

A drft key cannot fetch shft. The key is already printed in the receipt email
and typed into the plugin, so treating it as the download credential adds no
new exposure beyond query strings in server logs. The real asset being
protected is the licence, which stays seat-limited; the installer is useless
without it.

### 6. Receipt email

`sendPluginPurchaseEmail(email, items, opts?)` with
`opts = { setPasswordUrl?: string | null; duplicates?: string[] }`. The comps
redeem route keeps calling it without `opts`.

Body, top to bottom:

1. "Thanks for buying {names}."
2. Per item: the key block (as today), then download links for each asset in
   `PRODUCTS[product].assets` using the key-authenticated URL from §5.
3. Account block:
   - `setPasswordUrl`: "Your purchase is saved to {email}. Set a password to
     see it on My Products, manage your machines, and re-download any time."
     Button "Set password".
   - Otherwise: "Sign in with {email} to see it on My Products." Button "Go to
     My Products", and a line "Forgot your password? Reset it" linking to
     `/forgot-password`.
4. `duplicates` non-empty: the same refund line as the thanks page.
5. "Reply here if you hit any trouble."

Subject unchanged. Sender unchanged.

### 7. Lost-key page

`app/lost-key/page.tsx`: one email field, submit, and a fixed confirmation:
"If we have a purchase for that address, the receipt is on its way. Check
spam if it doesn't show up." The page never reveals whether the address is
known.

`POST /api/plugins/resend-key { email }`:

- Normalise the email. Always respond 200 `{ ok: true }` on a well-formed
  request, whether or not anything was sent.
- Rate limit before any lookup: 3 requests per email per hour and 10 per
  client IP per hour (first value of `x-forwarded-for`). Over the limit
  returns 429 with a plain "Too many requests, try again later". The limiter
  is an in-memory sliding window in `lib/resend-rate-limit.ts` with an
  injectable clock. Best-effort per instance is fine for this endpoint.
- Find the user case-insensitively. If found and they have at least one
  Purchase, send `sendPluginPurchaseEmail` with the same account-block logic
  as the webhook (mint a set-password URL when `passwordSetAt` is null).
  Otherwise do nothing.

Linked from the thanks page, the login page ("Bought a plugin? Find your
key"), and the error state of the thanks page.

### 8. Account plumbing

**`User.passwordSetAt DateTime?`** (`password_set_at`). Null means no human
has chosen a password on this account.

- Migration `prisma/migrations/manual/20260907_password_set_at.sql`:
  `ADD COLUMN IF NOT EXISTS`, then backfill `password_set_at = created_at`
  where null, so every existing account counts as having a password.
- Register route sets it to now.
- Reset-password route sets it to now, and also sets `emailVerified = now`
  when it was null. Completing a reset proves control of the inbox, which is
  what verification proves. This is also what rescues a buyer whose email
  matched an old unverified account.
- Purchase-created accounts leave it null until the buyer sets a password.

**`POST /api/auth/check-unverified`** additionally returns `needsPassword:
true` when the address matches an account with `passwordSetAt` null. This
check does not require the password to match, since the stored password is
random; it reveals only that a purchase-created account exists, which the
register route already reveals with its 409.

**Login page**: when `needsPassword` comes back, show "This account was
created when you bought a plugin. Set a password to sign in" with a link to
`/forgot-password`. Below the form add "Bought a plugin? Find your key"
linking to `/lost-key`.

**Register page**: on a 409, render the message with "Sign in" and "Reset your
password" links instead of the bare sentence.

**Reset-password page**: with `?welcome=1` the heading reads "Set your
password" and the intro says the account was created from a purchase. On
success it pushes to `/login?reset=true&callbackUrl=/products`.

### 9. Storefront changes

`ShftLanding`, `DrftLanding`, `PluginsStore`:

- The 401 branch and the redirect to `/login` are removed from the buy
  handlers. Nothing else in the buy path changes.
- `PurchaseBanner` keeps only the canceled state. Success handling and the
  `Purchase` pixel move to `/thanks`.
- The three ownership routes add `signedIn: boolean` to their response. When
  signed out and the relevant crossgrade price exists, one line appears under
  the buy button: on shft "Own drft? Sign in for the $15 crossgrade", on drft
  the mirror, on the plugins bundle "Already own one? Sign in to complete the
  pair for $15". Prices come from `PRICING`.
- Each Buy click fires `trackMeta("InitiateCheckout", { value, currency:
  "USD", content_name, content_type: "product" })` before the fetch. Paired
  with the existing `Purchase` event this gives the funnel number the wall
  never had.

### 10. Data flow

Guest happy path:

1. Visitor clicks Buy. `InitiateCheckout` fires. The checkout route sees no
   session and creates a guest Stripe session at full price.
2. Stripe collects card and email. On payment, Stripe redirects to `/thanks`
   with the session id and, in parallel, posts `checkout.session.completed`.
3. Whichever arrives first, the claim route or the webhook, runs
   `grantPluginPurchase`: user created (or matched), Purchase rows created,
   keys minted, referral recorded. The second caller finds everything in
   place and changes nothing.
4. The thanks page renders keys, download buttons, and the set-password
   button. The webhook sends the receipt with the same keys, links, and
   set-password button.
5. Later, the buyer either sets a password from the email or the thanks page
   and lands on My Products, or never does and relies on the key and the
   lost-key page.

Signed-in path: identical except the buyer resolves by id, crossgrade pricing
applies, `needsPassword` is false, and the thanks page offers My Products.

### 11. Edge cases

- **Existing owner buys again while signed out.** Detected as a duplicate by
  the `createdAt` rule. Nothing is regranted, the original session id is kept,
  a warning is logged, and both the page and the email say the charge will be
  refunded. The refund is manual.
- **Email matches an unverified account.** Purchase attaches to it, account
  stays unverified. The receipt's "sign in" path fails until they reset their
  password, which verifies the email and locks out whoever originally
  registered it.
- **Webhook before claim, or claim before webhook.** Both paths create-or-read
  every row with `P2002` handling. Keys are minted once.
- **Stripe session without an email.** Cannot happen for a completed Checkout
  Session, but the helper returns null and logs rather than throwing.
- **Buyer closes the tab before `/thanks` loads.** The webhook still grants
  and emails. The URL with the session id is in their history and works
  again.
- **Lost-key spam.** Rate-limited per email and per IP; responses never
  differ by whether the address exists.

### 12. Security

- Guest checkout session metadata carries no user id, so the webhook can
  never attach a guest purchase to an arbitrary account. Attachment is by the
  Stripe-collected email only.
- `emailVerified` is set only on accounts this feature creates. Existing
  accounts are never verified, upgraded, or modified by a purchase.
- Set-password links are issued only for accounts with `passwordSetAt` null.
- The claim route requires a matching session for any purchase that names a
  user id. Only guest sessions are claimable by session id alone.
- Licence keys as download credentials are scoped to their own product.
- The resend endpoint is constant-response and rate-limited.

### 13. Testing

Unit tests with `node:test` via `npx tsx --test lib/*.test.ts`, following the
existing files:

- `lib/plugin-purchase-grant.test.ts`: `buyerLookupFor` (user id wins over
  email, email lowercased, none), `isDuplicateGrant` (row before session
  created, row after, row absent).
- `lib/plugin-checkout.test.ts`: `checkoutUrls` builds the thanks and cancel
  URLs for each product and cancel path.
- `lib/resend-rate-limit.test.ts`: allows up to the limit, blocks the next,
  frees after the window, keys email and IP independently.

Manual verification against Stripe test mode from the worktree's dev server:
a guest purchase end to end (card 4242), the thanks page, the download links,
the set-password link, the resend page, a signed-in purchase to confirm the
old path still works, and a webhook replay to confirm idempotency.

### 14. Files

New:

- `lib/plugin-checkout.ts`, `lib/plugin-checkout.test.ts`
- `lib/plugin-purchase-grant.ts`, `lib/plugin-purchase-grant.test.ts`
- `lib/resend-rate-limit.ts`, `lib/resend-rate-limit.test.ts`
- `lib/set-password.ts` (`mintSetPasswordUrl`)
- `app/api/plugins/claim/route.ts`
- `app/api/plugins/resend-key/route.ts`
- `app/thanks/page.tsx`, `app/thanks/ThanksPage.tsx`
- `app/lost-key/page.tsx`, `components/LostKeyForm.tsx`
- `prisma/migrations/manual/20260907_password_set_at.sql`

Changed:

- `prisma/schema.prisma` (`passwordSetAt`)
- `app/api/shft/checkout/route.ts`, `app/api/drft/checkout/route.ts`,
  `app/api/bundle/checkout/route.ts`
- `app/api/shft/ownership/route.ts`, `app/api/drft/ownership/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/products/[product]/download/route.ts`
- `app/api/auth/register/route.ts`, `app/api/auth/reset-password/route.ts`,
  `app/api/auth/check-unverified/route.ts`
- `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`,
  `app/(auth)/reset-password/page.tsx`
- `lib/email.ts`, `lib/attribution-snapshot.ts`
- `app/shft/ShftLanding.tsx`, `app/drft/DrftLanding.tsx`,
  `app/plugins/PluginsStore.tsx`

Deleted:

- `app/api/shft/claim/route.ts`, `app/api/drft/claim/route.ts`,
  `app/api/bundle/claim/route.ts`
