# shft comp codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the site owner hand out working shft copies via a one-time retrieval code, redeemed on the website, with zero plugin changes.

**Architecture:** A new `CompCode` table holds bearer codes. An admin page generates them (batch, note, expiration). A `/redeem` page, gated behind login, turns an open code into a normal `Purchase` — the exact same shape a Stripe purchase already produces — so `/api/license/activate`, `/products`, and `/api/license/deactivate` need no changes at all.

**Tech Stack:** Next.js 15 (App Router), Prisma/PostgreSQL, NextAuth v5 (JWT credentials sessions), Node's built-in `node:test` runner (via `tsx`).

**Spec:** `GateFun/docs/superpowers/specs/2026-08-17-shft-comp-codes-design.md` (design doc lives in the plugin repo alongside the parent licensing design; this plan and all code live in `thesampledig`).

## Global Constraints

- No plugin-side changes of any kind — comp codes are redeemed on the website only; the plugin only ever sees a license key through the existing activation panel.
- Code format is Crockford base32 (alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, no `I`/`L`/`O`/`U`) with a checksum character, prefixed `GIFT-` — visually distinct from license keys' `SHFT-` prefix so the two can never be confused.
- Reuse existing infrastructure, never duplicate it: `requireAdmin()` (`lib/admin.ts`) for admin gating, `generateLicenseKey()` (`lib/license-key.ts`) for minting the purchase's key, `sendShftPurchaseEmail()` (`lib/email.ts`) for the confirmation email, `prisma` singleton (`lib/db.ts`).
- A comp code is redeemable by whoever submits it first (open/bearer) — no email-locking.
- **Never point a raw `prisma` CLI command or the live `next dev` server at the production Supabase database during this work.** Every `prisma` command in this plan gets an explicit inline `DATABASE_URL=` override pointing at the local `sampleroll_dev` Postgres; `.env` (which holds the production URL) is never edited. Applying the resulting migration to the real Supabase database is a separate, explicit, human-triggered step **not included in this plan**.
- Plain ASCII only in any UI copy or emails this plan adds — no arrows, ellipses, or smart quotes.

---

### Task 1: Point local dev at a local Postgres and sync the current schema

The live `.env` points at the production Supabase database. A local Postgres 17 server is already running on this machine with an empty-ish `sampleroll_dev` database that predates the licensing feature (it's missing `license_activations`). Before adding anything, bring it fully current with `schema.prisma` — locally only.

**Files:**
- Modify: `/Users/troycarson/Documents/Cursor Projects/thesampledig/.env.local` (gitignored — not committed)

- [ ] **Step 1: Confirm the local Postgres server is running**

```bash
pg_isready || brew services start postgresql@17
```

Expected: `/tmp:5432 - accepting connections` (either immediately, or after the `brew services start`).

- [ ] **Step 2: Add the local DATABASE_URL to `.env.local`**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
grep -q '^DATABASE_URL=' .env.local || echo 'DATABASE_URL="postgresql://troycarson@127.0.0.1:5432/sampleroll_dev"' >> .env.local
```

This only affects `next dev` (which loads `.env.local` on top of `.env`). It does not touch `.env`, and does not affect the deployed site (DigitalOcean has its own env config).

- [ ] **Step 3: Sync the current schema into the local database**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
DATABASE_URL="postgresql://troycarson@127.0.0.1:5432/sampleroll_dev" npx prisma db push
```

Expected: Prisma reports the database is now in sync, and creates `license_activations` plus any other tables/columns missing since this local DB was last touched. `prisma db push` (not `migrate`) matches how this repo already treats schema sync — `prisma migrate` is never used here; production schema changes go through `prisma db execute` by hand.

- [ ] **Step 4: Verify**

```bash
psql sampleroll_dev -c "\dt"
```

Expected: the table list now includes `license_activations` alongside the 14 tables already there (`purchases`, `users`, `affiliates`, etc).

---

### Task 2: Extract a shared Crockford-base32 keycode helper

`lib/license-key.ts` already has the full alphabet/checksum/grouping logic for `SHFT-XXXX-XXXX-XXXX` keys. Pull the generic part out so comp codes (`GIFT-XXXX-XXXX-XXXX`) can reuse it instead of duplicating the checksum math. This step must be **behavior-preserving**: `generateLicenseKey`/`normalizeLicenseKey`'s signatures and behavior do not change, and the existing test file must keep passing unmodified.

**Files:**
- Create: `lib/keycode.ts`
- Modify: `lib/license-key.ts` (full rewrite — it becomes a thin wrapper)
- Test: `lib/license-key.test.ts` (existing — do not modify; it is the regression check)

**Interfaces:**
- Produces: `generateKeycode(prefix: string, pick?: (max: number) => number): string`, `normalizeKeycode(prefix: string, input: string): string | null` — used by both `lib/license-key.ts` and the new `lib/comp-code.ts` (Task 3).

- [ ] **Step 1: Run the existing test to confirm the baseline passes**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
npx tsx --test lib/license-key.test.ts
```

Expected: `# pass 6`, `# fail 0`.

- [ ] **Step 2: Create `lib/keycode.ts`**

```ts
import { randomInt } from "node:crypto"

// Crockford base32: no I, L, O or U. I/L/O are the characters people mistype for
// 1/1/0, so normalizeKeycode folds them back rather than rejecting the code; U is
// excluded outright so a random code can never spell something unfortunate.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const BODY_LEN = 11 // + 1 checksum character = 12, printed as three groups of four

function checkChar(body: string): string {
  let sum = 0
  for (const c of body) sum += ALPHABET.indexOf(c)
  return ALPHABET[sum % 32]
}

function group(prefix: string, full: string): string {
  return `${prefix}-${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8, 12)}`
}

/** `pick` is injectable so tests can be deterministic; it defaults to a CSPRNG. */
export function generateKeycode(prefix: string, pick: (max: number) => number = randomInt): string {
  let body = ""
  for (let i = 0; i < BODY_LEN; i++) body += ALPHABET[pick(32)]
  return group(prefix, body + checkChar(body))
}

/**
 * Canonicalises anything a human might paste. Returns null when the code is the
 * wrong shape or the checksum fails — which is the point: a typo is caught here,
 * client-side, instead of after a round trip that just says "invalid code".
 *
 * The checksum catches every single-character substitution: swapping one symbol
 * shifts the sum by 1..31, which can never be a multiple of 32.
 */
export function normalizeKeycode(prefix: string, input: string): string | null {
  if (typeof input !== "string") return null

  let s = input.toUpperCase().replace(/[^0-9A-Z]/g, "")
  if (s.length === BODY_LEN + 1 + prefix.length && s.startsWith(prefix)) s = s.slice(prefix.length)
  s = s.replace(/[ILO]/g, (c) => (c === "O" ? "0" : "1"))

  if (s.length !== BODY_LEN + 1) return null
  for (const c of s) if (!ALPHABET.includes(c)) return null
  if (checkChar(s.slice(0, BODY_LEN)) !== s[BODY_LEN]) return null

  return group(prefix, s)
}
```

- [ ] **Step 3: Rewrite `lib/license-key.ts` to delegate to it**

```ts
import { randomInt } from "node:crypto"
import { generateKeycode, normalizeKeycode } from "./keycode"

export function generateLicenseKey(pick: (max: number) => number = randomInt): string {
  return generateKeycode("SHFT", pick)
}

export function normalizeLicenseKey(input: string): string | null {
  return normalizeKeycode("SHFT", input)
}
```

- [ ] **Step 4: Run the existing test again to confirm nothing broke**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
npx tsx --test lib/license-key.test.ts
```

Expected: identical result to Step 1 — `# pass 6`, `# fail 0`. The file was not modified; if anything fails, the refactor changed behavior and must be fixed before continuing.

- [ ] **Step 5: Commit**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
git add lib/keycode.ts lib/license-key.ts
git commit -m "refactor: extract shared Crockford keycode helper from license-key

Pulls the generic alphabet/checksum/grouping logic out of license-key.ts
so the upcoming comp-code module (GIFT- prefix) can reuse it instead of
duplicating the checksum math. Behavior-preserving: generateLicenseKey
and normalizeLicenseKey keep their exact signatures, existing tests
unchanged and passing."
```

---

### Task 3: Comp code generation/validation module

**Files:**
- Create: `lib/comp-code.ts`
- Test: `lib/comp-code.test.ts`

**Interfaces:**
- Consumes: `generateKeycode`, `normalizeKeycode` from `lib/keycode.ts` (Task 2).
- Produces: `generateCompCode(pick?: (max: number) => number): string`, `normalizeCompCode(input: string): string | null` — used by the admin generate route (Task 6) and the redeem route (Task 8).

- [ ] **Step 1: Write the failing test**

```ts
// lib/comp-code.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { generateCompCode, normalizeCompCode } from "./comp-code"

const seq = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

test("generateCompCode returns the grouped GIFT- form", () => {
  const code = generateCompCode(seq([0]))
  assert.equal(code, "GIFT-0000-0000-0000")
})

test("generateCompCode output always survives normalize", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateCompCode()
    assert.equal(normalizeCompCode(code), code, `round trip failed for ${code}`)
  }
})

test("normalizeCompCode accepts lowercase, missing dashes and stray spaces", () => {
  const code = generateCompCode()
  const mangled = code.toLowerCase().replace(/-/g, " ")
  assert.equal(normalizeCompCode(mangled), code)
})

test("normalizeCompCode rejects a single mistyped character", () => {
  const code = generateCompCode()
  const body = code.replace(/^GIFT-/, "").replace(/-/g, "")
  const swapped = body[0] === "0" ? "1" + body.slice(1) : "0" + body.slice(1)
  assert.equal(normalizeCompCode("GIFT-" + swapped), null)
})

test("normalizeCompCode does not accept a SHFT- license key", () => {
  const code = generateCompCode()
  const swapped = code.replace(/^GIFT-/, "SHFT-")
  assert.equal(normalizeCompCode(swapped), null)
})

test("normalizeCompCode rejects wrong length, U, and junk", () => {
  assert.equal(normalizeCompCode("GIFT-0000-0000"), null)
  assert.equal(normalizeCompCode("GIFT-UUUU-UUUU-UUUU"), null)
  assert.equal(normalizeCompCode(""), null)
  assert.equal(normalizeCompCode("hello there"), null)
})
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
npx tsx --test lib/comp-code.test.ts
```

Expected: fails with "Cannot find module './comp-code'" (the file doesn't exist yet).

- [ ] **Step 3: Write `lib/comp-code.ts`**

```ts
import { randomInt } from "node:crypto"
import { generateKeycode, normalizeKeycode } from "./keycode"

// GIFT- prefix, deliberately different from license keys' SHFT- prefix: a
// comp code is pasted on the WEBSITE to claim a purchase, a license key is
// pasted in the PLUGIN to activate one. Same shape (and typo tolerance) would
// invite someone to try one where the other belongs.
export function generateCompCode(pick: (max: number) => number = randomInt): string {
  return generateKeycode("GIFT", pick)
}

export function normalizeCompCode(input: string): string | null {
  return normalizeKeycode("GIFT", input)
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
npx tsx --test lib/comp-code.test.ts
```

Expected: `# pass 6`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
git add lib/comp-code.ts lib/comp-code.test.ts
git commit -m "feat: comp code generation and validation

GIFT- prefixed Crockford codes, same checksum/typo-tolerance scheme as
license keys, built on the shared keycode helper."
```

---

### Task 4: Pure redemption-decision logic

Mirrors `lib/license-activation.ts`'s `decideSeat` — the route handler stays a thin wrapper around a pure, fully-testable decision function, rather than burying the branching in the route itself.

**Files:**
- Create: `lib/comp-code-redemption.ts`
- Test: `lib/comp-code-redemption.test.ts`

**Interfaces:**
- Produces:
  - `type CompCodeStatus = "open" | "redeemed" | "revoked" | "expired"`
  - `compCodeStatus(row: {redeemedAt: Date | null; revokedAt: Date | null; expiresAt: Date | null}, now?: Date): CompCodeStatus`
  - `type RedeemDecision = {action: "redeem"} | {action: "refuse"; reason: "not_found" | "revoked" | "expired" | "already_redeemed" | "already_owned"}`
  - `decideRedemption(row: {redeemedAt: Date | null; revokedAt: Date | null; expiresAt: Date | null} | null, alreadyOwnsProduct: boolean, now?: Date): RedeemDecision`
- Consumed by: `app/api/admin/comps/route.ts` (Task 6, `compCodeStatus`) and `app/api/comps/redeem/route.ts` (Task 8, `decideRedemption`).

- [ ] **Step 1: Write the failing test**

```ts
// lib/comp-code-redemption.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { compCodeStatus, decideRedemption } from "./comp-code-redemption"

const now = new Date("2026-08-17T00:00:00.000Z")
const open = { redeemedAt: null, revokedAt: null, expiresAt: null }

test("compCodeStatus: open when nothing set", () => {
  assert.equal(compCodeStatus(open, now), "open")
})

test("compCodeStatus: redeemed takes priority over everything else", () => {
  assert.equal(
    compCodeStatus({ redeemedAt: now, revokedAt: now, expiresAt: new Date("2020-01-01") }, now),
    "redeemed"
  )
})

test("compCodeStatus: revoked beats expired", () => {
  assert.equal(
    compCodeStatus({ redeemedAt: null, revokedAt: now, expiresAt: new Date("2020-01-01") }, now),
    "revoked"
  )
})

test("compCodeStatus: expired only once the date has passed", () => {
  assert.equal(compCodeStatus({ ...open, expiresAt: new Date("2020-01-01") }, now), "expired")
  assert.equal(compCodeStatus({ ...open, expiresAt: new Date("2030-01-01") }, now), "open")
})

test("decideRedemption: unknown code", () => {
  assert.deepEqual(decideRedemption(null, false, now), { action: "refuse", reason: "not_found" })
})

test("decideRedemption: revoked code refuses even for a fresh account", () => {
  const row = { redeemedAt: null, revokedAt: now, expiresAt: null }
  assert.deepEqual(decideRedemption(row, false, now), { action: "refuse", reason: "revoked" })
})

test("decideRedemption: expired code", () => {
  const row = { redeemedAt: null, revokedAt: null, expiresAt: new Date("2020-01-01") }
  assert.deepEqual(decideRedemption(row, false, now), { action: "refuse", reason: "expired" })
})

test("decideRedemption: already redeemed by someone else", () => {
  const row = { redeemedAt: now, revokedAt: null, expiresAt: null }
  assert.deepEqual(decideRedemption(row, false, now), { action: "refuse", reason: "already_redeemed" })
})

test("decideRedemption: open code but the account already owns the product", () => {
  assert.deepEqual(decideRedemption(open, true, now), { action: "refuse", reason: "already_owned" })
})

test("decideRedemption: the happy path", () => {
  assert.deepEqual(decideRedemption(open, false, now), { action: "redeem" })
})
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
npx tsx --test lib/comp-code-redemption.test.ts
```

Expected: fails — module doesn't exist yet.

- [ ] **Step 3: Write `lib/comp-code-redemption.ts`**

```ts
export type CompCodeStatus = "open" | "redeemed" | "revoked" | "expired"

export interface CompCodeRow {
  redeemedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date | null
}

/** Precedence matters: a redeemed code stays "redeemed" even if it was also
 *  later revoked or its expiry has since passed — the history is what happened. */
export function compCodeStatus(row: CompCodeRow, now: Date = new Date()): CompCodeStatus {
  if (row.redeemedAt) return "redeemed"
  if (row.revokedAt) return "revoked"
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return "expired"
  return "open"
}

export type RedeemDecision =
  | { action: "redeem" }
  | { action: "refuse"; reason: "not_found" | "revoked" | "expired" | "already_redeemed" | "already_owned" }

/**
 * Pure decision, no I/O — the route (Task 8) does the lookups and hands the
 * results in. Code-level problems (revoked/expired/already redeemed) are
 * reported before account-level ones (already owns the product), so a
 * redeemer sees what's wrong with the CODE first.
 */
export function decideRedemption(
  row: CompCodeRow | null,
  alreadyOwnsProduct: boolean,
  now: Date = new Date(),
): RedeemDecision {
  if (!row) return { action: "refuse", reason: "not_found" }

  const status = compCodeStatus(row, now)
  if (status === "revoked") return { action: "refuse", reason: "revoked" }
  if (status === "expired") return { action: "refuse", reason: "expired" }
  if (status === "redeemed") return { action: "refuse", reason: "already_redeemed" }

  if (alreadyOwnsProduct) return { action: "refuse", reason: "already_owned" }

  return { action: "redeem" }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
npx tsx --test lib/comp-code-redemption.test.ts
```

Expected: `# pass 10`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
git add lib/comp-code-redemption.ts lib/comp-code-redemption.test.ts
git commit -m "feat: pure comp code status/redemption decision logic

Mirrors license-activation.ts's decideSeat shape: the route stays a
thin wrapper, the branching is unit-tested in isolation."
```

---

### Task 5: Prisma schema — the `CompCode` table

**Files:**
- Modify: `prisma/schema.prisma:41` (User model), `prisma/schema.prisma:59` (Purchase model), insert new model after `prisma/schema.prisma:80`

- [ ] **Step 1: Add the back-relation on `User`**

In `prisma/schema.prisma`, the `User` model currently reads (lines 37-41):

```prisma
  savedSamples                 UserSample[]
  digHistory                   UserDigHistory[]
  events                       UserEvent[]
  purchases                    Purchase[]
  affiliate                    Affiliate?
```

Add one line after `affiliate`:

```prisma
  savedSamples                 UserSample[]
  digHistory                   UserDigHistory[]
  events                       UserEvent[]
  purchases                    Purchase[]
  affiliate                    Affiliate?
  compCodesRedeemed            CompCode[]
```

- [ ] **Step 2: Add the back-relation on `Purchase`**

The `Purchase` model currently reads (lines 57-59):

```prisma
  createdAt       DateTime @default(now()) @map("created_at")
  affiliateReferral AffiliateReferral?
  activations       LicenseActivation[]
```

Add one line after `activations`:

```prisma
  createdAt       DateTime @default(now()) @map("created_at")
  affiliateReferral AffiliateReferral?
  activations       LicenseActivation[]
  compCode          CompCode?
```

- [ ] **Step 3: Insert the `CompCode` model**

`LicenseActivation` currently ends at line 80, immediately followed by a blank line then `model Channel {`. Insert the new model in that gap:

```prisma
model CompCode {
  id               String    @id @default(cuid())
  // GIFT-XXXX-XXXX-XXXX — see lib/comp-code.ts. Distinct from licenseKey on
  // purpose: this is redeemed on the WEBSITE, never pasted into the plugin.
  code             String    @unique
  note             String?
  // The admin who generated it (from requireAdmin()'s session) — cheap audit
  // trail on a tool that hands out free product.
  createdByEmail   String?   @map("created_by_email")
  expiresAt        DateTime? @map("expires_at")
  revokedAt        DateTime? @map("revoked_at")
  redeemedAt       DateTime? @map("redeemed_at")
  redeemedByUserId String?   @map("redeemed_by_user_id")
  redeemedByUser   User?     @relation(fields: [redeemedByUserId], references: [id], onDelete: SetNull)
  // The Purchase this redemption produced. Nullable/SetNull rather than
  // Cascade: this row is the audit trail of "code X was redeemed by Y", which
  // should survive even if the purchase it produced is ever removed.
  purchaseId       String?   @unique @map("purchase_id")
  purchase         Purchase? @relation(fields: [purchaseId], references: [id], onDelete: SetNull)
  createdAt        DateTime  @default(now()) @map("created_at")

  @@index([redeemedByUserId])
  @@map("comp_codes")
}
```

- [ ] **Step 4: Push the schema to the local database**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
DATABASE_URL="postgresql://troycarson@127.0.0.1:5432/sampleroll_dev" npx prisma generate
DATABASE_URL="postgresql://troycarson@127.0.0.1:5432/sampleroll_dev" npx prisma db push
```

Expected: Prisma reports the new `comp_codes` table (and the two new nullable columns it implies on nothing else, since the relations are all on the `CompCode` side) created successfully.

- [ ] **Step 5: Verify the table shape**

```bash
psql sampleroll_dev -c "\d comp_codes"
```

Expected: columns `id, code, note, created_by_email, expires_at, revoked_at, redeemed_at, redeemed_by_user_id, purchase_id, created_at`, a unique index on `code` and on `purchase_id`, an index on `redeemed_by_user_id`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
git add prisma/schema.prisma
git commit -m "feat: CompCode Prisma model

Standalone table (not a nullable Purchase) so the comp mechanism stays
fully isolated from the paid-purchase code paths — see the design doc's
'why a separate table' section. Applied locally via prisma db push;
the production Supabase migration is a separate, explicit step."
```

---

### Task 6: Admin API — generate and list comp codes

**Files:**
- Create: `app/api/admin/comps/route.ts`

**Interfaces:**
- Consumes: `requireAdmin()` (`lib/admin.ts`), `prisma` (`lib/db.ts`), `generateCompCode()` (Task 3), `compCodeStatus()` (Task 4).
- Produces: `GET /api/admin/comps` -> `{codes: AdminCompCode[]}`; `POST /api/admin/comps` body `{count?, note?, expiresAt?}` -> `{codes: AdminCompCode[]}` (the newly created ones). Response shape consumed by `components/comps/AdminComps.tsx` (Task 9).

- [ ] **Step 1: Write `app/api/admin/comps/route.ts`**

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { generateCompCode } from "@/lib/comp-code"
import { compCodeStatus } from "@/lib/comp-code-redemption"

const MAX_BATCH = 100
const MAX_NOTE_LEN = 200

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const rows = await prisma.compCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { redeemedByUser: { select: { email: true } } },
  })

  const codes = rows.map((r) => ({
    id: r.id,
    code: r.code,
    note: r.note,
    createdByEmail: r.createdByEmail,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    redeemedAt: r.redeemedAt,
    redeemedByEmail: r.redeemedByUser?.email ?? null,
    status: compCodeStatus(r),
  }))

  return NextResponse.json({ codes })
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  let body: { count?: number; note?: string; expiresAt?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  const count = Number.isInteger(body.count) && (body.count as number) > 0
    ? Math.min(body.count as number, MAX_BATCH)
    : 1

  const note = typeof body.note === "string" && body.note.trim()
    ? body.note.trim().slice(0, MAX_NOTE_LEN)
    : null

  let expiresAt: Date | null = null
  if (typeof body.expiresAt === "string" && body.expiresAt.trim()) {
    const parsed = new Date(body.expiresAt)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid expiration date." }, { status: 400 })
    }
    expiresAt = parsed
  }

  const createdByEmail = session.user?.email ?? null

  // Sequential, not Promise.all: this is an occasional admin action (max 100
  // rows), and generateCompCode()'s collision odds are the same
  // astronomically-low 32^11 space generateLicenseKey already relies on with
  // no retry logic — unchanged here.
  const created = []
  for (let i = 0; i < count; i++) {
    const row = await prisma.compCode.create({
      data: { code: generateCompCode(), note, expiresAt, createdByEmail },
    })
    created.push({
      id: row.id,
      code: row.code,
      note: row.note,
      createdByEmail: row.createdByEmail,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      redeemedAt: null as Date | null,
      redeemedByEmail: null as string | null,
      status: "open" as const,
    })
  }

  return NextResponse.json({ codes: created })
}
```

- [ ] **Step 2: Type-check the new file**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
npx tsc --noEmit
```

Expected: no new errors from `app/api/admin/comps/route.ts`. This route's actual runtime behavior (auth gate, generate, list) is exercised end to end against a real server and database in Task 11 — no point standing up a server twice.

- [ ] **Step 3: Commit**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
git add app/api/admin/comps/route.ts
git commit -m "feat: admin API to generate and list comp codes"
```

---

### Task 7: Admin API — revoke a comp code

**Files:**
- Create: `app/api/admin/comps/[id]/revoke/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"

// A no-op (still 200) on an already-redeemed or already-revoked code rather
// than an error: revoking is idempotent, and the admin table's "Revoke"
// button only ever appears on codes it applies to anyway.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { id } = await params
  const row = await prisma.compCode.findUnique({ where: { id } })
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 })

  if (!row.redeemedAt && !row.revokedAt) {
    await prisma.compCode.update({ where: { id }, data: { revokedAt: new Date() } })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
git add "app/api/admin/comps/[id]/revoke/route.ts"
git commit -m "feat: admin API to revoke an unredeemed comp code"
```

---

### Task 8: Redeem API

**Files:**
- Create: `app/api/comps/redeem/route.ts`

**Interfaces:**
- Consumes: `auth()` (`lib/auth.ts`), `prisma` (`lib/db.ts`), `normalizeCompCode()` (Task 3), `decideRedemption()` (Task 4), `generateLicenseKey()` (`lib/license-key.ts`), `sendShftPurchaseEmail()` (`lib/email.ts`).
- Produces: `POST /api/comps/redeem` body `{code}` -> `{ok: true}` on success, `{error, reason}` on refusal. Consumed by `components/comps/RedeemForm.tsx` (Task 10).

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizeCompCode } from "@/lib/comp-code"
import { decideRedemption } from "@/lib/comp-code-redemption"
import { generateLicenseKey } from "@/lib/license-key"
import { sendShftPurchaseEmail } from "@/lib/email"

const PRODUCT = "shft"

const MESSAGES: Record<string, string> = {
  not_found: "We don't recognize that code.",
  revoked: "That code has been cancelled.",
  expired: "That code has expired.",
  already_redeemed: "That code has already been redeemed.",
  already_owned: "You already own shft - see My Products.",
}

const STATUS: Record<string, number> = {
  not_found: 404,
  revoked: 410,
  expired: 410,
  already_redeemed: 410,
  already_owned: 409,
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 })
  }

  let body: { code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  const code = normalizeCompCode(body.code ?? "")
  if (!code) {
    return NextResponse.json({ error: "That code doesn't look right." }, { status: 400 })
  }

  const row = await prisma.compCode.findUnique({ where: { code } })
  const alreadyOwns = row
    ? Boolean(
        await prisma.purchase.findUnique({
          where: { userId_product: { userId: session.user.id, product: PRODUCT } },
        }),
      )
    : false

  const decision = decideRedemption(row, alreadyOwns)
  if (decision.action === "refuse") {
    return NextResponse.json(
      { error: MESSAGES[decision.reason], reason: decision.reason },
      { status: STATUS[decision.reason] },
    )
  }

  // Claim the CODE first, atomically: only the request whose conditional
  // update actually matches a row (redeemedAt still null) wins. This closes
  // the same race claim/route.ts already closes for the license-key backfill
  // - a conditional updateMany, never a read-then-write.
  const claimed = await prisma.compCode.updateMany({
    where: { id: row!.id, redeemedAt: null },
    data: { redeemedAt: new Date(), redeemedByUserId: session.user.id },
  })
  if (claimed.count === 0) {
    return NextResponse.json(
      { error: MESSAGES.already_redeemed, reason: "already_redeemed" },
      { status: 410 },
    )
  }

  // Upsert, not create: if this same account somehow double-submits before
  // the first request's write lands, the second call reuses the existing
  // purchase and mints no second key, matching the "never regenerate" rule
  // the paid path already follows.
  const purchase = await prisma.purchase.upsert({
    where: { userId_product: { userId: session.user.id, product: PRODUCT } },
    create: { userId: session.user.id, product: PRODUCT, stripeSessionId: null, licenseKey: generateLicenseKey() },
    update: {},
  })

  // Best-effort link for the admin audit view. If this fails the grant has
  // already happened - the user already has their purchase and key - so it
  // is logged, not surfaced as an error.
  try {
    await prisma.compCode.update({ where: { id: row!.id }, data: { purchaseId: purchase.id } })
  } catch (e) {
    console.error("[comps redeem] failed to link purchase to comp code", e)
  }

  try {
    await sendShftPurchaseEmail(session.user.email!, purchase.licenseKey)
  } catch (e) {
    console.error("[comps redeem] purchase email failed", e)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
git add app/api/comps/redeem/route.ts
git commit -m "feat: comp code redemption API

Turns an open code into a normal Purchase + license key, reusing
generateLicenseKey and sendShftPurchaseEmail unchanged. Race-safe: the
code claim is a conditional updateMany, the purchase write is an upsert."
```

---

### Task 9: Admin page — generate and manage comp codes

**Files:**
- Create: `app/admin/comps/page.tsx`
- Create: `components/comps/AdminComps.tsx`

**Interfaces:**
- Consumes: `requireAdmin()` (`lib/admin.ts`); `GET`/`POST /api/admin/comps`, `POST /api/admin/comps/[id]/revoke` (Tasks 6-7); `CompCodeStatus` type (`lib/comp-code-redemption.ts`, Task 4).

- [ ] **Step 1: Write `app/admin/comps/page.tsx`**

```tsx
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin"
import AdminComps from "@/components/comps/AdminComps"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

// Gated by the ADMIN_EMAILS env allowlist, same as /admin/affiliates.
export default async function AdminCompsPage() {
  if (!(await requireAdmin())) notFound()

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-8">
        <AdminComps />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Write `components/comps/AdminComps.tsx`**

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import type { CompCodeStatus } from "@/lib/comp-code-redemption"

interface AdminCompCode {
  id: string
  code: string
  note: string | null
  createdByEmail: string | null
  createdAt: string
  expiresAt: string | null
  redeemedAt: string | null
  redeemedByEmail: string | null
  status: CompCodeStatus
}

const mono = { fontFamily: "var(--font-ibm-mono), monospace" }
const labelStyle = { ...mono, color: "var(--muted)" }
const fieldStyle = {
  borderColor: "var(--border)",
  color: "var(--foreground)",
  background: "rgba(255, 255, 255, 0.45)",
}
const btnStyle = { borderColor: "var(--border)", color: "var(--foreground)", background: "transparent" }
const primaryBtnStyle = { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }

const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none"
const btnCls = "rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer"

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function statusLabel(status: CompCodeStatus): string {
  if (status === "open") return "open"
  if (status === "redeemed") return "redeemed"
  if (status === "revoked") return "revoked"
  return "expired"
}

export default function AdminComps() {
  const [codes, setCodes] = useState<AdminCompCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [count, setCount] = useState(1)
  const [note, setNote] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [justGenerated, setJustGenerated] = useState<AdminCompCode[]>([])

  const load = useCallback(async () => {
    setError("")
    try {
      const res = await fetch("/api/admin/comps")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Load failed")
      setCodes(data.codes)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function generate() {
    setBusy(true)
    setError("")
    setJustGenerated([])
    try {
      const res = await fetch("/api/admin/comps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, note, expiresAt: expiresAt || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generate failed")
      setJustGenerated(data.codes)
      setNote("")
      setExpiresAt("")
      setCount(1)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed")
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this code? It will no longer be redeemable.")) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/comps/${id}/revoke`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Revoke failed")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed")
    } finally {
      setBusy(false)
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  if (loading)
    return (
      <p className="py-8 text-sm" style={{ color: "var(--foreground)", opacity: 0.7 }}>
        Loading comp codes...
      </p>
    )

  return (
    <div style={{ color: "var(--foreground)" }}>
      <p className="text-xs uppercase tracking-widest mb-1" style={labelStyle}>
        shft comp codes
      </p>
      <h1 className="text-2xl font-bold mb-2">Comp codes</h1>
      <p className="text-sm mb-8" style={{ opacity: 0.7 }}>
        Generate one-time retrieval codes to give away working copies of shft. A code is redeemed
        at /redeem by whoever submits it first.
      </p>
      {error ? (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-lg font-semibold">Generate</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm" style={{ opacity: 0.85 }}>
            Count
            <input
              className={`${inputCls} w-16`}
              style={fieldStyle}
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
            />
          </label>
          <input
            className={`${inputCls} flex-1 min-w-40`}
            style={fieldStyle}
            placeholder="Note (e.g. press - XYZ blog)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-sm" style={{ opacity: 0.85 }}>
            Expires
            <input
              className={inputCls}
              style={fieldStyle}
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          <button className={btnCls} style={primaryBtnStyle} disabled={busy} onClick={generate}>
            Generate
          </button>
        </div>
        {justGenerated.length > 0 ? (
          <div className="mt-3 text-sm">
            <p className="mb-1">Just generated:</p>
            <ul className="space-y-1">
              {justGenerated.map((c) => (
                <li key={c.id}>
                  <span className="select-all" style={{ ...mono, color: "var(--primary)" }}>
                    {c.code}
                  </span>{" "}
                  <button className={`${btnCls} ml-1`} style={btnStyle} onClick={() => copy(c.code)}>
                    Copy
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        {codes.length === 0 ? (
          <p className="text-sm" style={{ opacity: 0.6 }}>
            No comp codes yet - generate your first one above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide" style={labelStyle}>
                  <th className="px-4 py-2.5 font-normal">Code</th>
                  <th className="px-4 py-2.5 font-normal">Note</th>
                  <th className="px-4 py-2.5 font-normal">Status</th>
                  <th className="px-4 py-2.5 font-normal">Redeemed by</th>
                  <th className="px-4 py-2.5 font-normal">Created</th>
                  <th className="px-4 py-2.5 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2.5" style={mono}>
                      {c.code}
                    </td>
                    <td className="px-4 py-2.5">{c.note ?? ""}</td>
                    <td className="px-4 py-2.5">{statusLabel(c.status)}</td>
                    <td className="px-4 py-2.5">{c.redeemedByEmail ?? ""}</td>
                    <td className="px-4 py-2.5">{fmtDate(c.createdAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {c.status === "open" ? (
                        <button className={btnCls} style={btnStyle} disabled={busy} onClick={() => revoke(c.id)}>
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
git add app/admin/comps/page.tsx components/comps/AdminComps.tsx
git commit -m "feat: admin page to generate, list, and revoke comp codes"
```

---

### Task 10: Redeem page

**Files:**
- Create: `app/redeem/page.tsx`
- Create: `components/comps/RedeemForm.tsx`

**Interfaces:**
- Consumes: `auth()` (`lib/auth.ts`); `POST /api/comps/redeem` (Task 8).

- [ ] **Step 1: Write `app/redeem/page.tsx`**

```tsx
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import SiteNav from "@/components/SiteNav"
import RedeemForm from "@/components/comps/RedeemForm"
import { auth } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Redeem a code | Sample Roll",
  robots: { index: false, follow: false },
}

export default async function RedeemPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/redeem")
  }

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-md mx-auto px-3 sm:px-4 mt-[56px] pb-16 pt-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Redeem a code
        </h1>
        <p className="text-[15px] mb-8" style={{ color: "var(--foreground)", opacity: 0.75 }}>
          Got a comp code for shft? Enter it below - it will be added to {session.user.email}.
        </p>
        <RedeemForm />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Write `components/comps/RedeemForm.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none w-full"
const btnCls = "rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer mt-3"
const fieldStyle = {
  borderColor: "var(--border)",
  color: "var(--foreground)",
  background: "rgba(255, 255, 255, 0.45)",
}
const primaryBtnStyle = { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }

export default function RedeemForm() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/comps/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Redeem failed")
      router.push("/products")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Redeem failed")
      setBusy(false)
    }
  }

  return (
    <div>
      <input
        className={inputCls}
        style={fieldStyle}
        placeholder="GIFT-XXXX-XXXX-XXXX"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy) submit()
        }}
      />
      {error ? (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <button className={btnCls} style={primaryBtnStyle} disabled={busy || !code.trim()} onClick={submit}>
        {busy ? "Redeeming..." : "Redeem"}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
git add app/redeem/page.tsx components/comps/RedeemForm.tsx
git commit -m "feat: /redeem page for turning a comp code into a purchase"
```

---

### Task 11: Local end-to-end verification

Everything up to here is unit-tested or type-level. This task proves the whole vertical slice actually works against the local database, end to end: generate a code as an admin, redeem it as a different account, confirm a real `Purchase` with a real license key comes out the other end.

**Files:** none — verification only, against the local `sampleroll_dev` database from Task 1.

- [ ] **Step 1: Run every new/changed unit test together**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
npx tsx --test lib/license-key.test.ts lib/comp-code.test.ts lib/comp-code-redemption.test.ts
```

Expected: all pass, `# fail 0` across all three files.

- [ ] **Step 2: Type-check the whole project**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
npx tsc --noEmit
```

Expected: no errors. If there are pre-existing errors unrelated to any file this plan touched, note them but do not fix them here - out of scope.

- [ ] **Step 3: Seed two local test accounts**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
HASH=$(node -e "console.log(require('bcryptjs').hashSync('testpassword123', 10))")
psql sampleroll_dev -v hash="$HASH" <<'SQL'
insert into users (id, email, password_hash, email_verified, created_at)
values
  ('comptest-admin', 'comptest-admin@example.com', :'hash', now(), now()),
  ('comptest-user',  'comptest-user@example.com',  :'hash', now(), now())
on conflict (id) do nothing;
SQL
psql sampleroll_dev -c "select id, email from users where id in ('comptest-admin','comptest-user');"
```

Expected: both rows listed back. (`email_verified` must be set - `authorize()` in `lib/auth.ts` refuses login otherwise.)

- [ ] **Step 4: Start the dev server locally, pointed at the local DB, with the seeded admin as the only admin**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
ADMIN_EMAILS="comptest-admin@example.com" npx next dev -p 3000 > /tmp/comps-dev.log 2>&1 &
echo $! > /tmp/comps-dev.pid
sleep 5
curl -s -o /dev/null -w "dev server: %{http_code}\n" http://localhost:3000/
```

Expected: `dev server: 200`. `.env.local`'s `DATABASE_URL` (Task 1) makes this instance use `sampleroll_dev`, not production.

- [ ] **Step 5: Confirm the auth gates reject unauthenticated requests**

```bash
curl -s -o /dev/null -w "admin GET (no session): %{http_code}\n" http://localhost:3000/api/admin/comps
curl -s -o /dev/null -w "redeem POST (no session): %{http_code}\n" -X POST -H "Content-Type: application/json" -d '{"code":"GIFT-0000-0000-0000"}' http://localhost:3000/api/comps/redeem
```

Expected: `403` and `401` respectively.

- [ ] **Step 6: Log in as the admin via curl (NextAuth credentials flow) and generate a code**

```bash
rm -f /tmp/comps-admin-cookies.txt
CSRF=$(curl -s -c /tmp/comps-admin-cookies.txt http://localhost:3000/api/auth/csrf | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).csrfToken))")
curl -s -b /tmp/comps-admin-cookies.txt -c /tmp/comps-admin-cookies.txt -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=comptest-admin@example.com" \
  --data-urlencode "password=testpassword123" \
  --data-urlencode "json=true" \
  http://localhost:3000/api/auth/callback/credentials -o /dev/null -w "login: %{http_code}\n"

curl -s -b /tmp/comps-admin-cookies.txt http://localhost:3000/api/admin/comps
GENERATED=$(curl -s -b /tmp/comps-admin-cookies.txt -X POST -H "Content-Type: application/json" \
  -d '{"count":1,"note":"e2e smoke test"}' http://localhost:3000/api/admin/comps)
echo "$GENERATED"
```

Expected: `login: 200` (or a redirect status in the 200-300 range - NextAuth's credentials callback varies slightly by version; treat anything that leaves a working session cookie in the jar as success and confirm via the next call), the first `curl` returns `{"codes":[...]}` (may be empty), and `$GENERATED` returns one new code with `"note":"e2e smoke test"`. Extract that code (e.g. with `node -e "console.log(JSON.parse(process.argv[1]).codes[0].code)" "$GENERATED"`) for the next step.

- [ ] **Step 7: Log in as the second account and redeem the code**

```bash
CODE=$(node -e "console.log(JSON.parse(process.argv[1]).codes[0].code)" "$GENERATED")
rm -f /tmp/comps-user-cookies.txt
CSRF2=$(curl -s -c /tmp/comps-user-cookies.txt http://localhost:3000/api/auth/csrf | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).csrfToken))")
curl -s -b /tmp/comps-user-cookies.txt -c /tmp/comps-user-cookies.txt -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF2" \
  --data-urlencode "email=comptest-user@example.com" \
  --data-urlencode "password=testpassword123" \
  --data-urlencode "json=true" \
  http://localhost:3000/api/auth/callback/credentials -o /dev/null -w "login: %{http_code}\n"

curl -s -b /tmp/comps-user-cookies.txt -X POST -H "Content-Type: application/json" \
  -d "{\"code\":\"$CODE\"}" http://localhost:3000/api/comps/redeem
echo
curl -s -b /tmp/comps-user-cookies.txt -X POST -H "Content-Type: application/json" \
  -d "{\"code\":\"$CODE\"}" http://localhost:3000/api/comps/redeem
```

Expected: the first redeem returns `{"ok":true}`; the second (same code, already redeemed) returns `{"error":"That code has already been redeemed.","reason":"already_redeemed"}`.

- [ ] **Step 8: Confirm the resulting Purchase directly in the database**

```bash
psql sampleroll_dev -c "select u.email, p.product, p.license_key, p.stripe_session_id, cc.code, cc.redeemed_at from purchases p join users u on u.id = p.user_id join comp_codes cc on cc.purchase_id = p.id where u.id = 'comptest-user';"
```

Expected: one row - `comptest-user@example.com`, `shft`, a `SHFT-XXXX-XXXX-XXXX` key, `stripe_session_id` NULL, the same `GIFT-...` code from Step 6, `redeemed_at` set.

- [ ] **Step 9: Stop the dev server and clean up the test rows**

```bash
kill "$(cat /tmp/comps-dev.pid)" 2>/dev/null
psql sampleroll_dev -c "delete from purchases where user_id in ('comptest-admin','comptest-user');"
psql sampleroll_dev -c "delete from comp_codes where created_by_email = 'comptest-admin@example.com';"
psql sampleroll_dev -c "delete from users where id in ('comptest-admin','comptest-user');"
rm -f /tmp/comps-admin-cookies.txt /tmp/comps-user-cookies.txt /tmp/comps-dev.pid /tmp/comps-dev.log
```

This step touches only the local `sampleroll_dev` database - never production.

- [ ] **Step 10: Report results**

Summarize: which steps passed, the exact `curl` outputs from Steps 6-8, and flag anything that deviated from the expected output above rather than silently treating a close-enough result as a pass.

---

## What's explicitly out of scope for this plan

- **Applying the `comp_codes` migration to the production Supabase database.** This plan only ever runs `prisma db push` against `sampleroll_dev`. Shipping this to production is a separate, explicit step the user triggers by hand (matching how the original licensing migration was rolled out).
- **Full browser click-through of `/admin/comps` and `/redeem`'s visual design.** Task 11 verifies the feature works correctly over HTTP; it does not verify the pages look right. There is no browser-automation tool available in this session - after this plan lands, sign in locally (`comptest-admin@example.com` / `testpassword123` if the Task 11 rows still exist, or your own account with `ADMIN_EMAILS` set) and look at both pages yourself.
