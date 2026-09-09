# Account Email Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a buyer move their account to a different email address themselves, from the `/thanks` page straight after checkout or from `/settings` later, without emailing support.

**Architecture:** One confirm-by-email mechanism with two entry points. A request stores the new address as pending with a token and emails a confirmation link to that new address; opening the link switches the account and notifies the old address. Verifying the new address (rather than switching immediately) makes a second typo harmless.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 5 + PostgreSQL, NextAuth v5, nodemailer via `lib/email.ts`, `node:test` through `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-08-account-email-change-design.md`

## Global Constraints

- **`.env` points at PRODUCTION Supabase. `.env.local` points at local Postgres.** Prisma reads `.env` by default, so a bare `npx prisma db execute --schema prisma/schema.prisma` would run against **production with ~1,900 real users**. Never run that form. Always pass `--url` explicitly, as Task 1 shows.
- Never run `prisma migrate dev`, `prisma migrate reset`, or `prisma db push`. Schema changes go in `prisma/migrations/manual/*.sql` and are applied with `npx prisma db execute --url "<local url>" --file <path>`.
- Work in the worktree `/Users/troycarson/Developer/thesampledig/.claude/worktrees/email-change` on branch `worktree-email-change`. `node_modules` is a symlink to the main checkout's, which is expected.
- The shell guard rejects command substitution assigned to variables and loops that invoke computed command names. Use plain, separate commands.
- Tests: `npx tsx --test lib/*.test.ts` (84 passing at the start). Typecheck: `npx tsc --noEmit` — ignore errors under `.next/`, which are stale build artifacts. Lint: `npx eslint <path>`.
- Pure logic goes in `*-logic.ts` with **relative imports only** and no Prisma or `next/headers`, so `tsx --test` can load it. Framework code goes in the sibling file.
- Copy style: " - " not em dashes in new strings; British "licence"; lowercase plugin names (`shft`, `drft`).
- Interpolate user-controlled values into email HTML only through the existing `escapeHtml` in `lib/email.ts`.
- Prisma unique-violation detection uses the duck-typed `(e as { code?: string }).code === "P2002"`.
- Commit after each task with the trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Stage named files only, never `git add -A`.

---

## File structure

New:

| File | Responsibility |
|---|---|
| `prisma/migrations/manual/20260908_email_change.sql` | Adds the three pending-change columns. |
| `lib/email-change-logic.ts` (+ test) | Pure: `normalizeNewEmail`, `decideEmailChange`. |
| `lib/email-change.ts` | `mintEmailChangeToken`, `EMAIL_CHANGE_TTL_MS`. |
| `app/api/user/email-change/route.ts` | POST: validate, authorise, store pending, send confirmation. |
| `app/api/user/email-change/confirm/route.ts` | GET: consume token, switch address, notify old address. |
| `components/EmailChangeForm.tsx` | The shared form, used by both entry points. |
| `components/SettingsEmailChange.tsx` | The `/settings` row wrapping the form. |
| `components/SettingsEmailChangeBanner.tsx` | The post-confirm banner on `/settings`. |

Changed: `prisma/schema.prisma`, `lib/email.ts`, `app/settings/SettingsPageBody.tsx`, `app/thanks/ThanksPage.tsx`.

---

### Task 1: Pending-change columns

**Files:**
- Create: `prisma/migrations/manual/20260908_email_change.sql`
- Modify: `prisma/schema.prisma` (User model)

**Interfaces:**
- Produces: `User.pendingEmail: string | null`, `User.emailChangeToken: string | null` (unique), `User.emailChangeExpires: Date | null`.

- [ ] **Step 1: Write the migration**

Create `prisma/migrations/manual/20260908_email_change.sql`:

```sql
-- Self-service email change. The new address is held here, unconfirmed, until
-- the owner opens the link we send to it; only then does users.email move.
-- Deliberately NOT reusing the password_reset_* columns: a purchase-created
-- account often holds a live set-password token at the same time, and one
-- would overwrite the other.
--
-- Apply LOCALLY with (note the explicit --url; a bare --schema targets .env,
-- which is production):
--   npx prisma db execute --url "postgresql://troycarson@127.0.0.1:5432/sampleroll_dev" --file prisma/migrations/manual/20260908_email_change.sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_change_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_change_expires" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_change_token_key" ON "users"("email_change_token");
```

- [ ] **Step 2: Add the columns to the schema**

In `prisma/schema.prisma`, in `model User`, directly after the `passwordSetAt` line, add:

```prisma
  // A requested-but-unconfirmed email address, plus its one-shot token. The
  // account keeps its current `email` until the owner opens the link we send
  // to `pendingEmail`, so a mistyped new address changes nothing.
  pendingEmail                 String?          @map("pending_email")
  emailChangeToken             String?          @unique @map("email_change_token")
  emailChangeExpires           DateTime?        @map("email_change_expires")
```

- [ ] **Step 3: Apply locally and regenerate the client**

Run, exactly as written (the explicit `--url` keeps this off production):

```bash
npx prisma db execute --url "postgresql://troycarson@127.0.0.1:5432/sampleroll_dev" --file prisma/migrations/manual/20260908_email_change.sql
npx prisma generate
```

Expected: the first prints nothing or "Script executed successfully"; the second prints "Generated Prisma Client".

Confirm the columns exist:

```bash
psql "postgresql://troycarson@127.0.0.1:5432/sampleroll_dev" -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('pending_email','email_change_token','email_change_expires') ORDER BY column_name;"
```

Expected: three rows.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors outside `.next/`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/manual/20260908_email_change.sql
git commit -m "feat: columns for a pending account email change

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Pure decision logic

**Files:**
- Create: `lib/email-change-logic.ts`, `lib/email-change-logic.test.ts`

**Interfaces:**
- Produces: `normalizeNewEmail(input: unknown): string | null`; `type EmailChangeDecision = { action: "send" } | { action: "refuse"; reason: "invalid" | "unchanged" | "taken" }`; `decideEmailChange(currentEmail: string, requested: string | null, takenByAnotherAccount: boolean): EmailChangeDecision`; `EMAIL_CHANGE_REFUSAL: Record<"invalid" | "unchanged" | "taken", string>`.

- [ ] **Step 1: Write the failing tests**

Create `lib/email-change-logic.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizeNewEmail, decideEmailChange, EMAIL_CHANGE_REFUSAL } from "./email-change-logic"

test("normalizeNewEmail trims and lowercases", () => {
  assert.equal(normalizeNewEmail("  New@Example.COM "), "new@example.com")
})

test("normalizeNewEmail rejects anything that is not a usable address", () => {
  assert.equal(normalizeNewEmail(""), null)
  assert.equal(normalizeNewEmail("   "), null)
  assert.equal(normalizeNewEmail("no-at-sign"), null)
  assert.equal(normalizeNewEmail("@nolocalpart.com"), null)
  assert.equal(normalizeNewEmail("nodomain@"), null)
  assert.equal(normalizeNewEmail("has space@example.com"), null)
  assert.equal(normalizeNewEmail(`${"a".repeat(250)}@example.com`), null)
  assert.equal(normalizeNewEmail(42), null)
  assert.equal(normalizeNewEmail(null), null)
})

test("decideEmailChange sends for a good, free, different address", () => {
  assert.deepEqual(decideEmailChange("old@example.com", "new@example.com", false), { action: "send" })
})

test("decideEmailChange refuses an unusable address", () => {
  assert.deepEqual(decideEmailChange("old@example.com", null, false), {
    action: "refuse",
    reason: "invalid",
  })
})

test("decideEmailChange refuses the address the account already has", () => {
  assert.deepEqual(decideEmailChange("Old@Example.com", "old@example.com", false), {
    action: "refuse",
    reason: "unchanged",
  })
})

test("decideEmailChange refuses an address another account holds", () => {
  assert.deepEqual(decideEmailChange("old@example.com", "taken@example.com", true), {
    action: "refuse",
    reason: "taken",
  })
})

test("unchanged is reported before taken, since it is the more useful message", () => {
  assert.deepEqual(decideEmailChange("old@example.com", "old@example.com", true), {
    action: "refuse",
    reason: "unchanged",
  })
})

test("every refusal reason has a message", () => {
  for (const reason of ["invalid", "unchanged", "taken"] as const) {
    assert.ok(EMAIL_CHANGE_REFUSAL[reason].length > 0)
  }
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx tsx --test lib/email-change-logic.test.ts`
Expected: FAIL, "Cannot find module './email-change-logic'".

- [ ] **Step 3: Write the implementation**

Create `lib/email-change-logic.ts`:

```ts
// Pure decisions for moving an account to a new email address. No Prisma, no
// next/headers, relative imports only, so `npx tsx --test` loads it directly.
// The database work lives in lib/email-change.ts and the two route handlers.

/**
 * Canonicalise a requested address, or null if it is not usable. Deliberately
 * the same shape check /api/plugins/resend-key applies - an @ with something
 * either side, no spaces, within the 254-character limit - rather than a
 * clever regex. The confirmation link is the real validation: an address that
 * cannot receive mail never becomes the account's.
 */
export function normalizeNewEmail(input: unknown): string | null {
  if (typeof input !== "string") return null
  const email = input.trim().toLowerCase()
  if (!email || email.length > 254) return null
  if (/\s/.test(email)) return null
  const at = email.indexOf("@")
  if (at <= 0 || at !== email.lastIndexOf("@") || at === email.length - 1) return null
  return email
}

export type EmailChangeDecision =
  | { action: "send" }
  | { action: "refuse"; reason: "invalid" | "unchanged" | "taken" }

/** What the caller sees for each refusal. `taken` points at support rather
 *  than offering a merge: both accounts may own products, and reconciling
 *  that is a judgement call. */
export const EMAIL_CHANGE_REFUSAL: Record<"invalid" | "unchanged" | "taken", string> = {
  invalid: "That doesn't look like an email address.",
  unchanged: "That's already the address on this account.",
  taken: "That address already has an account - reply to your receipt and we'll merge them.",
}

/**
 * `takenByAnotherAccount` is resolved by the caller, which does the lookup.
 * Checked again at confirm time, because another account can claim the
 * address while a change is pending.
 */
export function decideEmailChange(
  currentEmail: string,
  requested: string | null,
  takenByAnotherAccount: boolean,
): EmailChangeDecision {
  if (!requested) return { action: "refuse", reason: "invalid" }
  if (requested === currentEmail.trim().toLowerCase()) {
    return { action: "refuse", reason: "unchanged" }
  }
  if (takenByAnotherAccount) return { action: "refuse", reason: "taken" }
  return { action: "send" }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsx --test lib/email-change-logic.test.ts`
Expected: 8 tests pass.

- [ ] **Step 5: Run the full suite**

Run: `npx tsx --test lib/*.test.ts`
Expected: 92 passing (84 existing + 8 new), output pristine.

- [ ] **Step 6: Commit**

```bash
git add lib/email-change-logic.ts lib/email-change-logic.test.ts
git commit -m "feat: pure decisions for an account email change

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Token minting and the two emails

**Files:**
- Create: `lib/email-change.ts`
- Modify: `lib/email.ts` (add two exported functions at the end)

**Interfaces:**
- Consumes: `escapeHtml`, `APP_URL`, `FROM`, `sendMailWithFallback` (all already in `lib/email.ts`).
- Produces: `EMAIL_CHANGE_TTL_MS` and `mintEmailChangeToken(userId: string, pendingEmail: string): Promise<string>` in `lib/email-change.ts`; `sendEmailChangeConfirmEmail(newEmail: string, opts: { token: string; currentEmail: string; setPasswordUrl?: string | null }): Promise<void>` and `sendEmailChangedNoticeEmail(oldEmail: string, newEmail: string): Promise<void>` in `lib/email.ts`.

- [ ] **Step 1: Write the token minter**

Create `lib/email-change.ts`:

```ts
import crypto from "node:crypto"
import { prisma } from "@/lib/db"

/** Long enough that a link found the next morning still works, short enough
 *  that an abandoned request does not sit around indefinitely. */
export const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Record a pending address change and return its one-shot token.
 *
 * Overwrites any earlier pending change on the account: only the newest link
 * should work, and the older address was never adopted, so nothing is lost.
 * The account's own `email` is untouched here - it moves only when the token
 * is confirmed.
 */
export async function mintEmailChangeToken(userId: string, pendingEmail: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  await prisma.user.update({
    where: { id: userId },
    data: {
      pendingEmail,
      emailChangeToken: token,
      emailChangeExpires: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
    },
  })
  return token
}
```

- [ ] **Step 2: Add both email templates**

Append to `lib/email.ts` (after `sendPasswordResetEmail`):

```ts
/** Sent to the address someone wants to move their account TO. Opening the
    link is the proof they can receive mail there, which is why nothing changes
    until they do. A guest-created account gets the set-password link in the
    same email, so confirming lands them somewhere they can actually sign in
    rather than at a password prompt they have never set. */
export async function sendEmailChangeConfirmEmail(
  newEmail: string,
  opts: { token: string; currentEmail: string; setPasswordUrl?: string | null },
) {
  const url = `${APP_URL}/api/user/email-change/confirm?token=${opts.token}`
  const safeCurrent = escapeHtml(opts.currentEmail)
  const safeNew = escapeHtml(newEmail)

  const passwordBlock = opts.setPasswordUrl
    ? `
        <p style="color: #555; font-size: 14px; margin: 24px 0 8px;">
          This account has no password yet. Once you've confirmed, set one to see
          your downloads and licence keys on My Products.
        </p>
        <a href="${opts.setPasswordUrl}" style="display: inline-block; border: 1px solid #d8d8d8; color: #1a1a1a; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px;">
          Set password
        </a>`
    : ""

  await sendMailWithFallback({
    from: FROM,
    to: newEmail,
    subject: "Confirm your new email address",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Confirm your new email</h1>
        <p style="color: #555; margin-bottom: 24px;">
          Someone asked to move the Sample Roll account currently on
          <strong>${safeCurrent}</strong> to this address, <strong>${safeNew}</strong>.
          Click below to confirm. Nothing changes until you do.
        </p>
        <a href="${url}" style="display: inline-block; background: #e63c3c; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
          Confirm this address
        </a>
        ${passwordBlock}
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          This link expires in 24 hours. If you weren't expecting it, ignore this email - the account stays exactly as it is.
        </p>
        <p style="color: #ccc; font-size: 12px; margin-top: 8px;">
          Or copy this link: ${url}
        </p>
      </div>
    `,
  })
}

/** Sent to the address an account just moved AWAY from. Carries no link and
    offers no action: it exists so that a change the real owner did not make is
    visible to them, and it must not itself be usable to do anything. */
export async function sendEmailChangedNoticeEmail(oldEmail: string, newEmail: string) {
  const safeNew = escapeHtml(newEmail)

  await sendMailWithFallback({
    from: FROM,
    to: oldEmail,
    subject: "Your Sample Roll account email was changed",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Your account email was changed</h1>
        <p style="color: #555; margin-bottom: 16px;">
          The Sample Roll account that used this address now uses
          <strong>${safeNew}</strong>. Your purchases, licence keys and downloads
          moved with it.
        </p>
        <p style="color: #555; margin-bottom: 0;">
          If this wasn't you, reply to this email straight away and we'll put it back.
        </p>
      </div>
    `,
  })
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint lib/email.ts lib/email-change.ts`
Expected: clean apart from `.next/` noise.

- [ ] **Step 4: Commit**

```bash
git add lib/email-change.ts lib/email.ts
git commit -m "feat: email change token and its two notification emails

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The request endpoint

**Files:**
- Create: `app/api/user/email-change/route.ts`

**Interfaces:**
- Consumes: `normalizeNewEmail`, `decideEmailChange`, `EMAIL_CHANGE_REFUSAL` (Task 2); `mintEmailChangeToken` (Task 3); `sendEmailChangeConfirmEmail` (Task 3); `mintSetPasswordUrl` from `lib/set-password.ts`; `SlidingWindowLimiter` from `lib/resend-rate-limit.ts`; `buyerLookupFor` and `isAccountFromSession` from `lib/plugin-purchase-logic.ts`; `isCompProduct` from `lib/plugin-products.ts`; `auth` from `lib/auth.ts`.
- Produces: `POST /api/user/email-change` accepting `{ newEmail: string; sessionId?: string }`, returning `{ ok: true }` (200), or `{ error }` with 400 / 401 / 409 / 429.

- [ ] **Step 1: Write the route**

Create `app/api/user/email-change/route.ts`:

```ts
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendEmailChangeConfirmEmail } from "@/lib/email"
import { mintEmailChangeToken } from "@/lib/email-change"
import {
  decideEmailChange,
  normalizeNewEmail,
  EMAIL_CHANGE_REFUSAL,
} from "@/lib/email-change-logic"
import { isCompProduct } from "@/lib/plugin-products"
import { buyerLookupFor, isAccountFromSession } from "@/lib/plugin-purchase-logic"
import { SlidingWindowLimiter } from "@/lib/resend-rate-limit"
import { mintSetPasswordUrl } from "@/lib/set-password"

// Ask to move an account to a different email address. Nothing changes here:
// we record the request and email a confirmation link to the NEW address, so a
// mistyped one simply never gets adopted.
//
// Two ways to prove you own the account:
//   a signed-in session, or
//   the Stripe checkout session id of a purchase that CREATED the account -
//   the same not-withheld rule /api/plugins/claim uses before it shows keys.
//   A session id for an account that predates the checkout proves nothing
//   about owning it, so it is refused here too.
const HOUR = 60 * 60 * 1000
const perAccount = new SlidingWindowLimiter(3, HOUR)
const perIp = new SlidingWindowLimiter(10, HOUR)

type Owner = { id: string; email: string; passwordSetAt: Date | null }

/** The account this caller has proven they own, or null. */
async function resolveOwner(sessionId: unknown): Promise<Owner | null> {
  const session = await auth()
  if (session?.user?.id) {
    return prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, passwordSetAt: true },
    })
  }

  if (typeof sessionId !== "string" || !sessionId) return null
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return null

  try {
    const checkout = await new Stripe(secret).checkout.sessions.retrieve(sessionId)
    const settled =
      checkout.payment_status === "paid" || checkout.payment_status === "no_payment_required"
    if (!settled || !isCompProduct(checkout.metadata?.product)) return null

    const lookup = buyerLookupFor(checkout)
    const user =
      lookup.kind === "user"
        ? await prisma.user.findUnique({
            where: { id: lookup.id },
            select: { id: true, email: true, passwordSetAt: true, createdAt: true },
          })
        : lookup.kind === "email"
          ? await prisma.user.findFirst({
              where: { email: { equals: lookup.email, mode: "insensitive" } },
              select: { id: true, email: true, passwordSetAt: true, createdAt: true },
            })
          : null
    if (!user) return null
    // Only an account this checkout created. Anything older belongs to someone
    // who was already here.
    if (!isAccountFromSession(user.createdAt, checkout.created)) return null
    return { id: user.id, email: user.email, passwordSetAt: user.passwordSetAt }
  } catch (e) {
    console.error("[email-change] stripe lookup failed", e)
    return null
  }
}

export async function POST(request: Request) {
  let body: { newEmail?: unknown; sessionId?: unknown }
  try {
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  const ip =
    request.headers.get("do-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  if (!perIp.allow(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again in an hour." }, { status: 429 })
  }

  const owner = await resolveOwner(body.sessionId)
  if (!owner) {
    return NextResponse.json({ error: "Please sign in to change your email." }, { status: 401 })
  }
  if (!perAccount.allow(owner.id)) {
    return NextResponse.json({ error: "Too many requests. Try again in an hour." }, { status: 429 })
  }

  const requested = normalizeNewEmail(body.newEmail)
  const taken = requested
    ? Boolean(
        await prisma.user.findFirst({
          where: { email: { equals: requested, mode: "insensitive" }, id: { not: owner.id } },
          select: { id: true },
        }),
      )
    : false

  const decision = decideEmailChange(owner.email, requested, taken)
  if (decision.action === "refuse") {
    return NextResponse.json(
      { error: EMAIL_CHANGE_REFUSAL[decision.reason], reason: decision.reason },
      { status: decision.reason === "taken" ? 409 : 400 },
    )
  }

  try {
    const token = await mintEmailChangeToken(owner.id, requested!)
    const setPasswordUrl = owner.passwordSetAt === null ? await mintSetPasswordUrl(owner.id) : null
    await sendEmailChangeConfirmEmail(requested!, {
      token,
      currentEmail: owner.email,
      setPasswordUrl,
    })
  } catch (e) {
    // The pending row may already be written. Surfacing the failure is right:
    // the caller is waiting on an email that is not coming, and telling them
    // to retry is more useful than a silent success.
    console.error("[email-change] request failed", e)
    return NextResponse.json({ error: "Could not send the confirmation. Try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint app/api/user/email-change/route.ts`
Expected: clean apart from `.next/` noise.

- [ ] **Step 3: Commit**

```bash
git add app/api/user/email-change/route.ts
git commit -m "feat: request an account email change

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The confirm endpoint

**Files:**
- Create: `app/api/user/email-change/confirm/route.ts`

**Interfaces:**
- Consumes: `sendEmailChangedNoticeEmail` (Task 3); the columns from Task 1.
- Produces: `GET /api/user/email-change/confirm?token=...` redirecting to `/settings?email-changed=<new address>` on success, `/settings?email-change=expired` for a bad or stale token, and `/settings?email-change=taken` when the address was claimed while pending.

- [ ] **Step 1: Write the route**

Create `app/api/user/email-change/confirm/route.ts`:

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendEmailChangedNoticeEmail } from "@/lib/email"

// Opened from the confirmation email. Consuming this link is what proves the
// person can receive mail at the new address, so this is where the account
// actually moves.
//
// A GET that mutates, matching how /verify-email already consumes its token:
// it is opened from an inbox, the token is single use, and the effect is the
// one the recipient asked for.
function back(request: Request, params: string) {
  return NextResponse.redirect(new URL(`/settings?${params}`, request.url), 303)
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")
  if (!token) return back(request, "email-change=expired")

  const user = await prisma.user.findUnique({
    where: { emailChangeToken: token },
    select: {
      id: true,
      email: true,
      pendingEmail: true,
      emailChangeExpires: true,
    },
  })

  if (!user || !user.pendingEmail) return back(request, "email-change=expired")
  if (!user.emailChangeExpires || user.emailChangeExpires < new Date()) {
    return back(request, "email-change=expired")
  }

  // Re-check: another account could have claimed this address while the
  // change sat pending.
  const taken = await prisma.user.findFirst({
    where: { email: { equals: user.pendingEmail, mode: "insensitive" }, id: { not: user.id } },
    select: { id: true },
  })
  if (taken) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingEmail: null, emailChangeToken: null, emailChangeExpires: null },
    })
    return back(request, "email-change=taken")
  }

  const oldEmail = user.email
  const newEmail = user.pendingEmail

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: newEmail,
        // Opening this link proves they receive mail there, which is exactly
        // what verification means.
        emailVerified: new Date(),
        pendingEmail: null,
        emailChangeToken: null,
        emailChangeExpires: null,
      },
    })
  } catch (e) {
    // Almost certainly P2002 from a race on the unique email column.
    console.error("[email-change confirm] update failed", e)
    return back(request, "email-change=taken")
  }

  // Best effort: the address has already moved, and failing to warn the old
  // inbox must not undo that.
  try {
    await sendEmailChangedNoticeEmail(oldEmail, newEmail)
  } catch (e) {
    console.error("[email-change confirm] notice to the old address failed", e)
  }

  return back(request, `email-changed=${encodeURIComponent(newEmail)}`)
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint app/api/user/email-change/confirm/route.ts`
Expected: clean apart from `.next/` noise.

- [ ] **Step 3: Commit**

```bash
git add app/api/user/email-change/confirm/route.ts
git commit -m "feat: confirm an account email change from the emailed link

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The shared form

**Files:**
- Create: `components/EmailChangeForm.tsx`

**Interfaces:**
- Consumes: `POST /api/user/email-change` (Task 4).
- Produces: `EmailChangeForm({ currentEmail, sessionId, compact }: { currentEmail: string; sessionId?: string; compact?: boolean })`, a client component that renders its own success state.

- [ ] **Step 1: Write the component**

Create `components/EmailChangeForm.tsx`:

```tsx
"use client"

import { useState } from "react"

const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none w-full"
const fieldStyle = {
  borderColor: "var(--border)",
  color: "var(--foreground)",
  background: "rgba(255, 255, 255, 0.45)",
}
const btnCls =
  "rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer mt-3"
const btnStyle = { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }

/**
 * Ask to move the account to a different address. Used from /settings (where
 * the NextAuth session authorises it) and from /thanks (where `sessionId`, the
 * Stripe checkout id, does).
 *
 * Nothing changes when this succeeds - a confirmation link goes to the new
 * address - so the success copy says to go and check that inbox rather than
 * implying the account has already moved.
 */
export default function EmailChangeForm({
  currentEmail,
  sessionId,
  compact = false,
}: {
  currentEmail: string
  sessionId?: string
  compact?: boolean
}) {
  const [newEmail, setNewEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function submit() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/user/email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, ...(sessionId ? { sessionId } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not send the confirmation.")
      setSentTo(newEmail.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the confirmation.")
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <p
        className={`rounded-lg border px-3 py-2 text-sm ${compact ? "" : "mt-2"}`}
        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
      >
        Check <strong>{sentTo}</strong> for a link to confirm the change. Until you open it,
        this account stays on {currentEmail}.
      </p>
    )
  }

  return (
    <div className={compact ? "" : "mt-3"}>
      <input
        className={inputCls}
        style={fieldStyle}
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        aria-label="New email address"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy && newEmail.trim()) submit()
        }}
      />
      {error ? (
        <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <button className={btnCls} style={btnStyle} disabled={busy || !newEmail.trim()} onClick={submit}>
        {busy ? "Sending..." : "Send confirmation"}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint components/EmailChangeForm.tsx`
Expected: clean apart from `.next/` noise.

- [ ] **Step 3: Commit**

```bash
git add components/EmailChangeForm.tsx
git commit -m "feat: shared form for requesting an email change

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The settings row and its banner

**Files:**
- Create: `components/SettingsEmailChange.tsx`, `components/SettingsEmailChangeBanner.tsx`
- Modify: `app/settings/SettingsPageBody.tsx`

**Interfaces:**
- Consumes: `EmailChangeForm` (Task 6); the redirect parameters from Task 5.
- Produces: two default-exported client components rendered by `SettingsPageBody`.

- [ ] **Step 1: Write the settings row**

Create `components/SettingsEmailChange.tsx`, following the shape of `components/SettingsMarketingPreference.tsx`:

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import EmailChangeForm from "./EmailChangeForm"

export default function SettingsEmailChange() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)

  if (status === "loading") {
    return (
      <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </p>
      </div>
    )
  }

  if (status !== "authenticated" || !session?.user?.email) {
    return (
      <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm mb-2" style={{ color: "var(--muted)" }}>
          Sign in to change the email on your account.
        </p>
        <Link
          href="/login?callbackUrl=/settings"
          className="text-sm font-medium underline"
          style={{ color: "var(--foreground)" }}
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
          >
            Change email for account
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
            Currently {session.user.email}. Your purchases, licence keys and downloads move with
            the account - we&apos;ll email the new address to confirm it first.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 text-sm font-medium underline cursor-pointer"
            style={{ color: "var(--foreground)", background: "none", border: "none" }}
          >
            Change
          </button>
        )}
      </div>
      {open && <EmailChangeForm currentEmail={session.user.email} />}
    </div>
  )
}
```

- [ ] **Step 2: Write the banner**

Create `components/SettingsEmailChangeBanner.tsx`:

```tsx
"use client"

import { useSearchParams } from "next/navigation"

/**
 * The outcome of clicking a confirmation link. Rendered whether or not the
 * visitor is signed in: a guest buyer with no password confirms while signed
 * out and still has to be told it worked.
 */
export default function SettingsEmailChangeBanner() {
  const params = useSearchParams()
  const changed = params.get("email-changed")
  const problem = params.get("email-change")

  if (changed) {
    return (
      <div
        className="rounded-lg border px-4 py-3 mb-4 text-sm"
        style={{ borderColor: "rgba(22,163,74,0.3)", background: "rgba(22,163,74,0.08)", color: "#166534" }}
      >
        Done - this account now uses <strong>{changed}</strong>. Sign in with that address from now on.
      </div>
    )
  }

  if (problem === "expired") {
    return (
      <div
        className="rounded-lg border px-4 py-3 mb-4 text-sm"
        style={{ borderColor: "rgba(234,179,8,0.4)", background: "rgba(234,179,8,0.1)", color: "#854d0e" }}
      >
        That confirmation link has expired or has already been used. Request a new one below.
      </div>
    )
  }

  if (problem === "taken") {
    return (
      <div
        className="rounded-lg border px-4 py-3 mb-4 text-sm"
        style={{ borderColor: "rgba(234,179,8,0.4)", background: "rgba(234,179,8,0.1)", color: "#854d0e" }}
      >
        That address was claimed by another account before you confirmed, so nothing changed. Reply
        to your receipt and we&apos;ll sort it out.
      </div>
    )
  }

  return null
}
```

- [ ] **Step 3: Wire both into the settings page**

In `app/settings/SettingsPageBody.tsx`, add to the imports:

```tsx
import { Suspense } from "react"
import SettingsEmailChange from "@/components/SettingsEmailChange"
import SettingsEmailChangeBanner from "@/components/SettingsEmailChangeBanner"
```

Immediately after the `<h1>` / description `<p>` pair and before `<nav ...>`, add:

```tsx
        <Suspense fallback={null}>
          <SettingsEmailChangeBanner />
        </Suspense>
```

(`useSearchParams` needs a Suspense boundary, or Next opts the whole route into client-side rendering.)

Then inside `<nav ...>`, directly after `<SettingsMarketingPreference />`, add:

```tsx
          <SettingsEmailChange />
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint components/SettingsEmailChange.tsx components/SettingsEmailChangeBanner.tsx app/settings/SettingsPageBody.tsx`
Expected: clean apart from `.next/` noise.

- [ ] **Step 5: Commit**

```bash
git add components/SettingsEmailChange.tsx components/SettingsEmailChangeBanner.tsx app/settings/SettingsPageBody.tsx
git commit -m "feat: change the account email from settings

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The thanks-page affordance

**Files:**
- Modify: `app/thanks/ThanksPage.tsx`

**Interfaces:**
- Consumes: `EmailChangeForm` (Task 6); the existing `Claim` type's `email`, `withheld` fields.

- [ ] **Step 1: Import the form and add state**

In `app/thanks/ThanksPage.tsx`, add to the imports:

```tsx
import EmailChangeForm from "@/components/EmailChangeForm"
```

At the top of the `ThanksPage` component body, beside the existing `state`, add:

```tsx
  const [changingEmail, setChangingEmail] = useState(false)
  // Named to avoid shadowing the effect's local `const sessionId`, which is
  // still the value the claim request uses.
  const [claimSessionId, setClaimSessionId] = useState<string | null>(null)
```

Inside the existing `useEffect`, leave `const sessionId = params.get("session_id")` and its `if (!sessionId) { ... }` guard exactly as they are, and add this line immediately after that guard's closing brace:

```tsx
    setClaimSessionId(sessionId)
```

- [ ] **Step 2: Add the affordance under the receipt line**

In the success branch, replace the paragraph that currently reads:

```tsx
      <p className="text-[15px] mb-8" style={muted}>
        Here&apos;s everything you need. We&apos;ve also sent it to <strong>{claim.email}</strong> -
        check spam if it isn&apos;t there, or{" "}
        <Link href="/lost-key" className="underline">resend it</Link>.
      </p>
```

with:

```tsx
      <p className="text-[15px] mb-2" style={muted}>
        Here&apos;s everything you need. We&apos;ve also sent it to <strong>{claim.email}</strong> -
        check spam if it isn&apos;t there, or{" "}
        <Link href="/lost-key" className="underline">resend it</Link>.
      </p>
      <div className="mb-8">
        {!changingEmail ? (
          <button
            type="button"
            onClick={() => setChangingEmail(true)}
            className="text-[14px] underline cursor-pointer"
            style={{ color: "var(--foreground)", opacity: 0.75, background: "none", border: "none", padding: 0 }}
          >
            Wrong address? Change it
          </button>
        ) : (
          <div className="max-w-sm">
            <p className="text-[14px] mb-2" style={muted}>
              We&apos;ll email the new address to confirm. Your key and downloads on this page keep
              working either way.
            </p>
            <EmailChangeForm currentEmail={claim.email} sessionId={claimSessionId ?? undefined} compact />
          </div>
        )}
      </div>
```

The affordance sits only in the success branch, so it never appears on a withheld claim - that response means the purchase landed on an account older than the checkout, and whoever holds the session id has not proven they own it.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint app/thanks/ThanksPage.tsx`
Expected: clean apart from `.next/` noise, and no new `react-hooks` errors beyond the one this file already has.

- [ ] **Step 4: Run the full suite**

Run: `npx tsx --test lib/*.test.ts`
Expected: 92 passing.

- [ ] **Step 5: Commit**

```bash
git add app/thanks/ThanksPage.tsx
git commit -m "feat: fix a mistyped address straight from the thanks page

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: End-to-end verification against the local server

**Files:** scratch only. Fix any bug in the task that owns the file and commit there.

- [ ] **Step 1: Start the dev server**

The main checkout usually holds port 3000. Run from the worktree, in the background:

```bash
NEXTAUTH_URL=http://localhost:3001 NEXT_PUBLIC_APP_URL=http://localhost:3001 npx next dev -p 3001 --webpack
```

Wait for "Ready", then `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/settings` → `200`.

- [ ] **Step 2: Pick a test account**

```bash
psql "postgresql://troycarson@127.0.0.1:5432/sampleroll_dev" -c "SELECT id, email, password_set_at IS NULL AS no_password FROM users ORDER BY created_at DESC LIMIT 5;"
```

Note one id and email. Everything below uses that account.

- [ ] **Step 3: Request a change while signed out (expect 401)**

```bash
curl -s -w ' [%{http_code}]\n' -X POST http://localhost:3001/api/user/email-change -H 'content-type: application/json' -d '{"newEmail":"someone-new@example.com"}'
```

Expected: `{"error":"Please sign in to change your email."} [401]`.

- [ ] **Step 4: Request from the settings page**

Sign in at `http://localhost:3001/login` as the test account, open `http://localhost:3001/settings`, confirm a "Change email for account" row appears showing the current address, click Change, enter `troycarson100+ec1@gmail.com`, submit.

Expected: the row replaces the form with "Check troycarson100+ec1@gmail.com for a link to confirm the change."

Confirm the pending row was written:

```bash
psql "postgresql://troycarson@127.0.0.1:5432/sampleroll_dev" -c "SELECT email, pending_email, email_change_expires > now() AS token_live FROM users WHERE pending_email IS NOT NULL;"
```

Expected: one row, `token_live = t`, `email` still the old address.

- [ ] **Step 5: Confirm from the link**

Read the token:

```bash
psql "postgresql://troycarson@127.0.0.1:5432/sampleroll_dev" -t -c "SELECT email_change_token FROM users WHERE pending_email IS NOT NULL;"
```

Open `http://localhost:3001/api/user/email-change/confirm?token=<token>` in the browser.

Expected: redirected to `/settings?email-changed=troycarson100%2Bec1%40gmail.com`, with a green banner naming the new address. The database now shows the new `email`, `pending_email` null, `email_change_token` null.

Both emails should have been attempted: a confirmation to the new address and a notice to the old. Note in your report whether they arrived, and if you cannot check an inbox, say so plainly rather than assuming.

- [ ] **Step 6: The refusal paths**

With a signed-in session, request each of these and record the status and message:

- the address the account already has → 400, "That's already the address on this account."
- an address belonging to another account → 409, "That address already has an account..."
- `not-an-email` → 400, "That doesn't look like an email address."
- the same confirmation token a second time → redirect to `/settings?email-change=expired`

- [ ] **Step 7: Rate limiting**

```bash
curl -s -o /dev/null -w '%{http_code} ' -X POST http://localhost:3001/api/user/email-change -H 'content-type: application/json' -d '{"newEmail":"a@example.com"}'
```

Repeat four times while signed in. Expected: the fourth is `429`.

- [ ] **Step 8: The thanks-page entry point**

The simplest honest check without a new Stripe purchase: open a `/thanks?session_id=<an existing paid session id>&product=shft` URL for a purchase whose account was created by that checkout, and confirm the "Wrong address? Change it" link appears under the receipt line and opens the form. If no such session id is available locally, run a Stripe test-mode guest purchase as `docs/superpowers/plans/2026-09-07-guest-checkout.md` Task 13 describes, and use its thanks URL.

Also confirm the affordance is **absent** on a withheld claim (a purchase whose account predates the checkout).

- [ ] **Step 9: Full checks**

Run: `npx tsx --test lib/*.test.ts && npx tsc --noEmit`
Expected: 92 passing; no source type errors.

- [ ] **Step 10: Record and commit**

Stop the dev server. Append a "Verified 2026-09-08" section to the bottom of this plan listing which steps passed, which were skipped and why, then:

```bash
git add docs/superpowers/plans/2026-09-08-account-email-change.md
git commit -m "docs: email change verification notes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Deployment notes (for the owner, after merge)

1. Apply `prisma/migrations/manual/20260908_email_change.sql` to the production Supabase database **before** deploying the code, exactly as the `password_set_at` migration was applied on 2026-09-07. The columns are additive and nullable, so existing rows are untouched and no backfill is needed.
2. No new environment variables.
3. Nothing about existing accounts changes until someone requests a change.
