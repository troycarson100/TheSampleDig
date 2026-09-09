# Changing the email on an account

**Date:** 2026-09-08
**Status:** approved design, ready for an implementation plan

## Goal

Let a buyer move their account to a different email address without emailing
support. Two entry points, one mechanism: immediately after checkout on
`/thanks`, and any time afterwards from `/settings`.

## Why

Guest checkout collects the address at Stripe with no confirmation step, so a
typo goes straight onto the account and the receipt with it. Nothing in the
product can fix that today: `/settings` offers marketing preferences and links,
and the only account endpoint is `/api/user/marketing-preferences`. Every case
reaches the owner by email and is corrected by hand in the database.

On 2026-09-07 two of the evening's buyers hit email confusion, one of whom
wrote in asking to switch. That one is not even locked out - they received the
receipt and replied from the same address - but there was no self-service path,
so it still cost a support round trip.

The `/thanks` entry point is the more valuable of the two: it catches the
mistake seconds after it is made, while the real buyer is still holding the
page and before anyone reading a mistyped inbox has noticed.

## Scope

In:

- A confirm-by-email change flow, shared by both entry points.
- `/thanks`: a "wrong address? change it" affordance under the receipt line.
- `/settings`: a "Change email for account" row for signed-in users.
- A confirmation email to the new address and a notification to the old one.
- Three new `User` columns plus a hand-applied migration.
- Rate limiting on the request endpoint.

Out:

- Merging two existing accounts. If the target address already has an account,
  the change is refused and the buyer is pointed at support. Both accounts may
  own products, and reconciling that is a judgement call, not an automation.
- Changing the address on the Stripe Customer object. Stripe's record of who
  paid is a historical fact; our account is the thing being corrected. The
  owner can edit it in the dashboard if they want the two to match.
- Any change to how Stripe collects the address at checkout.
- Undo. The notification to the old address is the safety net.

## Design

### 1. The flow

Both entry points do the same three things:

1. **Request.** Someone submits a new address for an account they can prove
   they control. We store it as pending with a token, and send a confirmation
   link to the *new* address. The account itself is unchanged at this point.
2. **Confirm.** They open the link from the new inbox. The account's email
   becomes the new address, the pending fields clear, and `emailVerified` is
   stamped (receiving the link is the proof).
3. **Notify.** The old address is told the account moved, naming the new
   address, so a change the real owner did not make is visible to them.

Verifying the *new* address rather than switching immediately is the load-
bearing decision. A second typo then does nothing at all: the account stays
where it is and the buyer still has both their original inbox and their
`/thanks` page. Switching immediately would strand them somewhere unreachable,
which is strictly worse than the problem being solved.

### 2. Entry point: `/thanks`

Under the existing "We've also sent this to {email}" line, add: **"Wrong
address? Change it"**, which reveals an inline form with one email field.

Authorised by the Stripe checkout session id the page already holds. That is
the same credential that just displayed the licence key, so this grants nothing
new. It is only offered when the claim was not withheld - a withheld response
means the purchase landed on an account that predates the checkout, and
whoever is holding that session id has not proven they own it.

On success the page replaces the form with: "Check {new address} for a link to
confirm the change. Your key and downloads on this page keep working either
way." The keys stay on screen throughout; nothing about this flow takes away
what they already have.

### 3. Entry point: `/settings`

A new `SettingsEmailChange` component in the existing list in
`app/settings/SettingsPageBody.tsx`, following the shape of
`SettingsMarketingPreference`: bordered row, `useSession`, a signed-out state
that links to `/login?callbackUrl=/settings`, inline error text.

It shows the current address, a field for the new one, and a Change button.
On success it shows the same "check your new inbox" confirmation.

Authorised by the NextAuth session.

### 4. Data

Three nullable columns on `User`:

| Column | Purpose |
|---|---|
| `pendingEmail` (`pending_email`) | The address awaiting confirmation. |
| `emailChangeToken` (`email_change_token`, `@unique`) | 32 random bytes, hex. |
| `emailChangeExpires` (`email_change_expires`) | 24 hours out. |

Deliberately separate from the password-reset columns. Reusing those would let
a set-password link and an email-change link overwrite each other, which is
exactly the bug found in the guest checkout review, and a purchase-created
account is likely to hold both at once.

Migration: `prisma/migrations/manual/20260908_email_change.sql`, using
`ADD COLUMN IF NOT EXISTS`, applied by hand to production **before** the code
deploys, per the repo's convention.

### 5. Rules

- The new address must be well formed and differ from the current one.
- If any account already has that address (case-insensitive), refuse with
  "That address already has an account - reply to your receipt and we'll merge
  them." Checked at request time, and **again at confirm time**, because
  another account could claim it in between.
- A request replaces any earlier pending change on that account.
- Tokens live 24 hours. Expired or unknown tokens produce a plain "that link
  has expired, request a new one" page rather than an error.
- Confirming changes only the address, `emailVerified`, and the pending
  fields. Purchases, licence keys, activations, marketing preferences and
  affiliate records all hang off the account id and are untouched.
- Rate limit requests with the existing `SlidingWindowLimiter`: 3 per account
  per hour and 10 per client IP per hour, IP read from `do-connecting-ip`
  first, as `/api/plugins/resend-key` does.
- Unlike the resend endpoint, this one does **not** need a constant response:
  the caller has already proven they hold the account, so telling them "that
  address is taken" leaks nothing they could not learn by trying to register.

### 6. Endpoints

`POST /api/user/email-change` — body `{ newEmail, sessionId? }`.
Authorised by the NextAuth session, or by `sessionId` when it names a paid
Stripe checkout whose buyer resolves to an account created by that checkout
(the same non-withheld test `/api/plugins/claim` applies). Returns
`{ ok: true }`, or 400/409 with a message.

`GET /api/user/email-change/confirm?token=...` — performs the change and
redirects to `/settings?email-changed=1` on success, or
`/settings?email-change=expired` when the token is unknown or stale. A GET
because it is opened from an email, matching how `/verify-email` already
consumes its token. The banner those parameters produce renders **regardless
of sign-in state**, because a guest buyer with no password confirms while
signed out and must still be told it worked.

### 7. Emails

Two new templates in `lib/email.ts`, following the existing house style.

**To the new address:** "Confirm your new email" with the button, a line
saying which account is moving, and the 24-hour expiry. When the account has
no password (`passwordSetAt` is null), it also carries the set-password link
minted by `mintSetPasswordUrl`, so a guest buyer who confirms lands somewhere
they can actually sign into rather than a page that asks for a password they
have never set.

**To the old address:** "Your account email was changed" naming the new
address and telling them to reply immediately if it was not them. No link, no
action - a notification that cannot itself be used to do anything.

Both escape interpolated addresses with the existing `escapeHtml`.

### 8. Security

- The confirmation link goes to the address being adopted, so no one can move
  an account to an inbox they cannot read.
- The old address is always notified, so an unauthorised move is visible.
- The `/thanks` entry point is gated on the same not-withheld rule as the key
  display, so a session id for a pre-existing account grants nothing.
- The taken-address check runs again at confirm time.
- Tokens are 32 random bytes, single use, 24-hour lifetime.
- Requests are rate limited per account and per IP.

### 9. Edge cases

- **Confirming twice.** The token is cleared on first use, so the second click
  lands on the expired page. The account is already correct.
- **Two pending changes.** The newest request overwrites the older token, and
  only the newest link works.
- **The target account appears mid-flight.** Caught by the re-check at confirm
  time; the change is refused and the pending fields cleared.
- **A guest account with no password.** Handled by including the set-password
  link in the confirmation email.
- **Signed in when the address changes.** The JWT holds the old address, so the
  session is refreshed on the next request by the existing `jwt` callback,
  which already re-reads the user on every request. The redirect target
  `/settings?email-changed=1` shows a confirmation banner.

### 10. Testing

Unit tests with `node:test` via `npx tsx --test lib/*.test.ts`, on a pure
decision helper in `lib/email-change-logic.ts`:

- `normalizeNewEmail`: trims, lowercases, rejects malformed and over-long input.
- `decideEmailChange(current, requested, takenByAnotherAccount)`: refuses
  unchanged, malformed and taken addresses; allows otherwise.

Manual verification against the local dev server: request from settings,
confirm from the link, check both emails arrive, check the account moved and
the licence key still resolves; then the same from a `/thanks` page after a
Stripe test-mode guest purchase; then the refusal paths (taken address, expired
token, second click).

### 11. Files

New:

- `prisma/migrations/manual/20260908_email_change.sql`
- `lib/email-change-logic.ts` (+ `.test.ts`)
- `app/api/user/email-change/route.ts`
- `app/api/user/email-change/confirm/route.ts`
- `components/SettingsEmailChange.tsx`
- `components/EmailChangeForm.tsx` (shared by both entry points)

Changed:

- `prisma/schema.prisma` (three columns)
- `lib/email.ts` (two templates)
- `app/settings/SettingsPageBody.tsx` (one row)
- `app/thanks/ThanksPage.tsx` (the affordance and its state)
- `app/(auth)/login/page.tsx` is untouched; the `/settings` banner covers the
  post-change message.
