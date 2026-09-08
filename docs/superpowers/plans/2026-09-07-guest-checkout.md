# Guest Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone buy shft, drft, or the bundle without signing in; the buyer gets keys and installers on a `/thanks` page and by email, and an account is provisioned for them from the Stripe-collected email.

**Architecture:** The three checkout routes stop requiring a session and hand session creation to one helper. One grant helper (`lib/plugin-purchase-grant.ts`) turns a paid Stripe Checkout Session into a user (found or created) plus Purchase rows, and is called identically by the webhook and by a single new claim route. A `/thanks` page claims the session and renders keys and key-authenticated download links; the receipt email carries the same links plus a set-password link for purchase-created accounts.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 5 + PostgreSQL, Stripe (`stripe` npm, test mode locally), NextAuth v5 credentials, `node:test` via `tsx` for unit tests, Playwright (already a dependency) for the end-to-end check.

**Spec:** `docs/superpowers/specs/2026-09-07-guest-checkout-design.md`

## Amendments (made during execution, after task reviews)

1. **Task 8 review, finding A.** A guest claim could reveal a pre-existing passwordless account's keys and mint its set-password link to whoever typed that email at Stripe. Fixed in Task 8's fix round: `GrantResult.accountFromThisPurchase` (pure `isAccountFromSession(user.createdAt, session.created)` in `lib/plugin-purchase-logic.ts`); the claim route returns `withheld: true` with no items and no set-password link unless the viewer is signed in as the owner or the account was born from this checkout. Task 9's thanks page renders a withheld variant; Task 13 Step 11 verifies it. The webhook is unchanged: its link goes to the inbox, which is the proof of ownership.
2. **Task 8 review, finding B.** The webhook and the claim route each minted a set-password token, and the second mint invalidated the first link. Fixed in the same round: `mintSetPasswordUrl` reuses an existing token with at least `SET_PASSWORD_REUSE_MIN_MS` (24h) of life left; forgot-password's 1-hour tokens and expired tokens are still replaced.
3. **Task 7 review.** The offers page (`app/offers/OffersView.tsx`) also calls the checkout routes and had a 401 branch; Task 12 removes that dead branch as well.
4. **Task 10 review.** The per-IP limiter keyed on `x-forwarded-for`, which on DigitalOcean App Platform is DO's own ingress; the resend route now prefers `do-connecting-ip`. The limiter never deleted keys; it now sweeps aged-out keys once it holds `sweepAt` (1000) entries, with two extra tests.
5. **Task 11 review.** Three reachable UI regressions in this plan's own Task 11 code, fixed in its fix round and corrected in the steps above: the reset page's loading label changed the untouched non-welcome flow from "Updating…" to "Saving…"; `needsPassword` and `exists` were reset only on the happy error branch, so a later network error or an unchecked terms box rendered stale account links beside an unrelated message; and the login error text ended with the same words as the link that follows it.
6. **Commit attribution changed mid-execution.** Commits through Task 10 carry `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; from Task 11 onward the trailer in this plan is `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Both are correct for their commits; do not rewrite history to unify them.

## Global Constraints

- Work happens in the worktree at `/Users/troycarson/Developer/thesampledig/.claude/worktrees/guest-checkout` on branch `worktree-guest-checkout`. `node_modules` there is a symlink to the main checkout's, so `npx prisma generate` updates the shared client (harmless to the main tree).
- Never run `prisma migrate dev`, `prisma migrate reset`, or `prisma db push`. Schema changes go in `prisma/migrations/manual/*.sql` and are applied with `npx prisma db execute`. Local `DATABASE_URL` in `.env.local` points at `127.0.0.1:5432/sampleroll_dev`.
- Prisma reads `.env`, not `.env.local`. Prefix Prisma CLI commands with the `DATABASE_URL` from `.env.local` as shown in Task 1.
- Unit tests: `npx tsx --test lib/*.test.ts`. Typecheck: `npx tsc --noEmit`. Lint a file: `npx eslint <path>`.
- Never regenerate an existing licence key. Only fill a null one, with `updateMany({ where: { id, licenseKey: null } })` then re-read.
- `Purchase.stripeSessionId` is `@unique`: a session stamps only the first product it grants (shft for the bundle).
- Existing accounts are never modified by a purchase. `emailVerified` is set only on accounts the grant helper creates. Set-password links are minted only when `User.passwordSetAt` is null.
- Copy style: the plugins are written lowercase (`shft`, `drft`); use " - " not an em dash in user-facing strings; British "licence" in user-facing copy, matching `/products`.
- Prisma unique-violation detection follows the existing duck-typed pattern: `(e as { code?: string }).code === "P2002"`.
- Pure logic goes in `*-logic.ts` files with no Prisma or `next/headers` imports so tests can load them; DB and framework code goes in the sibling file (the `lib/affiliate-logic.ts` / `lib/affiliate.ts` split).
- Commit after every task with a `feat:`/`refactor:`/`docs:` prefix and the trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## File structure

New files:

| File | Responsibility |
|---|---|
| `prisma/migrations/manual/20260907_password_set_at.sql` | Adds `users.password_set_at`, backfills to `created_at`. |
| `lib/set-password.ts` | `mintSetPasswordUrl(userId)`: writes a 7-day reset token, returns the welcome URL. |
| `lib/plugin-purchase-logic.ts` (+ test) | Pure: `buyerLookupFor`, `isDuplicateGrant`, `setPasswordPath`, `downloadHref`, `downloadsFor`. |
| `lib/plugin-purchase-grant.ts` | `grantPluginPurchase(session)`: find-or-create user, create-or-read Purchase rows, mint keys, record referral. |
| `lib/plugin-checkout-logic.ts` (+ test) | Pure: `checkoutUrls`. |
| `lib/plugin-checkout.ts` | `checkoutBaseUrl`, `readAffiliateCodeFromCookie`, `createPluginCheckoutSession`. |
| `lib/resend-rate-limit.ts` (+ test) | `SlidingWindowLimiter`. |
| `app/api/plugins/claim/route.ts` | Claims a paid session for the thanks page; replaces the three claim routes. |
| `app/api/plugins/resend-key/route.ts` | Re-sends the receipt to an email, rate-limited, constant response. |
| `app/thanks/page.tsx`, `app/thanks/ThanksPage.tsx` | Success page: keys, downloads, set-password / My Products. |
| `app/lost-key/page.tsx`, `components/LostKeyForm.tsx` | Lost-key page. |

Modified: `prisma/schema.prisma`, `lib/attribution-snapshot.ts`, `lib/email.ts`, `lib/meta-pixel.ts`, `app/api/stripe/webhook/route.ts`, `app/api/products/[product]/download/route.ts`, the three checkout routes, the two ownership routes, `app/api/auth/{register,reset-password,check-unverified}/route.ts`, `app/(auth)/{login,register,reset-password}/page.tsx`, `app/shft/ShftLanding.tsx`, `app/drft/DrftLanding.tsx`, `app/plugins/PluginsStore.tsx`.

Deleted: `app/api/shft/claim/route.ts`, `app/api/drft/claim/route.ts`, `app/api/bundle/claim/route.ts`.

---

### Task 1: `passwordSetAt` column and the routes that stamp it

**Files:**
- Create: `prisma/migrations/manual/20260907_password_set_at.sql`
- Modify: `prisma/schema.prisma:13-53` (User model)
- Modify: `app/api/auth/register/route.ts:37-48`
- Modify: `app/api/auth/reset-password/route.ts:28-37`

**Interfaces:**
- Produces: `User.passwordSetAt: Date | null` on the Prisma client. Null means no human has chosen a password on the account.

- [ ] **Step 1: Write the migration**

Create `prisma/migrations/manual/20260907_password_set_at.sql`:

```sql
-- Guest checkout: an account created by a plugin purchase has no human-chosen
-- password. NULL here means "nobody has set a password on this account"; the
-- receipt email and the login page use it to offer "set a password" instead of
-- "sign in". Every account that exists before this column does have a
-- password (register always took one), hence the backfill.
--
-- Apply with:
--   npx prisma db execute --file prisma/migrations/manual/20260907_password_set_at.sql --schema prisma/schema.prisma
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_set_at" TIMESTAMP(3);
UPDATE "users" SET "password_set_at" = "created_at" WHERE "password_set_at" IS NULL;
```

- [ ] **Step 2: Add the column to the schema**

In `prisma/schema.prisma`, directly after the `passwordResetExpires` line in `model User`, add:

```prisma
  // When a human last chose a password for this account. NULL means nobody
  // has: the account was created by a guest plugin purchase (see
  // lib/plugin-purchase-grant.ts) and the buyer has not set one yet. The
  // receipt email and the login page key off this to say "set a password"
  // rather than "sign in". Register and reset-password both stamp it.
  passwordSetAt                DateTime?        @map("password_set_at")
```

- [ ] **Step 3: Apply the migration locally and regenerate the client**

Run:

```bash
export DATABASE_URL="$(node -e 'require("dotenv").config({path:".env.local"});process.stdout.write(process.env.DATABASE_URL)')"
npx prisma db execute --file prisma/migrations/manual/20260907_password_set_at.sql --schema prisma/schema.prisma
npx prisma generate
```

Expected: `db execute` prints nothing (or "Script executed successfully"); `generate` prints "Generated Prisma Client".

Confirm the backfill (`psql` is at `/opt/homebrew/bin/psql`):

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FILTER (WHERE password_set_at IS NULL) AS unset, count(*) AS total FROM users;"
```

Expected: `unset` is 0.

- [ ] **Step 4: Stamp it on register**

In `app/api/auth/register/route.ts`, inside `prisma.user.create({ data: { ... } })`, add a line after `passwordHash,`:

```ts
        passwordHash,
        passwordSetAt: new Date(),
```

- [ ] **Step 5: Stamp it on password reset, and verify the email there too**

In `app/api/auth/reset-password/route.ts`, replace the `prisma.user.update` call with:

```ts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordSetAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
        // Completing a reset proves control of the inbox, which is exactly
        // what email verification proves. This is also what rescues a buyer
        // whose guest purchase landed on an old, never-verified account: the
        // reset link goes to their inbox, and once used they can sign in.
        emailVerified: user.emailVerified ?? new Date(),
      },
    })
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If the run reports errors in files this task did not touch, note them and continue; they are pre-existing.)

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/manual/20260907_password_set_at.sql app/api/auth/register/route.ts app/api/auth/reset-password/route.ts
git commit -m "feat: track whether an account has a human-chosen password

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Attribution by visitor id and the set-password mint

**Files:**
- Modify: `lib/attribution-snapshot.ts`
- Create: `lib/set-password.ts`

**Interfaces:**
- Produces: `snapshotForVisitor(visitorId: string): Promise<AttributionSnapshot | null>` in `lib/attribution-snapshot.ts`.
- Produces: `mintSetPasswordUrl(userId: string): Promise<string>` and `SET_PASSWORD_TTL_MS` in `lib/set-password.ts`.
- Consumes: `setPasswordPath` from Task 3. Write `lib/set-password.ts` to import it; the import resolves once Task 3 lands. If you are executing Task 2 before Task 3, create `lib/plugin-purchase-logic.ts` with just the `setPasswordPath` function from Task 3 Step 3 now, and Task 3 will extend it.

- [ ] **Step 1: Extract `snapshotForVisitor`**

Replace the body of `readAttributionSnapshot` in `lib/attribution-snapshot.ts` and add the new export, so the file's two snapshot functions read:

```ts
/**
 * First-touch attribution for the current request, resolved from the sr_vid
 * cookie. Returns null when there's no cookie or no matching landing event —
 * callers must treat that as "unknown source", never as an error.
 */
export async function readAttributionSnapshot(): Promise<AttributionSnapshot | null> {
  try {
    const cookieStore = await cookies()
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value
    if (!visitorId) return null
    return await snapshotForVisitor(visitorId)
  } catch (e) {
    console.error("[attribution snapshot]", e)
    return null
  }
}

/**
 * The same snapshot for a visitor id we already hold. The Stripe webhook has
 * no request cookies - only the attrVisitorId the checkout route copied into
 * session metadata - and uses this to attribute a guest-created account the
 * same way a form signup is attributed. Null when the id matches no landing
 * event.
 */
export async function snapshotForVisitor(visitorId: string): Promise<AttributionSnapshot | null> {
  try {
    const landing = await prisma.landingEvent.findUnique({
      where: { visitorId },
      select: { referrerHost: true, utmSource: true, utmCampaign: true, landingPath: true },
    })
    if (!landing) return null

    return {
      attributionVisitorId: visitorId,
      attributionReferrerHost: landing.referrerHost,
      attributionUtmSource: landing.utmSource,
      attributionUtmCampaign: landing.utmCampaign,
      attributionLandingPath: landing.landingPath,
    }
  } catch (e) {
    console.error("[attribution snapshot]", e)
    return null
  }
}
```

`readAttributionMetadata` below it is unchanged.

- [ ] **Step 2: Write `lib/set-password.ts`**

```ts
import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { setPasswordPath } from "@/lib/plugin-purchase-logic"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

/** A receipt gets read days later; a password reset gets clicked in minutes. */
export const SET_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Mint a set-password link for an account that has no human-chosen password
 * (User.passwordSetAt is null - one created by a guest plugin purchase).
 *
 * Reuses the password-reset columns, so the ordinary reset-password route
 * consumes it; the only differences are the longer expiry and the welcome
 * flag on the URL. Overwrites any earlier token: only the newest link needs
 * to work, and forgot-password re-mints on demand.
 *
 * Callers are responsible for the passwordSetAt check. Handing one of these
 * to an account that has a real password would let whoever holds the link
 * take the account over.
 */
export async function mintSetPasswordUrl(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetToken: token,
      passwordResetExpires: new Date(Date.now() + SET_PASSWORD_TTL_MS),
    },
  })
  return `${APP_URL}${setPasswordPath(token)}`
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. If `@/lib/plugin-purchase-logic` is missing because Task 3 has not run, create it now with only the `setPasswordPath` function shown in Task 3 Step 3.

- [ ] **Step 4: Commit**

```bash
git add lib/attribution-snapshot.ts lib/set-password.ts lib/plugin-purchase-logic.ts
git commit -m "feat: attribution by visitor id and set-password link minting

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

(Drop `lib/plugin-purchase-logic.ts` from the `git add` if you did not create it here.)

---

### Task 3: Pure purchase logic and the grant helper

**Files:**
- Create: `lib/plugin-purchase-logic.ts`
- Create: `lib/plugin-purchase-logic.test.ts`
- Create: `lib/plugin-purchase-grant.ts`

**Interfaces:**
- Consumes: `snapshotForVisitor` (Task 2), `recordAffiliateReferral(session, purchaseId)` from `lib/affiliate.ts`, `generateLicenseKey(product)` from `lib/license-key.ts`, `PLUGIN_GRANTS` / `isCompProduct` / `PluginProduct` from `lib/plugin-products.ts`, `PRODUCTS` from `lib/products.ts`.
- Produces, in `lib/plugin-purchase-logic.ts`:
  - `type BuyerLookup = { kind: "user"; id: string } | { kind: "email"; email: string } | { kind: "none" }`
  - `buyerLookupFor(session: BuyerSource): BuyerLookup`
  - `isDuplicateGrant(existingCreatedAt: Date, sessionCreatedUnix: number): boolean`
  - `setPasswordPath(token: string): string`
  - `downloadHref(product: string, assetId: string, licenseKey: string): string`
  - `type DownloadLink = { id: string; label: string; href: string }`
  - `downloadsFor(product: string, licenseKey: string): DownloadLink[]`
- Produces, in `lib/plugin-purchase-grant.ts`:
  - `type GrantItem = { product: PluginProduct; licenseKey: string }`
  - `type GrantResult = { userId: string; email: string; needsPassword: boolean; items: GrantItem[]; duplicates: PluginProduct[] }`
  - `grantPluginPurchase(session: Stripe.Checkout.Session): Promise<GrantResult | null>`

- [ ] **Step 1: Write the failing tests**

Create `lib/plugin-purchase-logic.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  buyerLookupFor,
  isDuplicateGrant,
  setPasswordPath,
  downloadHref,
  downloadsFor,
} from "./plugin-purchase-logic"

const guestless = { client_reference_id: null, metadata: {}, customer_details: null, customer_email: null }

test("buyerLookupFor: client_reference_id wins over everything", () => {
  const session = { ...guestless, client_reference_id: "u1", metadata: { userId: "u9" }, customer_details: { email: "a@b.c" } }
  assert.deepEqual(buyerLookupFor(session), { kind: "user", id: "u1" })
})

test("buyerLookupFor: metadata.userId is the fallback id", () => {
  assert.deepEqual(buyerLookupFor({ ...guestless, metadata: { userId: "u2" } }), { kind: "user", id: "u2" })
})

test("buyerLookupFor: a guest resolves by trimmed, lowercased email", () => {
  const session = { ...guestless, customer_details: { email: "  Buyer@Example.COM " } }
  assert.deepEqual(buyerLookupFor(session), { kind: "email", email: "buyer@example.com" })
})

test("buyerLookupFor: customer_email is used when customer_details has none", () => {
  assert.deepEqual(buyerLookupFor({ ...guestless, customer_email: "x@y.z" }), { kind: "email", email: "x@y.z" })
})

test("buyerLookupFor: nothing to go on", () => {
  assert.deepEqual(buyerLookupFor(guestless), { kind: "none" })
})

test("isDuplicateGrant: a row older than the session is a duplicate", () => {
  const sessionCreated = 1_700_000_000
  assert.equal(isDuplicateGrant(new Date(sessionCreated * 1000 - 1), sessionCreated), true)
})

test("isDuplicateGrant: a row created after the session began is this purchase", () => {
  const sessionCreated = 1_700_000_000
  assert.equal(isDuplicateGrant(new Date(sessionCreated * 1000 + 5_000), sessionCreated), false)
})

test("setPasswordPath carries the token and the welcome flag", () => {
  assert.equal(setPasswordPath("abc123"), "/reset-password?token=abc123&welcome=1")
})

test("downloadHref points at the download route with the key as credential", () => {
  assert.equal(
    downloadHref("shft", "installer-win", "SHFT-0000-0000-0000"),
    "/api/products/shft/download?asset=installer-win&key=SHFT-0000-0000-0000",
  )
})

test("downloadsFor lists every asset of the product with the key baked in", () => {
  const links = downloadsFor("drft", "DRFT-0000-0000-0000")
  assert.deepEqual(
    links.map((l) => l.id),
    ["installer", "installer-win", "manual"],
  )
  for (const l of links) {
    assert.ok(l.label.length > 0)
    assert.ok(l.href.startsWith("/api/products/drft/download?asset="))
    assert.ok(l.href.endsWith("&key=DRFT-0000-0000-0000"))
  }
})

test("downloadsFor returns nothing for an unknown product", () => {
  assert.deepEqual(downloadsFor("nope", "SHFT-0000-0000-0000"), [])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test lib/plugin-purchase-logic.test.ts`
Expected: FAIL, "Cannot find module './plugin-purchase-logic'" (or, if Task 2 created a stub, failures on the missing exports).

- [ ] **Step 3: Write `lib/plugin-purchase-logic.ts`**

```ts
import { PRODUCTS } from "./products"

// Pure decisions for turning a paid Stripe Checkout Session into a grant. No
// Prisma, no next/headers, and relative imports only (like lib/license-key.ts),
// so `npx tsx --test` loads it directly; the DB work lives in
// lib/plugin-purchase-grant.ts.

/** The fields of a Stripe Checkout Session that identify who paid. Declared
 *  structurally so tests can pass plain objects. */
export type BuyerSource = {
  client_reference_id?: string | null
  metadata?: Record<string, string> | null
  customer_details?: { email?: string | null } | null
  customer_email?: string | null
}

export type BuyerLookup =
  | { kind: "user"; id: string }
  | { kind: "email"; email: string }
  | { kind: "none" }

/**
 * Who paid, from the session alone. A signed-in checkout stamps the user id
 * (client_reference_id and metadata.userId); a guest checkout stamps neither,
 * and the only identity is the email Stripe collected.
 */
export function buyerLookupFor(session: BuyerSource): BuyerLookup {
  const id = session.client_reference_id ?? session.metadata?.userId
  if (typeof id === "string" && id.length > 0) return { kind: "user", id }
  const raw = session.customer_details?.email ?? session.customer_email
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : ""
  if (email) return { kind: "email", email }
  return { kind: "none" }
}

/**
 * A Purchase row that existed BEFORE the checkout session was created cannot
 * have come from it: the buyer already owned the product and has now paid
 * again. Rows created after the session began belong to it - the webhook and
 * the claim route race, and either may have landed first.
 */
export function isDuplicateGrant(existingCreatedAt: Date, sessionCreatedUnix: number): boolean {
  return existingCreatedAt.getTime() < sessionCreatedUnix * 1000
}

/** `welcome=1` makes the reset page read "Set your password". */
export function setPasswordPath(token: string): string {
  return `/reset-password?token=${encodeURIComponent(token)}&welcome=1`
}

/** The download route accepts the licence key as its credential (see
 *  app/api/products/[product]/download/route.ts). */
export function downloadHref(product: string, assetId: string, licenseKey: string): string {
  return `/api/products/${product}/download?asset=${assetId}&key=${encodeURIComponent(licenseKey)}`
}

export type DownloadLink = { id: string; label: string; href: string }

/** Every downloadable asset of a product, each linked with the key baked in.
 *  Used by the receipt email and the thanks page. */
export function downloadsFor(product: string, licenseKey: string): DownloadLink[] {
  const def = PRODUCTS[product]
  if (!def) return []
  return def.assets.map((a) => ({ id: a.id, label: a.label, href: downloadHref(product, a.id, licenseKey) }))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsx --test lib/plugin-purchase-logic.test.ts`
Expected: 11 tests pass.

- [ ] **Step 5: Write `lib/plugin-purchase-grant.ts`**

```ts
import crypto from "node:crypto"
import bcrypt from "bcryptjs"
import type Stripe from "stripe"
import { prisma } from "@/lib/db"
import { PLUGIN_GRANTS, isCompProduct, type PluginProduct } from "@/lib/plugin-products"
import { generateLicenseKey } from "@/lib/license-key"
import { recordAffiliateReferral } from "@/lib/affiliate"
import { snapshotForVisitor } from "@/lib/attribution-snapshot"
import { buyerLookupFor, isDuplicateGrant } from "@/lib/plugin-purchase-logic"

// The one place a paid Stripe Checkout Session becomes Purchase rows. Called by
// the webhook and by /api/plugins/claim, in either order, any number of times:
// every write is create-or-read, so the second caller changes nothing.
//
// It never sends email. The webhook does that, once.

export type GrantItem = { product: PluginProduct; licenseKey: string }

export type GrantResult = {
  userId: string
  email: string
  /** User.passwordSetAt is null: the account was created by a purchase and
   *  nobody has chosen a password. Callers offer "set a password". */
  needsPassword: boolean
  items: GrantItem[]
  /** Products this email already owned before this checkout began. The
   *  charge is a duplicate; nothing was regranted. */
  duplicates: PluginProduct[]
}

type Buyer = { id: string; email: string; passwordSetAt: Date | null }

const buyerSelect = { id: true, email: true, passwordSetAt: true } as const

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002"

async function findByEmail(email: string): Promise<Buyer | null> {
  return prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: buyerSelect })
}

async function resolveBuyer(session: Stripe.Checkout.Session): Promise<Buyer | null> {
  const lookup = buyerLookupFor(session)
  if (lookup.kind === "none") {
    console.warn(`[plugin grant] session ${session.id} has neither a user id nor an email`)
    return null
  }
  if (lookup.kind === "user") {
    const user = await prisma.user.findUnique({ where: { id: lookup.id }, select: buyerSelect })
    if (!user) console.warn(`[plugin grant] session ${session.id} names unknown user ${lookup.id}`)
    return user
  }

  // Guest. An existing account is used as-is - never verified, never touched.
  const existing = await findByEmail(lookup.email)
  if (existing) return existing

  // No account: create one. The password is 32 random bytes nobody knows, so
  // the only way onto this account is a link sent to this address - which is
  // why emailVerified can be stamped now. passwordSetAt stays null so the
  // receipt and the login page say "set a password" rather than "sign in".
  const attribution = session.metadata?.attrVisitorId
    ? await snapshotForVisitor(session.metadata.attrVisitorId)
    : null
  try {
    return await prisma.user.create({
      data: {
        email: lookup.email,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
        emailVerified: new Date(),
        passwordSetAt: null,
        emailMarketingOptIn: true,
        ...(attribution ?? {}),
      },
      select: buyerSelect,
    })
  } catch (e) {
    // The webhook and the claim route can both try to create this user at
    // once. The loser re-reads the winner's row.
    if (!isUniqueViolation(e)) throw e
    return findByEmail(lookup.email)
  }
}

async function grantOne(
  buyer: Buyer,
  product: PluginProduct,
  session: Stripe.Checkout.Session,
  stampSession: boolean,
): Promise<{ id: string; licenseKey: string; duplicate: boolean }> {
  const where = { userId_product: { userId: buyer.id, product } }
  let row = await prisma.purchase.findUnique({ where })
  let duplicate = false

  if (row) {
    duplicate = isDuplicateGrant(row.createdAt, session.created)
    if (duplicate) {
      console.warn(
        `[plugin grant] duplicate purchase: ${buyer.email} already owned ${product} (session ${session.id})`,
      )
    }
  } else {
    try {
      row = await prisma.purchase.create({
        data: {
          userId: buyer.id,
          product,
          // stripeSessionId is @unique on Purchase: one session stamps one row
          // (the first product of a bundle), the rule the webhook always kept.
          stripeSessionId: stampSession ? session.id : null,
          licenseKey: generateLicenseKey(product),
        },
      })
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      row = await prisma.purchase.findUnique({ where })
      if (!row) throw e
    }
  }

  // Never regenerate an existing key - the buyer may already have it typed
  // into the plugin. Only fill a null one (rows from before licensing), and
  // only if nobody else has since: licenseKey:null in the WHERE makes a
  // concurrent fill lose cleanly, and the re-read returns whichever key won.
  if (!row.licenseKey) {
    await prisma.purchase.updateMany({
      where: { id: row.id, licenseKey: null },
      data: { licenseKey: generateLicenseKey(product) },
    })
    row = (await prisma.purchase.findUnique({ where: { id: row.id } })) ?? row
  }
  if (!row.licenseKey) throw new Error(`[plugin grant] purchase ${row.id} still has no licence key`)

  return { id: row.id, licenseKey: row.licenseKey, duplicate }
}

/**
 * Grant whatever `session.metadata.product` covers to whoever paid. Returns
 * null, after logging, when the session is not a plugin purchase or names
 * nobody we can grant to.
 */
export async function grantPluginPurchase(session: Stripe.Checkout.Session): Promise<GrantResult | null> {
  const product = session.metadata?.product
  if (!isCompProduct(product)) return null

  const buyer = await resolveBuyer(session)
  if (!buyer) return null

  const items: GrantItem[] = []
  const duplicates: PluginProduct[] = []
  let firstPurchaseId: string | null = null
  let first = true
  for (const p of PLUGIN_GRANTS[product]) {
    const granted = await grantOne(buyer, p, session, first)
    first = false
    firstPurchaseId ??= granted.id
    items.push({ product: p, licenseKey: granted.licenseKey })
    if (granted.duplicate) duplicates.push(p)
  }

  // One referral per checkout, hung off the first granted row (the
  // AffiliateReferral <-> Purchase relation is one-to-one). Idempotent.
  if (firstPurchaseId) await recordAffiliateReferral(session, firstPurchaseId)

  return {
    userId: buyer.id,
    email: buyer.email,
    needsPassword: buyer.passwordSetAt === null,
    items,
    duplicates,
  }
}
```

- [ ] **Step 6: Typecheck and run all tests**

Run: `npx tsc --noEmit && npx tsx --test lib/*.test.ts`
Expected: no type errors; all tests pass (63 existing + 11 new).

- [ ] **Step 7: Commit**

```bash
git add lib/plugin-purchase-logic.ts lib/plugin-purchase-logic.test.ts lib/plugin-purchase-grant.ts
git commit -m "feat: one grant helper for plugin purchases, with guest buyer provisioning

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Licence key as a download credential

**Files:**
- Modify: `app/api/products/[product]/download/route.ts`

**Interfaces:**
- Consumes: `normalizeLicenseKey` from `lib/license-key.ts`.
- Produces: `GET /api/products/:product/download?asset=<id>&key=<licence key>` serves the asset when the key belongs to a Purchase of that product. Without `key`, behaviour is unchanged.

- [ ] **Step 1: Rewrite the route**

Replace the whole file with:

```ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getProduct } from "@/lib/products"
import { normalizeLicenseKey } from "@/lib/license-key"
import { getSignedDownloadUrl, isStorageConfigured } from "@/lib/spaces"

// Gated download for an owned product asset. Two credentials are accepted:
//
//   ?key=SHFT-XXXX-XXXX-XXXX   the licence key. This is what the receipt email
//                              and the thanks page link to, so a guest buyer
//                              with no website session can still install. The
//                              key already IS the secret (it activates the
//                              plugin), and it only unlocks its own product.
//   a signed-in session        for /products, as before.
//
// Either way the caller is 302'd to a short-lived signed storage URL.
//   GET /api/products/shft/download?asset=installer|installer-win|manual[&key=...]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ product: string }> },
) {
  const { product } = await params
  const def = getProduct(product)
  if (!def) {
    return NextResponse.json({ error: "Unknown product." }, { status: 404 })
  }

  const url = new URL(request.url)
  const rawKey = url.searchParams.get("key")
  if (rawKey !== null) {
    const key = normalizeLicenseKey(rawKey)
    const purchase = key
      ? await prisma.purchase.findUnique({ where: { licenseKey: key }, select: { product: true } })
      : null
    if (!purchase || purchase.product !== product) {
      return NextResponse.json({ error: "That licence key doesn't unlock this download." }, { status: 403 })
    }
  } else {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 })
    }
    const owns = await prisma.purchase.findUnique({
      where: { userId_product: { userId: session.user.id, product } },
    })
    if (!owns) {
      return NextResponse.json({ error: "You don't own this product." }, { status: 403 })
    }
  }

  const assetId = url.searchParams.get("asset") || "installer"
  const asset = def.assets.find((a) => a.id === assetId)
  if (!asset) {
    return NextResponse.json({ error: "Unknown asset." }, { status: 404 })
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "The download isn't available yet — hang tight." }, { status: 503 })
  }

  const signed = await getSignedDownloadUrl(asset.key, asset.filename, 300)
  return NextResponse.redirect(signed, 302)
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/products/[product]/download/route.ts"
git commit -m "feat: licence key unlocks its product's downloads without a session

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Receipt email with download links and the account block

**Files:**
- Modify: `lib/email.ts:90-145` (`sendPluginPurchaseEmail`)

**Interfaces:**
- Consumes: `downloadsFor` (Task 3).
- Produces: `sendPluginPurchaseEmail(email, items, opts?: PurchaseEmailOptions)` where `PurchaseEmailOptions = { setPasswordUrl?: string | null; duplicates?: readonly string[] }`. Existing callers (comps redeem) keep working with no third argument.

- [ ] **Step 1: Replace `sendPluginPurchaseEmail`**

Add the import at the top of `lib/email.ts`:

```ts
import { downloadsFor } from "@/lib/plugin-purchase-logic"
```

Then replace the whole `sendPluginPurchaseEmail` function (from its doc comment through its closing brace) with:

```ts
export type PurchaseEmailOptions = {
  /** Present when the account has no human-chosen password (it was created by
   *  this purchase). The email then says "set a password", not "sign in". */
  setPasswordUrl?: string | null
  /** Products this address already owned before this checkout. The charge is
   *  a duplicate and is refunded by hand. */
  duplicates?: readonly string[]
}

const buttonStyle =
  "display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;"
const linkChipStyle =
  "display: inline-block; margin: 0 8px 8px 0; padding: 8px 14px; border: 1px solid #d8d8d8; border-radius: 999px; color: #1a1a1a; text-decoration: none; font-size: 14px;"

/** Purchase receipt for one or more plugins (a bundle purchase sends one email
    covering both keys). Each key block is followed by direct download links
    that use the key as their credential, so a buyer who never signs in still
    gets the installer. Key blocks are omitted when a key is missing rather
    than printing an empty box — /products always shows the real one. */
export async function sendPluginPurchaseEmail(
  email: string,
  items: { product: "shft" | "drft"; licenseKey: string | null }[],
  opts: PurchaseEmailOptions = {}
) {
  const url = `${APP_URL}/products`
  const names = items.map((i) => i.product).join(" + ")

  const keyBlocks = items
    .filter((i) => i.licenseKey)
    .map((i) => {
      const links = downloadsFor(i.product, i.licenseKey!)
        .map((d) => `<a href="${APP_URL}${d.href}" style="${linkChipStyle}">↓ ${d.label}</a>`)
        .join("")
      return `
        <p style="color: #555; margin-bottom: 8px; font-size: 14px;">Your ${i.product} licence key</p>
        <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px;
                  letter-spacing: 1px; background: #f4f4f4; border: 1px solid #e4e4e4;
                  border-radius: 8px; padding: 12px 16px; margin: 0 0 12px;">
          ${i.licenseKey}
        </p>
        <p style="color: #555; margin-bottom: 12px; font-size: 14px;">
          Paste it into ${i.product} the first time you open it. It activates up to 3 machines,
          and you can free one any time from My Products.
        </p>
        <div style="margin: 0 0 24px;">${links}</div>`
    })
    .join("")

  const downloadLines = items
    .map((i) => `<strong>${i.product}</strong> for ${PLUGIN_EMAIL_COPY[i.product]?.formats ?? "macOS & Windows"}`)
    .join(" and ")

  const account = opts.setPasswordUrl
    ? `
        <p style="color: #555; margin: 0 0 12px; font-size: 14px;">
          Your purchase is saved to <strong>${email}</strong>. Set a password to see it on
          My Products, manage your machines, and re-download any time.
        </p>
        <a href="${opts.setPasswordUrl}" style="${buttonStyle}">Set password</a>`
    : `
        <p style="color: #555; margin: 0 0 12px; font-size: 14px;">
          Sign in with <strong>${email}</strong> to see it on My Products.
        </p>
        <a href="${url}" style="${buttonStyle}">Go to My Products</a>
        <p style="color: #999; font-size: 13px; margin-top: 12px;">
          Forgot your password? <a href="${APP_URL}/forgot-password" style="color: #555;">Reset it</a>.
        </p>`

  const duplicateNote = opts.duplicates?.length
    ? `
        <p style="color: #854d0e; background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px;
                  padding: 12px 16px; font-size: 14px; margin: 24px 0 0;">
          It looks like ${email} already owned ${opts.duplicates.join(" and ")}, so this charge
          will be refunded. Reply to this email if it hasn't landed within a few days.
        </p>`
    : ""

  await sendMailWithFallback({
    from: FROM,
    to: email,
    subject: `Your ${names} download is ready`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Thanks for buying ${names}</h1>
        <p style="color: #555; margin-bottom: 24px;">
          Your purchase is complete. Below is everything you need: your licence key and the
          download links for ${downloadLines}, plus the user manual.
        </p>
        ${keyBlocks}
        ${account}
        ${duplicateNote}
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          Reply here if you hit any trouble and we'll sort you out.
        </p>
      </div>
    `,
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. The comps redeem route's call `sendPluginPurchaseEmail(session.user.email!, emailItems)` still compiles because `opts` defaults.

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat: receipt email carries download links and a set-password path

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Webhook uses the grant helper

**Files:**
- Modify: `app/api/stripe/webhook/route.ts:1-9` (imports) and `:48-125` (the plugin branch of `checkout.session.completed`)

**Interfaces:**
- Consumes: `grantPluginPurchase` (Task 3), `mintSetPasswordUrl` (Task 2), `sendPluginPurchaseEmail` with opts (Task 5).

- [ ] **Step 1: Replace the imports**

Replace the import block at the top of the file with:

```ts
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/db"
import { isCompProduct } from "@/lib/plugin-products"
import { sendPluginPurchaseEmail } from "@/lib/email"
import { grantPluginPurchase } from "@/lib/plugin-purchase-grant"
import { mintSetPasswordUrl } from "@/lib/set-password"
import { reverseTransferForRefund } from "@/lib/affiliate-stripe"
```

- [ ] **Step 2: Replace the plugin branch**

Inside `case "checkout.session.completed":`, replace everything from the comment `// --- Plugin purchases: single products and the bundle.` down to and including the `break` that closes the `if (grantProducts) { ... }` block, with:

```ts
        // --- Plugin purchases: single products and the bundle. -----------------
        // All the grant logic (find-or-create the buyer, create-or-read the
        // Purchase rows, mint keys, record the referral) lives in
        // lib/plugin-purchase-grant.ts and is shared with /api/plugins/claim,
        // so the two can run in either order. This route's only extra job is
        // the receipt email, sent exactly once, from here.
        if (isCompProduct(session.metadata?.product)) {
          const result = await grantPluginPurchase(session)
          if (!result) {
            console.warn(`[Stripe webhook] plugin purchase ${session.id} could not be granted`)
            break
          }
          try {
            // A purchase-created account has no password yet; the receipt is
            // where the buyer gets the link to set one. An account with a real
            // password is told to sign in instead - never handed a reset link.
            const setPasswordUrl = result.needsPassword ? await mintSetPasswordUrl(result.userId) : null
            await sendPluginPurchaseEmail(result.email, result.items, {
              setPasswordUrl,
              duplicates: result.duplicates,
            })
          } catch (e) {
            console.error("[Stripe webhook] plugin purchase email failed:", e)
          }
          break
        }
```

The subscription handling that follows (`const userId = session.client_reference_id ?? ...`) and the other cases are unchanged.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint app/api/stripe/webhook/route.ts`
Expected: clean. If eslint flags an unused import, remove it.

- [ ] **Step 4: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "refactor: webhook grants plugin purchases through the shared helper

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Checkout without a session

**Files:**
- Create: `lib/plugin-checkout-logic.ts`, `lib/plugin-checkout-logic.test.ts`, `lib/plugin-checkout.ts`
- Modify: `app/api/shft/checkout/route.ts`, `app/api/drft/checkout/route.ts`, `app/api/bundle/checkout/route.ts` (full rewrites)

**Interfaces:**
- Produces, in `lib/plugin-checkout-logic.ts`: `type CancelPath = "/shft" | "/drft" | "/plugins"`, `checkoutUrls(baseUrl: string, product: CompProduct, paid: number, cancelPath: CancelPath): { success_url: string; cancel_url: string }`.
- Produces, in `lib/plugin-checkout.ts`: `type CheckoutBuyer = { id: string; email: string | null }`, `checkoutBaseUrl(): string`, `readAffiliateCodeFromCookie(label: string): Promise<string | null>`, `createPluginCheckoutSession(stripe: Stripe, opts: { product: CompProduct; priceId: string; paid: number; cancelPath: CancelPath; buyer: CheckoutBuyer | null; affiliateCode: string | null }): Promise<Stripe.Checkout.Session>`.
- Produces: the three checkout routes return `{ url }` for guests as well as signed-in users. 401 is no longer returned.

- [ ] **Step 1: Write the failing test**

Create `lib/plugin-checkout-logic.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { checkoutUrls } from "./plugin-checkout-logic"

test("checkoutUrls: success lands on /thanks with the session placeholder, product and price", () => {
  const urls = checkoutUrls("https://sampleroll.com", "shft", 19, "/shft")
  assert.equal(urls.success_url, "https://sampleroll.com/thanks?session_id={CHECKOUT_SESSION_ID}&product=shft&paid=19")
})

test("checkoutUrls: cancel returns to the page the buyer left", () => {
  assert.equal(checkoutUrls("http://localhost:3000", "bundle", 34, "/plugins").cancel_url, "http://localhost:3000/plugins?purchase=canceled")
  assert.equal(checkoutUrls("http://localhost:3000", "drft", 15, "/drft").cancel_url, "http://localhost:3000/drft?purchase=canceled")
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test lib/plugin-checkout-logic.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write `lib/plugin-checkout-logic.ts`**

```ts
import type { CompProduct } from "./plugin-products"

export type CancelPath = "/shft" | "/drft" | "/plugins"

/**
 * Where Stripe sends the buyer afterwards. Success lands on /thanks, which
 * claims the session and shows keys and downloads with no sign-in; cancel
 * returns to the page they left. `paid` rides along for the Purchase pixel.
 * `{CHECKOUT_SESSION_ID}` is a literal Stripe fills in.
 */
export function checkoutUrls(baseUrl: string, product: CompProduct, paid: number, cancelPath: CancelPath) {
  return {
    success_url: `${baseUrl}/thanks?session_id={CHECKOUT_SESSION_ID}&product=${product}&paid=${paid}`,
    cancel_url: `${baseUrl}${cancelPath}?purchase=canceled`,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx --test lib/plugin-checkout-logic.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Write `lib/plugin-checkout.ts`**

```ts
import { cookies } from "next/headers"
import type Stripe from "stripe"
import { prisma } from "@/lib/db"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"
import { readAttributionMetadata } from "@/lib/attribution-snapshot"
import type { CompProduct } from "@/lib/plugin-products"
import { checkoutUrls, type CancelPath } from "@/lib/plugin-checkout-logic"

// Shared by the shft, drft and bundle checkout routes. Each route still picks
// its own price and runs its own ownership guards; this is the part that was
// copied three times.

export type CheckoutBuyer = { id: string; email: string | null }

export function checkoutBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  )
}

/** A valid, currently-active ?ref= code from the shft_ref cookie, or null.
 *  The webhook re-validates it; this just keeps junk out of the metadata. */
export async function readAffiliateCodeFromCookie(label: string): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const raw = normalizeAffiliateCode(cookieStore.get("shft_ref")?.value)
    if (!raw) return null
    const affiliate = await prisma.affiliate.findUnique({ where: { code: raw } })
    return affiliate?.active ? raw : null
  } catch (e) {
    console.error(`[${label}] affiliate cookie read failed`, e)
    return null
  }
}

/**
 * One-time Checkout Session for a plugin or the bundle.
 *
 * `buyer` is null for a guest. A signed-in buyer's id is stamped as
 * client_reference_id and metadata.userId and their email prefilled; a guest
 * gets neither, types their email into Checkout, and that address is the
 * only identity the webhook has to attach the purchase to. metadata.guest
 * marks those sessions in the Stripe dashboard.
 */
export async function createPluginCheckoutSession(
  stripe: Stripe,
  opts: {
    product: CompProduct
    priceId: string
    paid: number
    cancelPath: CancelPath
    buyer: CheckoutBuyer | null
    affiliateCode: string | null
  },
): Promise<Stripe.Checkout.Session> {
  const attrMetadata = await readAttributionMetadata()
  const { buyer } = opts
  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: opts.priceId, quantity: 1 }],
    ...checkoutUrls(checkoutBaseUrl(), opts.product, opts.paid, opts.cancelPath),
    customer_creation: "always",
    ...(buyer?.email ? { customer_email: buyer.email } : {}),
    billing_address_collection: "auto",
    allow_promotion_codes: true,
    ...(buyer ? { client_reference_id: buyer.id } : {}),
    metadata: {
      product: opts.product,
      ...(buyer ? { userId: buyer.id } : { guest: "1" }),
      ...(opts.affiliateCode ? { affiliateCode: opts.affiliateCode } : {}),
      ...attrMetadata,
    },
    custom_fields: [
      {
        key: "creator_code",
        label: { type: "custom", custom: "Creator code (optional)" },
        type: "text",
        optional: true,
      },
    ],
  })
}
```

- [ ] **Step 6: Rewrite `app/api/shft/checkout/route.ts`**

```ts
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PRICING } from "@/lib/products"
import { createPluginCheckoutSession, readAffiliateCodeFromCookie, type CheckoutBuyer } from "@/lib/plugin-checkout"

// One-time checkout for the shft plugin. Signing in is optional: a guest pays
// the full price (ownership, and so the crossgrade, can only be checked
// against an account) and the webhook attaches the purchase to whatever email
// they give Stripe - creating the account if there isn't one.
// Dormant until BOTH env vars are set:
//   STRIPE_SECRET_KEY      — already used by the subscription checkout
//   STRIPE_SHFT_PRICE_ID   — the one-time price for shft
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_SHFT_PRICE_ID
  if (!secret || !priceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const session = await auth()
  const buyer: CheckoutBuyer | null = session?.user?.id
    ? { id: session.user.id, email: session.user.email ?? null }
    : null

  let chosenPriceId = priceId
  let paid: number = PRICING.shft.price
  if (buyer) {
    // Already own it? Don't let them pay twice — send them to their downloads.
    const existing = await prisma.purchase.findUnique({
      where: { userId_product: { userId: buyer.id, product: "shft" } },
    })
    if (existing) {
      return NextResponse.json({ error: "already_owned" }, { status: 409 })
    }
    // Crossgrade: owning drft earns the $15 complete-the-pair price. Ownership
    // is checked server-side here — nothing client-controlled picks the price.
    const ownsDrft = Boolean(
      await prisma.purchase.findUnique({
        where: { userId_product: { userId: buyer.id, product: "drft" } },
      })
    )
    const crossgradeId = process.env.STRIPE_SHFT_CROSSGRADE_PRICE_ID
    if (ownsDrft && crossgradeId) {
      chosenPriceId = crossgradeId
      paid = PRICING.crossgrade.price
    }
  }

  const affiliateCode = await readAffiliateCodeFromCookie("shft checkout")

  try {
    const checkout = await createPluginCheckoutSession(new Stripe(secret), {
      product: "shft",
      priceId: chosenPriceId,
      paid,
      cancelPath: "/shft",
      buyer,
      affiliateCode,
    })
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    console.error("[shft checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
```

- [ ] **Step 7: Rewrite `app/api/drft/checkout/route.ts`**

```ts
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PRICING } from "@/lib/products"
import { createPluginCheckoutSession, readAffiliateCodeFromCookie, type CheckoutBuyer } from "@/lib/plugin-checkout"

// One-time checkout for the drft plugin. Signing in is optional: a guest pays
// the full price (ownership, and so the crossgrade, can only be checked
// against an account) and the webhook attaches the purchase to whatever email
// they give Stripe - creating the account if there isn't one.
// Dormant until BOTH env vars are set:
//   STRIPE_SECRET_KEY     — already used by the subscription checkout
//   STRIPE_DRFT_PRICE_ID  — the one-time price for drft
// Crossgrade: a signed-in user who already owns shft checks out against
// STRIPE_DRFT_CROSSGRADE_PRICE_ID ($15) instead, falling back to the full
// price ID if the crossgrade one isn't configured yet.
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const fullPriceId = process.env.STRIPE_DRFT_PRICE_ID
  if (!secret || !fullPriceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const session = await auth()
  const buyer: CheckoutBuyer | null = session?.user?.id
    ? { id: session.user.id, email: session.user.email ?? null }
    : null

  let priceId = fullPriceId
  let paid: number = PRICING.drft.price
  if (buyer) {
    // Already own it? Don't let them pay twice — send them to their downloads.
    const existing = await prisma.purchase.findUnique({
      where: { userId_product: { userId: buyer.id, product: "drft" } },
    })
    if (existing) {
      return NextResponse.json({ error: "already_owned" }, { status: 409 })
    }
    // Crossgrade: owning shft earns the $15 complete-the-pair price. Ownership
    // is checked server-side here — nothing client-controlled picks the price.
    const ownsShft = Boolean(
      await prisma.purchase.findUnique({
        where: { userId_product: { userId: buyer.id, product: "shft" } },
      })
    )
    const crossgradeId = process.env.STRIPE_DRFT_CROSSGRADE_PRICE_ID
    if (ownsShft && crossgradeId) {
      priceId = crossgradeId
      paid = PRICING.crossgrade.price
    }
  }

  const affiliateCode = await readAffiliateCodeFromCookie("drft checkout")

  try {
    const checkout = await createPluginCheckoutSession(new Stripe(secret), {
      product: "drft",
      priceId,
      paid,
      cancelPath: "/drft",
      buyer,
      affiliateCode,
    })
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    console.error("[drft checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
```

- [ ] **Step 8: Rewrite `app/api/bundle/checkout/route.ts`**

```ts
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PRICING } from "@/lib/products"
import { createPluginCheckoutSession, readAffiliateCodeFromCookie, type CheckoutBuyer } from "@/lib/plugin-checkout"

// One-time checkout for the shft + drft bundle. One Stripe price, one line
// item; the webhook (and /api/plugins/claim) grant BOTH products.
// Signing in is optional. For a signed-in buyer the guard rails hold: owners
// of both get 409 already_owned; owners of one get 409 own_one — the
// storefront swaps to the $15 crossgrade offer instead, so no path through
// here can double-charge. A guest has no ownership to check and pays the
// bundle price.
// Dormant until STRIPE_SECRET_KEY + STRIPE_BUNDLE_PRICE_ID are set.
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_BUNDLE_PRICE_ID
  if (!secret || !priceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const session = await auth()
  const buyer: CheckoutBuyer | null = session?.user?.id
    ? { id: session.user.id, email: session.user.email ?? null }
    : null

  if (buyer) {
    const owned = await prisma.purchase.findMany({
      where: { userId: buyer.id, product: { in: ["shft", "drft"] } },
      select: { product: true },
    })
    const ownedSet = new Set(owned.map((p) => p.product))
    if (ownedSet.size === 2) {
      return NextResponse.json({ error: "already_owned" }, { status: 409 })
    }
    if (ownedSet.size === 1) {
      return NextResponse.json({ error: "own_one", owns: [...ownedSet][0] }, { status: 409 })
    }
  }

  const affiliateCode = await readAffiliateCodeFromCookie("bundle checkout")

  try {
    const checkout = await createPluginCheckoutSession(new Stripe(secret), {
      product: "bundle",
      priceId,
      paid: PRICING.bundle.price,
      cancelPath: "/plugins",
      buyer,
      affiliateCode,
    })
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    console.error("[bundle checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
```

- [ ] **Step 9: Typecheck, lint, tests**

Run: `npx tsc --noEmit && npx eslint lib/plugin-checkout.ts app/api/shft/checkout/route.ts app/api/drft/checkout/route.ts app/api/bundle/checkout/route.ts && npx tsx --test lib/*.test.ts`
Expected: all clean, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add lib/plugin-checkout-logic.ts lib/plugin-checkout-logic.test.ts lib/plugin-checkout.ts app/api/shft/checkout/route.ts app/api/drft/checkout/route.ts app/api/bundle/checkout/route.ts
git commit -m "feat: plugin checkout no longer requires a session

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: One claim route

**Files:**
- Create: `app/api/plugins/claim/route.ts`
- Delete: `app/api/shft/claim/route.ts`, `app/api/drft/claim/route.ts`, `app/api/bundle/claim/route.ts`

**Interfaces:**
- Consumes: `grantPluginPurchase` (Task 3), `mintSetPasswordUrl` (Task 2), `buyerLookupFor` and `downloadsFor` (Task 3), `isCompProduct`.
- Produces: `POST /api/plugins/claim { sessionId }` returning

```ts
type ClaimResponse = {
  ok: true
  product: "shft" | "drft" | "bundle"
  email: string
  signedIn: boolean
  needsPassword: boolean
  setPasswordUrl: string | null
  duplicates: string[]
  items: { product: "shft" | "drft"; licenseKey: string; downloads: { id: string; label: string; href: string }[] }[]
}
```

- [ ] **Step 1: Write the route**

Create `app/api/plugins/claim/route.ts`:

```ts
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
```

- [ ] **Step 2: Delete the old claim routes**

```bash
git rm app/api/shft/claim/route.ts app/api/drft/claim/route.ts app/api/bundle/claim/route.ts
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (The storefront pages still reference the old routes as strings inside `fetch(...)`; strings do not typecheck, and Task 12 replaces them.)

- [ ] **Step 4: Commit**

```bash
git add app/api/plugins/claim/route.ts
git commit -m "feat: one claim route for every plugin purchase, guest or signed in

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: The `/thanks` page

**Files:**
- Create: `app/thanks/page.tsx`, `app/thanks/ThanksPage.tsx`

**Interfaces:**
- Consumes: `POST /api/plugins/claim` (Task 8) and its `ClaimResponse` shape, `trackMeta` from `lib/meta-pixel.ts`, `PRICING` from `lib/products.ts`, `WindowsInstallNote`, `SiteNav`.
- Produces: `/thanks?session_id=...&product=...&paid=...`, the success URL every checkout now points to.

- [ ] **Step 1: Write the server page**

Create `app/thanks/page.tsx`:

```tsx
import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import ThanksPage from "./ThanksPage"

export const metadata: Metadata = {
  title: "Thanks | Sample Roll",
  robots: { index: false, follow: false },
}

// Stripe's success URL. The client component reads the session id from the
// query string, claims it, and shows the keys - no sign-in needed.
export default function Page() {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-2xl mx-auto px-3 sm:px-4 mt-[56px] pb-16 pt-8">
        <ThanksPage />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Write the client component**

Create `app/thanks/ThanksPage.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import WindowsInstallNote from "@/components/WindowsInstallNote"
import { trackMeta } from "@/lib/meta-pixel"
import { PRICING } from "@/lib/products"

type Download = { id: string; label: string; href: string }
type Item = { product: "shft" | "drft"; licenseKey: string; downloads: Download[] }
type Claim = {
  ok: true
  product: "shft" | "drft" | "bundle"
  email: string
  signedIn: boolean
  /** The account predates this checkout and the viewer is not signed in as
   *  its owner: keys and the set-password link were not returned. */
  withheld: boolean
  needsPassword: boolean
  setPasswordUrl: string | null
  duplicates: string[]
  items: Item[]
}

type State =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; claim: Claim }

const muted = { color: "var(--foreground)", opacity: 0.75 } as const
const card = { borderColor: "var(--border)" } as const
const primaryBtn =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold no-underline"
const primaryBtnStyle = { background: "var(--primary)", color: "var(--primary-foreground, #fff)" } as const
const ghostBtn = "inline-flex items-center rounded-lg px-3 py-2 text-[13px] font-medium border"
const ghostBtnStyle = { borderColor: "var(--border)", color: "var(--foreground)" } as const

function fallbackPaid(product: string): number {
  if (product === "bundle") return PRICING.bundle.price
  if (product === "drft") return PRICING.drft.price
  return PRICING.shft.price
}

function KeyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <code
        className="text-[15px] tracking-wider rounded-lg px-3 py-2 border"
        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
      >
        {value}
      </code>
      <button type="button" onClick={copy} className={ghostBtn} style={ghostBtnStyle}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

function ItemCard({ item }: { item: Item }) {
  return (
    <section className="rounded-xl border p-5 sm:p-6" style={card}>
      <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--foreground)" }}>
        {item.product}
      </h2>
      <p className="text-[13px] font-medium mb-2" style={{ color: "var(--foreground)", opacity: 0.7 }}>
        Licence key
      </p>
      <KeyRow value={item.licenseKey} />
      <p className="text-[14px] mt-3 mb-4" style={muted}>
        Paste it into {item.product} the first time you open it. One key covers 3 machines.
      </p>
      <div className="flex flex-wrap gap-3">
        {item.downloads.map((d) => (
          <a key={d.id} href={d.href} className={primaryBtn} style={primaryBtnStyle}>
            ↓ {d.label}
          </a>
        ))}
      </div>
      {item.downloads.some((d) => d.id === "installer-win") && <WindowsInstallNote />}
    </section>
  )
}

function AccountBlock({ claim }: { claim: Claim }) {
  if (claim.needsPassword && claim.setPasswordUrl) {
    return (
      <section className="rounded-xl border p-5 sm:p-6" style={card}>
        <p className="text-[15px] mb-3" style={{ color: "var(--foreground)" }}>
          Your purchase is saved to <strong>{claim.email}</strong>. Set a password to see it on
          My Products, manage your machines, and re-download any time.
        </p>
        <a href={claim.setPasswordUrl} className={primaryBtn} style={primaryBtnStyle}>
          Set a password
        </a>
      </section>
    )
  }
  if (claim.signedIn) {
    return (
      <section className="rounded-xl border p-5 sm:p-6" style={card}>
        <p className="text-[15px] mb-3" style={{ color: "var(--foreground)" }}>
          This is saved to your account. Downloads, keys and machine management live in My Products.
        </p>
        <Link href="/products" className={primaryBtn} style={primaryBtnStyle}>
          Go to My Products
        </Link>
      </section>
    )
  }
  return (
    <section className="rounded-xl border p-5 sm:p-6" style={card}>
      <p className="text-[15px] mb-3" style={{ color: "var(--foreground)" }}>
        Sign in with <strong>{claim.email}</strong> to see this on My Products.
      </p>
      <Link href="/login?callbackUrl=%2Fproducts" className={primaryBtn} style={primaryBtnStyle}>
        Sign in
      </Link>
      <p className="text-[13px] mt-3" style={muted}>
        Forgot your password?{" "}
        <Link href="/forgot-password" className="underline">
          Reset it
        </Link>
        .
      </p>
    </section>
  )
}

export default function ThanksPage() {
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get("session_id")
    if (!sessionId) {
      setState({ kind: "empty" })
      return
    }

    // Meta Pixel: one Purchase per session, even if the page is reloaded.
    const product = params.get("product") ?? "shft"
    const paid = Number(params.get("paid")) || fallbackPaid(product)
    const pixelKey = `purchase-pixel:${sessionId}`
    try {
      if (!sessionStorage.getItem(pixelKey)) {
        trackMeta("Purchase", { value: paid, currency: "USD", content_name: product, content_type: "product" })
        sessionStorage.setItem(pixelKey, "1")
      }
    } catch {
      trackMeta("Purchase", { value: paid, currency: "USD", content_name: product, content_type: "product" })
    }

    fetch("/api/plugins/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (r) => (r.ok ? ((await r.json()) as Claim) : null))
      .then((claim) => setState(claim ? { kind: "ready", claim } : { kind: "error" }))
      .catch(() => setState({ kind: "error" }))
  }, [])

  if (state.kind === "empty") {
    return (
      <>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Nothing to claim here
        </h1>
        <p className="text-[15px]" style={muted}>
          Looking for your downloads?{" "}
          <Link href="/products" className="underline">My Products</Link> has them, or{" "}
          <Link href="/plugins" className="underline">browse the plugins</Link>.
        </p>
      </>
    )
  }

  if (state.kind === "loading") {
    return (
      <>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Confirming your purchase…
        </h1>
        <p className="text-[15px]" style={muted}>One moment.</p>
      </>
    )
  }

  if (state.kind === "error") {
    return (
      <>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          We couldn&apos;t confirm that purchase
        </h1>
        <p className="text-[15px] mb-4" style={muted}>
          If you were charged, your licence key is on its way by email. Not there?{" "}
          <Link href="/lost-key" className="underline">Resend it</Link>, or reply to your receipt and
          we&apos;ll sort you out.
        </p>
      </>
    )
  }

  const { claim } = state

  if (claim.withheld) {
    return (
      <>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Thanks - you&apos;re all set
        </h1>
        <p className="text-[15px] mb-4" style={muted}>
          This purchase has been added to the account for <strong>{claim.email}</strong>. Your
          licence key and download links are in the receipt we&apos;ve just sent there - check
          spam if it isn&apos;t in your inbox, or{" "}
          <Link href="/lost-key" className="underline">resend it</Link>.
        </p>
        <p className="text-[15px] mb-6" style={muted}>
          Sign in with that email to see everything on My Products.
        </p>
        <Link href="/login?callbackUrl=%2Fproducts" className={primaryBtn} style={primaryBtnStyle}>
          Sign in
        </Link>
      </>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
        You&apos;re in
      </h1>
      <p className="text-[15px] mb-8" style={muted}>
        Here&apos;s everything you need. We&apos;ve also sent it to <strong>{claim.email}</strong> -
        check spam if it isn&apos;t there, or{" "}
        <Link href="/lost-key" className="underline">resend it</Link>.
      </p>

      {claim.duplicates.length > 0 && (
        <div
          className="rounded-xl border p-4 mb-5 text-[14px]"
          style={{ borderColor: "#fde68a", background: "#fef9c3", color: "#854d0e" }}
        >
          It looks like {claim.email} already owned {claim.duplicates.join(" and ")}. The duplicate
          charge will be refunded - reply to your receipt if it hasn&apos;t landed in a few days.
        </div>
      )}

      <div className="space-y-5">
        {claim.items.map((item) => (
          <ItemCard key={item.product} item={item} />
        ))}
        <AccountBlock claim={claim} />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint app/thanks`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/thanks/page.tsx app/thanks/ThanksPage.tsx
git commit -m "feat: /thanks shows keys and downloads straight after checkout

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Lost-key page and resend route

**Files:**
- Create: `lib/resend-rate-limit.ts`, `lib/resend-rate-limit.test.ts`
- Create: `app/api/plugins/resend-key/route.ts`
- Create: `app/lost-key/page.tsx`, `components/LostKeyForm.tsx`

**Interfaces:**
- Produces: `class SlidingWindowLimiter { constructor(limit: number, windowMs: number, now?: () => number); allow(key: string): boolean }`.
- Produces: `POST /api/plugins/resend-key { email }` → 200 `{ ok: true }`, 400 on a malformed email, 429 when rate-limited.
- Consumes: `sendPluginPurchaseEmail` with opts (Task 5), `mintSetPasswordUrl` (Task 2), `isPluginProduct` from `lib/plugin-products.ts`.

- [ ] **Step 1: Write the failing limiter tests**

Create `lib/resend-rate-limit.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { SlidingWindowLimiter } from "./resend-rate-limit"

function clock(start = 0) {
  let t = start
  return { now: () => t, tick: (ms: number) => { t += ms } }
}

test("allows up to the limit, then refuses", () => {
  const c = clock()
  const l = new SlidingWindowLimiter(3, 1000, c.now)
  assert.equal(l.allow("a@b.c"), true)
  assert.equal(l.allow("a@b.c"), true)
  assert.equal(l.allow("a@b.c"), true)
  assert.equal(l.allow("a@b.c"), false)
})

test("a refused hit does not extend the window", () => {
  const c = clock()
  const l = new SlidingWindowLimiter(1, 1000, c.now)
  assert.equal(l.allow("k"), true)
  c.tick(900)
  assert.equal(l.allow("k"), false)
  c.tick(150) // 1050ms after the only counted hit
  assert.equal(l.allow("k"), true)
})

test("frees a slot once the oldest hit leaves the window", () => {
  const c = clock()
  const l = new SlidingWindowLimiter(2, 1000, c.now)
  l.allow("k")
  c.tick(500)
  l.allow("k")
  assert.equal(l.allow("k"), false)
  c.tick(501) // first hit is now 1001ms old
  assert.equal(l.allow("k"), true)
})

test("keys are independent", () => {
  const l = new SlidingWindowLimiter(1, 1000, () => 0)
  assert.equal(l.allow("one"), true)
  assert.equal(l.allow("two"), true)
  assert.equal(l.allow("one"), false)
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx tsx --test lib/resend-rate-limit.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the limiter**

Create `lib/resend-rate-limit.ts`:

```ts
/**
 * Sliding-window hit counter keyed by an arbitrary string (an email, an IP).
 *
 * In-memory and per-instance on purpose: the resend endpoint is cheap to
 * serve and low-value to abuse, so best-effort limiting is enough and a
 * shared store would be more machinery than the problem deserves. A refused
 * hit is not recorded, so hammering does not push the window out.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit and reports whether it was within the limit. */
  allow(key: string): boolean {
    const t = this.now()
    const recent = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs)
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(t)
    this.hits.set(key, recent)
    return true
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsx --test lib/resend-rate-limit.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Write the resend route**

Create `app/api/plugins/resend-key/route.ts`:

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendPluginPurchaseEmail } from "@/lib/email"
import { isPluginProduct } from "@/lib/plugin-products"
import { SlidingWindowLimiter } from "@/lib/resend-rate-limit"
import { mintSetPasswordUrl } from "@/lib/set-password"

// Re-sends the purchase receipt (keys, download links, how to get onto the
// account) to an address. No sign-in - this is the fallback for a buyer whose
// receipt went to spam and who never set a password.
//
// The response is the same whether or not the address is known, so it cannot
// be used to enumerate accounts. Limited per address and per client IP.
const HOUR = 60 * 60 * 1000
const perEmail = new SlidingWindowLimiter(3, HOUR)
const perIp = new SlidingWindowLimiter(10, HOUR)

export async function POST(request: Request) {
  let body: { email?: unknown }
  try {
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Enter the email you bought with." }, { status: 400 })
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (!perIp.allow(ip) || !perEmail.allow(email)) {
    return NextResponse.json({ error: "Too many requests. Try again in an hour." }, { status: 429 })
  }

  const ok = NextResponse.json({ ok: true })
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        email: true,
        passwordSetAt: true,
        purchases: { select: { product: true, licenseKey: true } },
      },
    })
    if (!user) return ok

    const items = user.purchases
      .filter((p): p is { product: "shft" | "drft"; licenseKey: string | null } => isPluginProduct(p.product))
      .map((p) => ({ product: p.product, licenseKey: p.licenseKey }))
    if (items.length === 0) return ok

    const setPasswordUrl = user.passwordSetAt === null ? await mintSetPasswordUrl(user.id) : null
    await sendPluginPurchaseEmail(user.email, items, { setPasswordUrl })
  } catch (e) {
    console.error("[resend key]", e)
  }
  return ok
}
```

- [ ] **Step 6: Write the form**

Create `components/LostKeyForm.tsx`:

```tsx
"use client"

import { useState } from "react"

const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none w-full"
const btnCls =
  "rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer mt-3"
const fieldStyle = {
  borderColor: "var(--border)",
  color: "var(--foreground)",
  background: "rgba(255, 255, 255, 0.45)",
}
const primaryBtnStyle = { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }

export default function LostKeyForm() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/plugins/resend-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.")
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
        If we have a purchase for that address, the receipt is on its way. Check spam if it
        doesn&apos;t show up in a few minutes.
      </p>
    )
  }

  return (
    <div>
      <input
        className={inputCls}
        style={fieldStyle}
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy && email.trim()) submit()
        }}
      />
      {error ? (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <button className={btnCls} style={primaryBtnStyle} disabled={busy || !email.trim()} onClick={submit}>
        {busy ? "Sending..." : "Resend my receipt"}
      </button>
    </div>
  )
}
```

- [ ] **Step 7: Write the page**

Create `app/lost-key/page.tsx`:

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import LostKeyForm from "@/components/LostKeyForm"

export const metadata: Metadata = {
  title: "Find your licence key | Sample Roll",
  robots: { index: false, follow: false },
}

export default function LostKeyPage() {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-md mx-auto px-3 sm:px-4 mt-[56px] pb-16 pt-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Find your licence key
        </h1>
        <p className="text-[15px] mb-8" style={{ color: "var(--foreground)", opacity: 0.75 }}>
          Enter the email you bought with and we&apos;ll resend your receipt - keys, download
          links, and how to get into My Products.
        </p>
        <LostKeyForm />
        <p className="text-[13px] mt-8" style={{ color: "var(--foreground)", opacity: 0.6 }}>
          Already have a password?{" "}
          <Link href="/login?callbackUrl=%2Fproducts" className="underline">
            Sign in
          </Link>{" "}
          to see everything on My Products.
        </p>
      </main>
    </div>
  )
}
```

- [ ] **Step 8: Typecheck, lint, tests**

Run: `npx tsc --noEmit && npx eslint lib/resend-rate-limit.ts app/api/plugins/resend-key/route.ts app/lost-key components/LostKeyForm.tsx && npx tsx --test lib/*.test.ts`
Expected: clean; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add lib/resend-rate-limit.ts lib/resend-rate-limit.test.ts app/api/plugins/resend-key/route.ts app/lost-key/page.tsx components/LostKeyForm.tsx
git commit -m "feat: lost-key page resends the receipt without a sign-in

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Login, register, and reset pages know about purchase-created accounts

**Files:**
- Modify: `app/api/auth/check-unverified/route.ts`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/register/page.tsx`
- Modify: `app/(auth)/reset-password/page.tsx`

**Interfaces:**
- Produces: `POST /api/auth/check-unverified` → `{ unverified: boolean; needsPassword: boolean }`.
- Consumes: `?welcome=1` on `/reset-password`, as minted by `setPasswordPath` (Task 3).

- [ ] **Step 1: Extend check-unverified**

Replace the body of the `try` block in `app/api/auth/check-unverified/route.ts` with:

```ts
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ unverified: false, needsPassword: false })
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: String(email).trim().toLowerCase(), mode: "insensitive" } },
    })

    if (!user) return NextResponse.json({ unverified: false, needsPassword: false })

    // An account created by a guest plugin purchase has a random password
    // nobody knows, so "does the password match" can never be the gate here.
    // Revealing that such an account exists is the same thing the register
    // route already reveals with its 409.
    if (user.passwordSetAt === null) {
      return NextResponse.json({ unverified: false, needsPassword: true })
    }

    const isPasswordValid = await bcrypt.compare(String(password), user.passwordHash)
    if (!isPasswordValid) return NextResponse.json({ unverified: false, needsPassword: false })

    return NextResponse.json({ unverified: !user.emailVerified, needsPassword: false })
```

and change the `catch` to return `{ unverified: false, needsPassword: false }`.

- [ ] **Step 2: Login page: the needs-password message and the lost-key link**

In `app/(auth)/login/page.tsx`:

Add state after the existing `useState` lines:

```ts
  const [needsPassword, setNeedsPassword] = useState(false)
```

Reset it at the top of the handler, beside the existing `setError("")`, so no
error path can leave a stale link behind:

```ts
    e.preventDefault()
    setError("")
    setNeedsPassword(false)
    setLoading(true)
```

Replace the block that begins `if (result?.error) {` and ends before `} else {` with:

```ts
      if (result?.error) {
        const check = await fetch("/api/auth/check-unverified", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }).then((r) => r.json()).catch(() => ({ unverified: false, needsPassword: false }))

        if (check.needsPassword) {
          setNeedsPassword(true)
          // The link rendered after this sentence reads "Set a password", so
          // the message must not end with that phrase itself.
          setError("This account was created when you bought a plugin.")
        } else if (check.unverified) {
          setError("Please verify your email before logging in. Check your inbox — and your spam folder if you don't see it.")
        } else {
          setError("Invalid email or password")
        }
      } else {
```

Replace the error box inside the form with:

```tsx
          {error && (
            <div className="p-3 rounded-xl text-sm border" style={{ background: "rgba(185,28,28,0.08)", borderColor: "rgba(185,28,28,0.3)", color: "#b91c1c" }}>
              {error}
              {needsPassword && (
                <>
                  {" "}
                  <Link href="/forgot-password" className="font-medium underline">Set a password</Link>
                </>
              )}
            </div>
          )}
```

After the existing "Don't have an account?" paragraph, add:

```tsx
        <p className="mt-2 text-center text-sm" style={{ color: "var(--muted)" }}>
          Bought a plugin?{" "}
          <Link href="/lost-key" className="font-medium hover:underline" style={{ color: "var(--foreground)" }}>Find your key</Link>
        </p>
```

- [ ] **Step 3: Register page: a 409 offers sign-in and reset**

In `app/(auth)/register/page.tsx`:

Add state:

```ts
  const [exists, setExists] = useState(false)
```

In `handleSubmit`, replace

```ts
      if (!response.ok) {
        setError(data.error || "Registration failed")
        return
      }
```

with

```ts
      if (!response.ok) {
        setError(data.error || "Registration failed")
        setExists(response.status === 409)
        return
      }
```

and add `setExists(false)` as the first statement after `e.preventDefault()`,
BEFORE the `!agreeToTerms` guard — that guard returns early, so a reset placed
after it leaves the 409 links showing beside an unrelated message:

```ts
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setExists(false)
    if (!agreeToTerms) {
```

Replace the error box with:

```tsx
          {error && (
            <div className="p-3 rounded-xl text-sm border" style={{ background: "rgba(185,28,28,0.08)", borderColor: "rgba(185,28,28,0.3)", color: "#b91c1c" }}>
              {error}
              {exists && (
                <>
                  {" "}
                  <Link href="/login" className="font-medium underline">Sign in</Link>
                  {" or "}
                  <Link href="/forgot-password" className="font-medium underline">reset your password</Link>.
                </>
              )}
            </div>
          )}
```

- [ ] **Step 4: Reset page: the welcome variant**

In `app/(auth)/reset-password/page.tsx`:

After `const token = searchParams.get("token")` add:

```ts
  // Set from a purchase receipt or the thanks page: the account was created
  // by a guest checkout and this is the buyer's first password, not a reset.
  const welcome = searchParams.get("welcome") === "1"
```

Replace `router.push("/login?reset=true")` with:

```ts
      router.push(welcome ? "/login?reset=true&callbackUrl=%2Fproducts" : "/login?reset=true")
```

Replace the `<h2 ...>Reset Password</h2>` line with:

```tsx
        <h2 className={`text-lg font-medium text-center ${welcome ? "mb-2" : "mb-6"}`} style={{ color: "var(--muted)" }}>
          {welcome ? "Set your password" : "Reset Password"}
        </h2>
        {welcome && (
          <p className="text-sm text-center mb-6" style={{ color: "var(--muted)" }}>
            Your account was created when you bought a plugin. Choose a password to sign in and
            see your downloads on My Products.
          </p>
        )}
```

Replace the submit button label `{loading ? "Updating…" : "Set new password"}` with `{loading ? (welcome ? "Saving…" : "Updating…") : welcome ? "Set password" : "Set new password"}` — the loading text has to branch on `welcome` too, or the ordinary reset flow silently changes from "Updating…" to "Saving…".

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint "app/(auth)/login/page.tsx" "app/(auth)/register/page.tsx" "app/(auth)/reset-password/page.tsx" app/api/auth/check-unverified/route.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/check-unverified/route.ts "app/(auth)/login/page.tsx" "app/(auth)/register/page.tsx" "app/(auth)/reset-password/page.tsx"
git commit -m "feat: auth pages guide purchase-created accounts to set a password

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Storefront: no login wall, guest nudge, InitiateCheckout

**Files:**
- Modify: `lib/meta-pixel.ts:13`
- Modify: `app/api/shft/ownership/route.ts`, `app/api/drft/ownership/route.ts`
- Modify: `app/shft/ShftLanding.tsx` (`startCheckout`, `BuyButton`, `PurchaseBanner`, the ownership effect, the get-started section)
- Modify: `app/drft/DrftLanding.tsx` (same parts)
- Modify: `app/plugins/PluginsStore.tsx` (`startCheckout`, `BuyBtn`, `PurchaseBanner`, ownership effect, bundle section)

**Interfaces:**
- Produces: ownership routes return `{ owned, crossgrade, signedIn }`.
- Consumes: `PRICING`, `trackMeta` (now accepting `"InitiateCheckout"`).

- [ ] **Step 1: Allow the InitiateCheckout event**

In `lib/meta-pixel.ts` change the event union to:

```ts
export type MetaStandardEvent = "PageView" | "Purchase" | "Subscribe" | "Lead" | "InitiateCheckout"
```

- [ ] **Step 2: Ownership routes report `signedIn`**

`app/api/shft/ownership/route.ts`, replace the two `NextResponse.json` calls:

```ts
  if (!session?.user?.id) {
    return NextResponse.json({ owned: false, crossgrade, signedIn: false })
  }
  const purchase = await prisma.purchase.findUnique({
    where: { userId_product: { userId: session.user.id, product: "shft" } },
  })
  return NextResponse.json({ owned: Boolean(purchase), crossgrade, signedIn: true })
```

Same edit in `app/api/drft/ownership/route.ts` with `product: "drft"`.

- [ ] **Step 3: shft landing**

In `app/shft/ShftLanding.tsx`:

Replace `startCheckout` with:

```ts
async function startCheckout(): Promise<{ url: string | null; alreadyOwned: boolean }> {
  try {
    const res = await fetch("/api/shft/checkout", { method: "POST" })
    if (res.status === 409) return { url: null, alreadyOwned: true }
    const data = await res.json().catch(() => ({}))
    if (res.ok && typeof data?.url === "string") return { url: data.url, alreadyOwned: false }
  } catch {
    /* fall through */
  }
  return { url: null, alreadyOwned: false }
}
```

In `BuyButton`, update the doc comment and the `buy` handler:

```ts
/** Buy Now button — shows the struck price inline. Kicks off Stripe checkout
    for anyone, signed in or not; sends owners to their downloads, and falls
    back to "Opens at launch" until STRIPE_SHFT_PRICE_ID is configured. */
```

```ts
  const buy = async () => {
    setBusy(true)
    setFailed(false)
    // Funnel top: paired with the Purchase event on /thanks.
    trackMeta("InitiateCheckout", {
      value: crossgrade ? PRICING.crossgrade.price : PRICING.shft.price,
      currency: "USD",
      content_name: "shft",
      content_type: "product",
    })
    const { url, alreadyOwned } = await startCheckout()
    if (alreadyOwned) {
      window.location.href = "/products"
      return
    }
    if (url) {
      window.location.href = url
      return
    }
    setFailed(true)
    setBusy(false)
  }
```

Replace the whole `PurchaseBanner` function with:

```tsx
/** Only the canceled state lives here now. Success goes to /thanks, which
    claims the session and shows the key - see app/thanks. */
function PurchaseBanner() {
  const [canceled, setCanceled] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("purchase") === "canceled") setCanceled(true)
  }, [])

  if (!canceled) return null
  return <div className={styles.bannerInfo}>Checkout canceled — no charge was made. Grab shft whenever you&apos;re ready.</div>
}
```

In `ShftLanding`, add state and read it from the ownership response:

```ts
  const [signedIn, setSignedIn] = useState(true)
```

(default `true` so the nudge never flashes for signed-in visitors before the fetch lands), and inside the `/api/shft/ownership` `.then((d) => { ... })` add `setSignedIn(Boolean(d?.signedIn))`.

In the get-started section, after the `<div className={styles.gsForm}>…</div>` block and before `</section>`, add:

```tsx
        {!signedIn && shftCrossgrade && (
          <p className={styles.gsSub}>
            Own drft? <a href="/login?callbackUrl=%2Fshft">Sign in</a> for the ${PRICING.crossgrade.price} crossgrade.
          </p>
        )}
```

- [ ] **Step 4: drft landing**

In `app/drft/DrftLanding.tsx` make the mirror-image edits:

`startCheckout` identical to Step 3 but fetching `/api/drft/checkout`.

`BuyButton.buy`: same shape, with

```ts
    trackMeta("InitiateCheckout", {
      value: crossgrade ? PRICING.crossgrade.price : PRICING.drft.price,
      currency: "USD",
      content_name: "drft",
      content_type: "product",
    })
```

and no `needsAuth` branch. Update its doc comment to drop "sends logged-out users to sign in first".

`PurchaseBanner`: canceled-only, same as Step 3 with the drft copy `Checkout canceled — no charge was made. Grab drft whenever you&apos;re ready.`

`DrftLanding`: add `const [signedIn, setSignedIn] = useState(true)`, set it from the `/api/drft/ownership` response, and add after the `gsForm` div:

```tsx
        {!signedIn && drftCrossgrade && (
          <p className={styles.gsSub}>
            Own shft? <a href="/login?callbackUrl=%2Fdrft">Sign in</a> for the ${PRICING.crossgrade.price} crossgrade.
          </p>
        )}
```

- [ ] **Step 5: Plugins store**

In `app/plugins/PluginsStore.tsx`:

Replace `startCheckout` with:

```ts
async function startCheckout(endpoint: string): Promise<{ url: string | null; conflict: boolean }> {
  try {
    const res = await fetch(endpoint, { method: "POST" })
    if (res.status === 409) return { url: null, conflict: true }
    const data = await res.json().catch(() => ({}))
    if (res.ok && typeof data?.url === "string") return { url: data.url, conflict: false }
  } catch {
    /* fall through */
  }
  return { url: null, conflict: false }
}
```

`BuyBtn` gains two props for the pixel and loses the auth branch:

```tsx
/** Buy button used for singles and the bundle. On 409 (ownership changed under
    us) it reloads so the page re-renders the right state. */
function BuyBtn({
  endpoint,
  className,
  product,
  value,
  children,
}: {
  endpoint: string
  className: string
  product: "shft" | "drft" | "bundle"
  value: number
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const buy = async () => {
    setBusy(true)
    setFailed(false)
    // Funnel top: paired with the Purchase event on /thanks.
    trackMeta("InitiateCheckout", { value, currency: "USD", content_name: product, content_type: "product" })
    const { url, conflict } = await startCheckout(endpoint)
    if (conflict) {
      window.location.reload()
      return
    }
    if (url) {
      window.location.href = url
      return
    }
    setFailed(true)
    setBusy(false)
  }

  return (
    <button type="button" className={className} onClick={buy} disabled={busy}>
      {busy ? "…" : failed ? "Opens at launch" : children}
    </button>
  )
}
```

Update the four `<BuyBtn ...>` usages to pass `product` and `value`:

- bundle (ownCount 0): `<BuyBtn endpoint="/api/bundle/checkout" className={styles.bundleBuy} product="bundle" value={PRICING.bundle.price}>`
- crossgrade (ownCount 1, crossgrade on): `<BuyBtn endpoint={`/api/${missing}/checkout`} className={styles.bundleBuy} product={missing} value={PRICING.crossgrade.price}>`
- full price (ownCount 1, crossgrade off): `<BuyBtn endpoint={`/api/${missing}/checkout`} className={styles.bundleBuy} product={missing} value={PRICING[missing].price}>`
- the per-card button inside the `PLUGINS.map` loop, which today reads

  ```tsx
                  <BuyBtn endpoint={`/api/${p.id}/checkout`} className={styles.cardBuy}>
  ```

  becomes

  ```tsx
                  <BuyBtn
                    endpoint={`/api/${p.id}/checkout`}
                    className={styles.cardBuy}
                    product={p.id}
                    value={p.id === missing && missingCrossgradeOn ? PRICING.crossgrade.price : PRICING[p.id].price}
                  >
  ```

  (the same price expression its label already renders).

`PurchaseBanner`: canceled-only:

```tsx
/** Only the canceled state lives here now. Success goes to /thanks. */
function PurchaseBanner() {
  const [canceled, setCanceled] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("purchase") === "canceled") setCanceled(true)
  }, [])

  if (!canceled) return null
  return <div className={styles.bannerInfo}>Checkout canceled — no charge was made. The bundle is here whenever you&apos;re ready.</div>
}
```

In `PluginsStore`, add `const [signedIn, setSignedIn] = useState(true)` and inside the per-product ownership `.then((d) => { ... })` add `setSignedIn(Boolean(d?.signedIn))`. In the `ownCount === 0` bundle branch, after the `<BuyBtn ...>Get the bundle…</BuyBtn>`, add:

```tsx
                {!signedIn && (crossgradeAvailable.shft || crossgradeAvailable.drft) && (
                  <p className={styles.bundleSub}>
                    Already own one? <a href="/login?callbackUrl=%2Fplugins">Sign in</a> to complete the
                    pair for ${PRICING.crossgrade.price}.
                  </p>
                )}
```

- [ ] **Step 6: Typecheck, lint, and grep for leftovers**

Run:

```bash
npx tsc --noEmit && npx eslint lib/meta-pixel.ts app/shft/ShftLanding.tsx app/drft/DrftLanding.tsx app/plugins/PluginsStore.tsx app/api/shft/ownership/route.ts app/api/drft/ownership/route.ts
grep -rn "needsAuth\|/api/shft/claim\|/api/drft/claim\|/api/bundle/claim" app components lib
```

Expected: typecheck and lint clean; the grep prints nothing.

- [ ] **Step 7: Commit**

```bash
git add lib/meta-pixel.ts app/api/shft/ownership/route.ts app/api/drft/ownership/route.ts app/shft/ShftLanding.tsx app/drft/DrftLanding.tsx app/plugins/PluginsStore.tsx
git commit -m "feat: storefront buys without a sign-in, nudges owners to the crossgrade

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: End-to-end verification in Stripe test mode

**Files:**
- Scratch only (scripts in the session scratchpad). No repo changes unless a bug is found; fix bugs in the task that owns the file and commit there.

**Interfaces:**
- Consumes: everything above. Local `.env.local` already has `sk_test_` keys and all five price ids; the Stripe CLI is at `/opt/homebrew/bin/stripe`.

- [ ] **Step 1: Start the worktree's dev server on port 3001**

The main checkout's dev server usually owns port 3000, and `NEXTAUTH_URL` in `.env.local` points at it, so the success URL must be overridden. Run in the background from the worktree:

```bash
NEXTAUTH_URL=http://localhost:3001 NEXT_PUBLIC_APP_URL=http://localhost:3001 npx next dev -p 3001 --webpack
```

Wait for "Ready", then `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/thanks` → `200`.

- [ ] **Step 2: Forward webhooks**

In the background:

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

It prints `whsec_...`. If it differs from `STRIPE_WEBHOOK_SECRET` in `.env.local`, restart the dev server from Step 1 with `STRIPE_WEBHOOK_SECRET=<printed value>` added to the environment.

- [ ] **Step 3: Guest purchase through the browser**

Write `<scratchpad>/guest-buy.mjs` (use `createRequire` on the project `package.json` to load Playwright, per the project's Playwright note) that:

1. Opens `http://localhost:3001/shft` in headless Chromium.
2. Clicks the first `button:has-text("Buy Now")` and waits for navigation to `checkout.stripe.com`.
3. Fills the Stripe Checkout form: email `troycarson100+guest<epoch>@gmail.com`, card `4242 4242 4242 4242`, expiry `12/34`, CVC `123`, name `Guest Test`, any required address fields (country US, ZIP `94105`).
4. Clicks the pay button and waits for the URL to start with `http://localhost:3001/thanks?session_id=`.
5. Waits for the text `You're in`, then prints: the page URL, the licence key text inside `code`, every download `href`, and whether a `Set a password` link is present and its href.

Run it: `node <scratchpad>/guest-buy.mjs`.
Expected: prints a `SHFT-XXXX-XXXX-XXXX` key, three download hrefs of the form `/api/products/shft/download?asset=...&key=SHFT-...`, and a `Set a password` link to `/reset-password?token=...&welcome=1`.

If Stripe's hosted form changes its selectors, use `page.getByLabel(...)` / `getByRole(...)` and adjust; the assertion that matters is landing on `/thanks` with a key.

- [ ] **Step 4: Check the database**

```bash
export DATABASE_URL="$(node -e 'require("dotenv").config({path:".env.local"});process.stdout.write(process.env.DATABASE_URL)')"
psql "$DATABASE_URL" -c "SELECT email, email_verified IS NOT NULL AS verified, password_set_at, password_reset_expires > now() AS token_live FROM users WHERE email LIKE 'troycarson100+guest%' ORDER BY created_at DESC LIMIT 1;"
psql "$DATABASE_URL" -c "SELECT p.product, p.license_key, p.stripe_session_id IS NOT NULL AS stamped FROM purchases p JOIN users u ON u.id = p.user_id WHERE u.email LIKE 'troycarson100+guest%' ORDER BY p.created_at DESC LIMIT 2;"
```

Expected: one user, `verified = t`, `password_set_at` NULL, `token_live = t`; one shft purchase with a key, `stamped = t`.

- [ ] **Step 5: Check the webhook and the email**

In the `stripe listen` output, confirm `checkout.session.completed` → `[200]`. In the dev server log, confirm no `[plugin grant]` or `[Stripe webhook]` warnings. In the inbox for the plus-address (it is the owner's Gmail), confirm the receipt arrived with the key, three download links, and a "Set password" button. If SMTP is not configured locally, note that and skip the inbox check; the `sendPluginPurchaseEmail` HTML can be eyeballed by logging it.

- [ ] **Step 6: Download by key**

```bash
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3001/api/products/shft/download?asset=manual&key=<KEY FROM STEP 3>"
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3001/api/products/drft/download?asset=manual&key=<KEY FROM STEP 3>"
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3001/api/products/shft/download?asset=manual"
```

Expected: `302` (or `503` if storage is not configured locally, which still proves the key passed), then `403` (a shft key does not unlock drft), then `401` (no key, no session).

- [ ] **Step 7: Idempotency: replay the webhook**

Find the event id in the `stripe listen` output and resend it:

```bash
stripe events resend <evt_id>
```

Re-run the two queries from Step 4. Expected: still one purchase row, the same licence key, and (in the inbox) a second identical receipt - the webhook is allowed to email again on a replay; what must not change is the key.

- [ ] **Step 8: Set the password from the link**

Take the `Set a password` href from Step 3, open it in the browser (or with Playwright), and confirm the heading reads "Set your password". Submit a password. Expected: redirected to `/login?reset=true&callbackUrl=%2Fproducts`; sign in with the plus-address and that password; `/products` shows the shft purchase with the same key.

Check the DB: `password_set_at` is now set.

- [ ] **Step 9: Lost-key page**

```bash
curl -s -X POST http://localhost:3001/api/plugins/resend-key -H 'content-type: application/json' -d '{"email":"troycarson100+guest<epoch>@gmail.com"}'
curl -s -X POST http://localhost:3001/api/plugins/resend-key -H 'content-type: application/json' -d '{"email":"nobody-here@example.com"}'
for i in 1 2 3 4; do curl -s -o /dev/null -w '%{http_code} ' -X POST http://localhost:3001/api/plugins/resend-key -H 'content-type: application/json' -d '{"email":"limit@example.com"}'; done; echo
```

Expected: `{"ok":true}` twice (the second sends nothing but says the same), then `200 200 200 429`. The first call's receipt should arrive with "Go to My Products" (the account now has a password), not "Set password".

Open `http://localhost:3001/lost-key`, submit the plus-address, confirm the fixed confirmation text renders.

- [ ] **Step 10: Signed-in purchase still works**

With the browser signed in as the plus-address from Step 8, open `http://localhost:3001/drft`. Expected: the button reads "Buy Now — $15" (crossgrade, since the account owns shft) and no "Own shft? Sign in" line appears. Click through with card 4242. Expected: `/thanks` shows a `DRFT-` key, "Go to My Products", and no set-password link. `/products` lists both plugins.

- [ ] **Step 11: Guest nudge and duplicate handling**

Sign out. Open `http://localhost:3001/shft`. Expected: "Own drft? Sign in for the $15 crossgrade." under the get-started buy button. Open `http://localhost:3001/plugins`. Expected: "Already own one? Sign in to complete the pair for $15." under the bundle button.

Buy shft again as a guest with the same plus-address (re-run Step 3 with the email fixed to it). Expected: because that account predates this checkout and the browser is signed out, `/thanks` shows the withheld variant ("Thanks - you're all set ... added to the account for <email> ... receipt sent there") with NO key, NO download links and NO set-password button; the receipt email carries the same shft key as before (not a new one) plus the yellow "already owned shft ... will be refunded" note; the dev server log has a `[plugin grant] duplicate purchase` warning; the DB still has one shft row for that user with its original `stripe_session_id`.

Then, still signed out, reload the same `/thanks` URL. Expected: the withheld variant again (the session id alone never reveals a pre-existing account's keys).

Refund the duplicate in the Stripe test dashboard (or `stripe refunds create --payment-intent <pi>`), which keeps the test account tidy.

- [ ] **Step 12: Unit tests, typecheck, lint, one last time**

Run: `npx tsx --test lib/*.test.ts && npx tsc --noEmit && npx eslint app lib components`
Expected: all green.

- [ ] **Step 13: Stop the background processes and record the result**

Stop the dev server and `stripe listen`. Append a short "Verified 2026-09-07" note to the bottom of this plan listing which steps passed, then commit:

```bash
git add docs/superpowers/plans/2026-09-07-guest-checkout.md
git commit -m "docs: guest checkout verification notes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Deployment notes (for the owner, after merge)

1. Apply `prisma/migrations/manual/20260907_password_set_at.sql` to production with `npx prisma db execute --file ... --schema prisma/schema.prisma` against the production `DATABASE_URL`, before deploying the code. Deploying first would make register and reset-password fail on the missing column.
2. No new environment variables.
3. Set up DKIM for sampleroll.com in the Microsoft 365 Defender portal and add the two `selector1._domainkey` / `selector2._domainkey` CNAMEs at GoDaddy. Not code, but it is the biggest deliverability lever for the receipt.
4. Optional: enable customer receipts in the Stripe dashboard as a second confirmation from Stripe's own servers.
