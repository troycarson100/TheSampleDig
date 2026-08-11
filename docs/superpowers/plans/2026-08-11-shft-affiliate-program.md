# shft Affiliate Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invite-only affiliate program for shft: `?ref=` link + typed-code attribution on Stripe checkout, creator dashboards (token URL + logged-in `/affiliate`), and an `ADMIN_EMAILS`-gated `/admin/affiliates` master panel with manual payout tracking.

**Architecture:** Four new Prisma tables (`Affiliate`, `AffiliateClick`, `AffiliateReferral`, `AffiliatePayout`). A click API sets a 60-day `shft_ref` cookie; the shft checkout route forwards the cookie code in Stripe metadata and adds an optional "Creator code" custom field; a shared helper called from both the webhook and the claim route creates referrals idempotently. Dashboards are server components reading one shared stats function.

**Tech Stack:** Next.js 16 App Router (webpack build), React 19, Prisma 5.19 + Supabase Postgres, NextAuth v5 beta (JWT sessions), Stripe SDK v20, Tailwind 3.4.

**Spec:** `docs/superpowers/specs/2026-08-11-shft-affiliate-program-design.md`

## Global Constraints

- Node 20.x; run TS scripts with `npx tsx`.
- Next 15+/16: `cookies()` and route-handler `params` are async — always `await` them.
- DB naming: snake_case column `@map`s, plural snake_case `@@map` table names, `cuid()` ids — match `prisma/schema.prisma` conventions exactly.
- Migrations are hand-written idempotent SQL (`IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object` for FKs) + `ENABLE ROW LEVEL SECURITY` on new tables — match `prisma/migrations/20260718000000_add_purchases/migration.sql` style.
- Affiliate logic must NEVER break a purchase: `recordAffiliateReferral` catches and logs all errors internally.
- Commission is a snapshot in cents computed at sale time from `session.amount_total`; rate changes never rewrite history.
- No test framework exists: pure logic is tested by `scripts/test-affiliate-logic.ts` (exits non-zero on failure); everything else via `npm run lint`, `npm run build`, and manual verification.
- Repo import alias: `@/` = repo root (`@/lib/db` exports `prisma`, `@/lib/auth` exports `auth`).
- Work happens on branch `affiliate-program` in a worktree. Copy `.env` from the main checkout into the worktree first (untracked). The DB migration is additive-only (new tables) and safe to apply.

---

### Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (add 4 models; add back-relations on `User` and `Purchase`)
- Create: `prisma/migrations/20260811000000_add_affiliates/migration.sql`

**Interfaces:**
- Produces: Prisma models `Affiliate`, `AffiliateClick`, `AffiliateReferral`, `AffiliatePayout` exactly as below — every later task depends on these field names.

- [ ] **Step 1: Add models to `prisma/schema.prisma`** (append at end; also add `affiliate Affiliate?` to `User`'s relation list and `affiliateReferral AffiliateReferral?` to `Purchase`):

```prisma
model Affiliate {
  id                String              @id @default(cuid())
  code              String              @unique
  name              String
  email             String
  commissionPercent Int                 @default(30) @map("commission_percent")
  dashboardToken    String              @unique @map("dashboard_token")
  userId            String?             @unique @map("user_id")
  user              User?               @relation(fields: [userId], references: [id], onDelete: SetNull)
  active            Boolean             @default(true)
  notes             String?
  createdAt         DateTime            @default(now()) @map("created_at")
  updatedAt         DateTime            @updatedAt @map("updated_at")
  clicks            AffiliateClick[]
  referrals         AffiliateReferral[]
  payouts           AffiliatePayout[]

  @@map("affiliates")
}

model AffiliateClick {
  id          String    @id @default(cuid())
  affiliateId String    @map("affiliate_id")
  affiliate   Affiliate @relation(fields: [affiliateId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now()) @map("created_at")

  @@index([affiliateId, createdAt])
  @@map("affiliate_clicks")
}

model AffiliateReferral {
  id                    String           @id @default(cuid())
  affiliateId           String           @map("affiliate_id")
  affiliate             Affiliate        @relation(fields: [affiliateId], references: [id], onDelete: Cascade)
  purchaseId            String           @unique @map("purchase_id")
  purchase              Purchase         @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  stripeSessionId       String           @map("stripe_session_id")
  stripePaymentIntentId String?          @map("stripe_payment_intent_id")
  grossAmountCents      Int              @map("gross_amount_cents")
  commissionCents       Int              @map("commission_cents")
  currency              String
  source                String // "link" (cookie) | "code" (typed at checkout)
  refundedAt            DateTime?        @map("refunded_at")
  payoutId              String?          @map("payout_id")
  payout                AffiliatePayout? @relation(fields: [payoutId], references: [id], onDelete: SetNull)
  createdAt             DateTime         @default(now()) @map("created_at")

  @@index([affiliateId, createdAt])
  @@index([stripePaymentIntentId])
  @@map("affiliate_referrals")
}

model AffiliatePayout {
  id          String              @id @default(cuid())
  affiliateId String              @map("affiliate_id")
  affiliate   Affiliate           @relation(fields: [affiliateId], references: [id], onDelete: Cascade)
  amountCents Int                 @map("amount_cents")
  note        String?
  paidAt      DateTime            @default(now()) @map("paid_at")
  referrals   AffiliateReferral[]

  @@map("affiliate_payouts")
}
```

- [ ] **Step 2: Write `prisma/migrations/20260811000000_add_affiliates/migration.sql`** (idempotent, house style):

```sql
CREATE TABLE IF NOT EXISTS "affiliates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "commission_percent" INTEGER NOT NULL DEFAULT 30,
    "dashboard_token" TEXT NOT NULL,
    "user_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_code_key" ON "affiliates"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_dashboard_token_key" ON "affiliates"("dashboard_token");
CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_user_id_key" ON "affiliates"("user_id");

CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "affiliate_clicks_affiliate_id_created_at_idx" ON "affiliate_clicks"("affiliate_id", "created_at");

CREATE TABLE IF NOT EXISTS "affiliate_referrals" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "stripe_session_id" TEXT NOT NULL,
    "stripe_payment_intent_id" TEXT,
    "gross_amount_cents" INTEGER NOT NULL,
    "commission_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "refunded_at" TIMESTAMP(3),
    "payout_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "affiliate_referrals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_referrals_purchase_id_key" ON "affiliate_referrals"("purchase_id");
CREATE INDEX IF NOT EXISTS "affiliate_referrals_affiliate_id_created_at_idx" ON "affiliate_referrals"("affiliate_id", "created_at");
CREATE INDEX IF NOT EXISTS "affiliate_referrals_stripe_payment_intent_id_idx" ON "affiliate_referrals"("stripe_payment_intent_id");

CREATE TABLE IF NOT EXISTS "affiliate_payouts" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "note" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "affiliate_payouts_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "affiliate_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "affiliates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "affiliate_clicks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "affiliate_referrals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "affiliate_payouts" ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 3: Validate + generate.** Run: `npx prisma validate && npx prisma generate`. Expected: both succeed, client regenerated with new models.
- [ ] **Step 4: Apply.** Run: `npx prisma migrate deploy`. Expected: `20260811000000_add_affiliates` applied. (Additive only — safe.)
- [ ] **Step 5: Commit** — `git add prisma && git commit -m "feat(affiliate): schema + migration for affiliates, clicks, referrals, payouts"`.

---

### Task 2: Pure attribution logic (TDD)

**Files:**
- Create: `lib/affiliate-logic.ts` (pure functions only — no imports from db/stripe, so the test script stays dependency-free)
- Test: `scripts/test-affiliate-logic.ts`

**Interfaces:**
- Produces:
  - `normalizeAffiliateCode(raw: string | null | undefined): string | null`
  - `computeCommissionCents(amountTotalCents: number, percent: number): number`
  - `attributionCandidates(input: { typedCode?: string | null; cookieCode?: string | null }): { code: string; source: "code" | "link" }[]`
  - `isSelfReferral(input: { affiliateEmail: string; affiliateUserId: string | null; buyerEmail: string | null; buyerUserId: string | null }): boolean`

- [ ] **Step 1: Write the failing test** `scripts/test-affiliate-logic.ts`:

```ts
import {
  normalizeAffiliateCode,
  computeCommissionCents,
  attributionCandidates,
  isSelfReferral,
} from "../lib/affiliate-logic"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ok  ${name}`)
  } else {
    failures++
    console.error(`FAIL  ${name}\n      expected ${e}\n      got      ${a}`)
  }
}

// normalizeAffiliateCode: lowercase, strip whitespace, [a-z0-9-] 2-32 chars
check("normalize basic", normalizeAffiliateCode("SynthDad"), "synthdad")
check("normalize trims + inner spaces", normalizeAffiliateCode("  SYNTH DAD  "), "synthdad")
check("normalize keeps hyphens/digits", normalizeAffiliateCode("beat-lab-99"), "beat-lab-99")
check("normalize rejects symbols", normalizeAffiliateCode("synth_dad!"), null)
check("normalize rejects too short", normalizeAffiliateCode("x"), null)
check("normalize rejects 33 chars", normalizeAffiliateCode("a".repeat(33)), null)
check("normalize rejects null", normalizeAffiliateCode(null), null)
check("normalize rejects empty", normalizeAffiliateCode("   "), null)

// computeCommissionCents: round half up on the cent
check("commission 30% of $39", computeCommissionCents(3900, 30), 1170)
check("commission 30% of $19", computeCommissionCents(1900, 30), 570)
check("commission rounds", computeCommissionCents(3333, 30), 1000) // 999.9 -> 1000
check("commission 0 amount", computeCommissionCents(0, 30), 0)
check("commission clamps negative", computeCommissionCents(-500, 30), 0)

// attributionCandidates: typed code first, cookie second, invalid dropped, dupes collapsed
check(
  "candidates typed beats cookie",
  attributionCandidates({ typedCode: "SynthDad", cookieCode: "beatlab" }),
  [{ code: "synthdad", source: "code" }, { code: "beatlab", source: "link" }]
)
check(
  "candidates invalid typed falls back",
  attributionCandidates({ typedCode: "!!", cookieCode: "beatlab" }),
  [{ code: "beatlab", source: "link" }]
)
check(
  "candidates same code collapses to typed",
  attributionCandidates({ typedCode: "beatlab", cookieCode: "BeatLab" }),
  [{ code: "beatlab", source: "code" }]
)
check("candidates none", attributionCandidates({ typedCode: null, cookieCode: undefined }), [])

// isSelfReferral: email match (case-insensitive) or userId match
const aff = { affiliateEmail: "Creator@Example.com", affiliateUserId: "u_1" }
check("self by email", isSelfReferral({ ...aff, buyerEmail: "creator@example.com", buyerUserId: "u_9" }), true)
check("self by userId", isSelfReferral({ ...aff, buyerEmail: "other@x.com", buyerUserId: "u_1" }), true)
check("not self", isSelfReferral({ ...aff, buyerEmail: "other@x.com", buyerUserId: "u_9" }), false)
check("null buyer fields", isSelfReferral({ ...aff, buyerEmail: null, buyerUserId: null }), false)
check(
  "no affiliate userId",
  isSelfReferral({ affiliateEmail: "a@b.c", affiliateUserId: null, buyerEmail: null, buyerUserId: "u_1" }),
  false
)

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log("\nAll affiliate-logic tests passed")
```

- [ ] **Step 2: Run it to verify it fails.** Run: `npx tsx scripts/test-affiliate-logic.ts`. Expected: FAIL — cannot find module `../lib/affiliate-logic`.
- [ ] **Step 3: Implement `lib/affiliate-logic.ts`:**

```ts
// Pure attribution/commission logic for the shft affiliate program.
// No DB or Stripe imports — tested standalone by scripts/test-affiliate-logic.ts.

export function normalizeAffiliateCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const code = raw.toLowerCase().replace(/\s+/g, "")
  return /^[a-z0-9-]{2,32}$/.test(code) ? code : null
}

export function computeCommissionCents(amountTotalCents: number, percent: number): number {
  if (amountTotalCents <= 0 || percent <= 0) return 0
  return Math.round((amountTotalCents * percent) / 100)
}

// Ordered attribution candidates: a code typed at checkout beats the ?ref= cookie.
export function attributionCandidates(input: {
  typedCode?: string | null
  cookieCode?: string | null
}): { code: string; source: "code" | "link" }[] {
  const typed = normalizeAffiliateCode(input.typedCode)
  const cookie = normalizeAffiliateCode(input.cookieCode)
  const out: { code: string; source: "code" | "link" }[] = []
  if (typed) out.push({ code: typed, source: "code" })
  if (cookie && cookie !== typed) out.push({ code: cookie, source: "link" })
  return out
}

export function isSelfReferral(input: {
  affiliateEmail: string
  affiliateUserId: string | null
  buyerEmail: string | null
  buyerUserId: string | null
}): boolean {
  if (input.buyerEmail && input.buyerEmail.toLowerCase() === input.affiliateEmail.toLowerCase()) return true
  if (input.buyerUserId && input.affiliateUserId && input.buyerUserId === input.affiliateUserId) return true
  return false
}
```

- [ ] **Step 4: Run tests to verify they pass.** Run: `npx tsx scripts/test-affiliate-logic.ts`. Expected: all `ok`, exit 0.
- [ ] **Step 5: Commit** — `git add lib/affiliate-logic.ts scripts/test-affiliate-logic.ts && git commit -m "feat(affiliate): pure attribution + commission logic with tests"`.

---

### Task 3: DB layer — referral recording, stats, payouts

**Files:**
- Create: `lib/affiliate.ts`

**Interfaces:**
- Consumes: Task 1 models, Task 2 functions.
- Produces:
  - `recordAffiliateReferral(session: Stripe.Checkout.Session, purchaseId: string): Promise<void>` — never throws
  - `getAffiliateStats(affiliateId: string): Promise<AffiliateStats>`
  - `recordPayout(affiliateId: string, note: string | null): Promise<{ id: string; amountCents: number } | null>`
  - `generateDashboardToken(): string`
  - `type AffiliateStats` (shape below)

- [ ] **Step 1: Implement `lib/affiliate.ts`:**

```ts
import type Stripe from "stripe"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/db"
import { attributionCandidates, computeCommissionCents, isSelfReferral } from "@/lib/affiliate-logic"

export interface AffiliateStats {
  clicksTotal: number
  clicks30d: number
  salesCount: number
  grossCents: number
  commissionCents: number
  owedCents: number
  refundedAfterPayoutCents: number
  payouts: { id: string; amountCents: number; note: string | null; paidAt: Date }[]
  referrals: {
    id: string
    createdAt: Date
    grossAmountCents: number
    commissionCents: number
    source: string
    refundedAt: Date | null
    paidOut: boolean
  }[]
}

export function generateDashboardToken(): string {
  return randomBytes(24).toString("base64url")
}

// Called from BOTH the Stripe webhook and the /api/shft/claim self-heal path
// after the Purchase upsert. Idempotent (unique purchaseId) and deliberately
// swallows every error — attribution must never break a purchase.
export async function recordAffiliateReferral(
  session: Stripe.Checkout.Session,
  purchaseId: string
): Promise<void> {
  try {
    const typedCode = session.custom_fields?.find((f) => f.key === "creator_code")?.text?.value ?? null
    const cookieCode = session.metadata?.affiliateCode ?? null
    const candidates = attributionCandidates({ typedCode, cookieCode })
    if (candidates.length === 0) return

    const buyerEmail = session.customer_details?.email ?? session.customer_email ?? null
    const buyerUserId = session.client_reference_id ?? session.metadata?.userId ?? null
    const amountTotal = session.amount_total ?? 0
    if (amountTotal <= 0) return

    for (const candidate of candidates) {
      const affiliate = await prisma.affiliate.findUnique({ where: { code: candidate.code } })
      if (!affiliate || !affiliate.active) continue
      if (
        isSelfReferral({
          affiliateEmail: affiliate.email,
          affiliateUserId: affiliate.userId,
          buyerEmail,
          buyerUserId,
        })
      ) {
        console.warn(`[affiliate] self-referral skipped: ${affiliate.code}`)
        return
      }

      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null

      try {
        await prisma.affiliateReferral.create({
          data: {
            affiliateId: affiliate.id,
            purchaseId,
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
            grossAmountCents: amountTotal,
            commissionCents: computeCommissionCents(amountTotal, affiliate.commissionPercent),
            currency: session.currency ?? "usd",
            source: candidate.source,
          },
        })
      } catch (e: unknown) {
        // P2002 = referral already recorded (webhook/claim race) — success.
        if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") return
        throw e
      }
      return
    }
  } catch (e) {
    console.error("[affiliate] recordAffiliateReferral failed:", e)
  }
}

export async function getAffiliateStats(affiliateId: string): Promise<AffiliateStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [clicksTotal, clicks30d, referrals, payouts] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateId } }),
    prisma.affiliateClick.count({ where: { affiliateId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.affiliateReferral.findMany({ where: { affiliateId }, orderBy: { createdAt: "desc" } }),
    prisma.affiliatePayout.findMany({ where: { affiliateId }, orderBy: { paidAt: "desc" } }),
  ])

  const live = referrals.filter((r) => !r.refundedAt)
  const sum = (rows: { commissionCents: number }[]) => rows.reduce((s, r) => s + r.commissionCents, 0)

  return {
    clicksTotal,
    clicks30d,
    salesCount: live.length,
    grossCents: live.reduce((s, r) => s + r.grossAmountCents, 0),
    commissionCents: sum(live),
    owedCents: sum(live.filter((r) => !r.payoutId)),
    refundedAfterPayoutCents: sum(referrals.filter((r) => r.refundedAt && r.payoutId)),
    payouts: payouts.map((p) => ({ id: p.id, amountCents: p.amountCents, note: p.note, paidAt: p.paidAt })),
    referrals: referrals.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      grossAmountCents: r.grossAmountCents,
      commissionCents: r.commissionCents,
      source: r.source,
      refundedAt: r.refundedAt,
      paidOut: r.payoutId !== null,
    })),
  }
}

// Pays out ALL currently-owed referrals; amount is computed server-side so the
// payout row and stamped referrals always agree. Returns null when nothing owed.
export async function recordPayout(
  affiliateId: string,
  note: string | null
): Promise<{ id: string; amountCents: number } | null> {
  return prisma.$transaction(async (tx) => {
    const owed = await tx.affiliateReferral.findMany({
      where: { affiliateId, payoutId: null, refundedAt: null },
      select: { id: true, commissionCents: true },
    })
    if (owed.length === 0) return null
    const amountCents = owed.reduce((s, r) => s + r.commissionCents, 0)
    const payout = await tx.affiliatePayout.create({ data: { affiliateId, amountCents, note } })
    await tx.affiliateReferral.updateMany({
      where: { id: { in: owed.map((r) => r.id) } },
      data: { payoutId: payout.id },
    })
    return { id: payout.id, amountCents }
  })
}
```

- [ ] **Step 2: Verify it compiles.** Run: `npm run lint`. Expected: no new errors in `lib/affiliate.ts`.
- [ ] **Step 3: Commit** — `git add lib/affiliate.ts && git commit -m "feat(affiliate): referral recording, stats aggregation, payout transaction"`.

---

### Task 4: Click capture — API route + cookie + layout mount

**Files:**
- Create: `app/api/affiliate/click/route.ts`
- Create: `components/AffiliateRefCapture.tsx`
- Modify: `app/layout.tsx` (mount next to `<MetaPixel />`)

**Interfaces:**
- Consumes: `normalizeAffiliateCode` (Task 2), `prisma`.
- Produces: cookie `shft_ref` (httpOnly, 60 days, lax) that Task 5 reads.

- [ ] **Step 1: Implement `app/api/affiliate/click/route.ts`:**

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"

const COOKIE_NAME = "shft_ref"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60 // 60 days, last click wins

// Records a ?ref= landing and sets the attribution cookie. Invalid or inactive
// codes are ignored silently (200 either way — nothing for the visitor to see).
export async function POST(request: Request) {
  let code: string | null = null
  try {
    code = normalizeAffiliateCode((await request.json())?.code)
  } catch {
    /* ignored */
  }
  if (!code) return NextResponse.json({ ok: true })

  try {
    const affiliate = await prisma.affiliate.findUnique({ where: { code } })
    if (!affiliate || !affiliate.active) return NextResponse.json({ ok: true })

    await prisma.affiliateClick.create({ data: { affiliateId: affiliate.id } })

    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })
    return res
  } catch (e) {
    console.error("[affiliate click]", e)
    return NextResponse.json({ ok: true })
  }
}
```

- [ ] **Step 2: Implement `components/AffiliateRefCapture.tsx`** (reads `window.location` on mount — avoids the `useSearchParams` Suspense requirement in the root layout):

```tsx
"use client"

import { useEffect } from "react"

// Detects ?ref=<code> on initial page load and reports it so the click is
// counted and the 60-day shft_ref attribution cookie is set. Renders nothing.
export default function AffiliateRefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref")
    if (!ref) return
    fetch("/api/affiliate/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ref }),
    }).catch(() => {})
  }, [])
  return null
}
```

- [ ] **Step 3: Mount in `app/layout.tsx`** — import it and render `<AffiliateRefCapture />` directly after `<MetaPixel />`.
- [ ] **Step 4: Manual verification.** Run dev server (`npm run dev:direct`), visit `http://localhost:3000/shft?ref=doesnotexist` → no cookie set, no error. Create a quick affiliate row via `npx tsx -e` one-liner (or wait for Task 8 admin UI) and confirm a valid code sets the `shft_ref` cookie (DevTools → Application → Cookies) and inserts an `affiliate_clicks` row.
- [ ] **Step 5: Commit** — `git add app/api/affiliate app/layout.tsx components/AffiliateRefCapture.tsx && git commit -m "feat(affiliate): ?ref= click capture with 60-day attribution cookie"`.

---

### Task 5: Checkout integration — cookie → metadata + creator-code field

**Files:**
- Modify: `app/api/shft/checkout/route.ts`

**Interfaces:**
- Consumes: `shft_ref` cookie (Task 4), `normalizeAffiliateCode`.
- Produces: `metadata.affiliateCode` and a `creator_code` custom field on the Stripe session — exactly what `recordAffiliateReferral` (Task 3) reads.

- [ ] **Step 1: Add imports** — `import { cookies } from "next/headers"` and `import { normalizeAffiliateCode } from "@/lib/affiliate-logic"`.
- [ ] **Step 2: Resolve the cookie code before creating the session** (after the `existing` purchase check):

```ts
// Affiliate attribution: forward a valid ?ref= cookie code into session
// metadata; the webhook validates it against an active affiliate.
let affiliateCode: string | null = null
try {
  const cookieStore = await cookies()
  const raw = normalizeAffiliateCode(cookieStore.get("shft_ref")?.value)
  if (raw) {
    const affiliate = await prisma.affiliate.findUnique({ where: { code: raw } })
    if (affiliate?.active) affiliateCode = raw
  }
} catch (e) {
  console.error("[shft checkout] affiliate cookie read failed", e)
}
```

- [ ] **Step 3: Extend the `stripe.checkout.sessions.create` call** — replace the `metadata` line and add `custom_fields`:

```ts
      metadata: {
        product: "shft",
        userId: session.user.id,
        ...(affiliateCode ? { affiliateCode } : {}),
      },
      custom_fields: [
        {
          key: "creator_code",
          label: { type: "custom", custom: "Creator code (optional)" },
          type: "text",
          optional: true,
        },
      ],
```

- [ ] **Step 4: Verify.** `npm run lint` passes; with `STRIPE_SECRET_KEY`/`STRIPE_SHFT_PRICE_ID` set, POST to `/api/shft/checkout` while holding a `shft_ref` cookie and confirm the returned Stripe page shows the "Creator code (optional)" field.
- [ ] **Step 5: Commit** — `git add app/api/shft/checkout/route.ts && git commit -m "feat(affiliate): checkout forwards ref cookie + adds creator code field"`.

---

### Task 6: Webhook + claim integration, refunds

**Files:**
- Modify: `app/api/stripe/webhook/route.ts` (shft branch at ~line 46; new `charge.refunded` case)
- Modify: `app/api/shft/claim/route.ts` (~line 41)

**Interfaces:**
- Consumes: `recordAffiliateReferral(session, purchaseId)` (Task 3).

- [ ] **Step 1: Webhook shft branch** — capture the upserted purchase and record the referral. Replace the `await prisma.purchase.upsert(...)` statement inside the `session.metadata?.product === "shft"` block with:

```ts
          const purchase = await prisma.purchase.upsert({
            where: { userId_product: { userId: buyerId, product: "shft" } },
            create: { userId: buyerId, product: "shft", stripeSessionId: session.id },
            update: { stripeSessionId: session.id },
          })
          await recordAffiliateReferral(session, purchase.id)
```

Add `import { recordAffiliateReferral } from "@/lib/affiliate"` at the top.

- [ ] **Step 2: Add `charge.refunded` case** to the webhook switch (before `default`):

```ts
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId =
          typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id
        if (!paymentIntentId) break
        // Any refund (full or partial) claws back the whole commission (v1 policy).
        await prisma.affiliateReferral.updateMany({
          where: { stripePaymentIntentId: paymentIntentId, refundedAt: null },
          data: { refundedAt: new Date() },
        })
        break
      }
```

- [ ] **Step 3: Claim route** — same pattern: capture `const purchase = await prisma.purchase.upsert(...)` and follow with `await recordAffiliateReferral(checkout, purchase.id)`; add the same import.
- [ ] **Step 4: Verify.** `npm run lint` + `npx tsx scripts/test-affiliate-logic.ts` still pass.
- [ ] **Step 5: Commit** — `git add app/api/stripe/webhook/route.ts app/api/shft/claim/route.ts && git commit -m "feat(affiliate): record referrals from webhook + claim, refund clawback"`.

**Deployment note (goes in final summary, not code):** the Stripe webhook endpoint must have `charge.refunded` added to its enabled events in the Stripe dashboard.

---

### Task 7: Creator dashboard — shared component, token page, /affiliate, nav link

**Files:**
- Create: `components/affiliate/AffiliateDashboard.tsx` (server-renderable, props only)
- Create: `app/affiliate/[token]/page.tsx`
- Create: `app/affiliate/page.tsx`
- Create: `app/api/affiliate/me/route.ts`
- Modify: `components/SiteNav.tsx` (conditional "Affiliate" link, desktop ~line 125 and mobile drawer ~line 245)

**Interfaces:**
- Consumes: `getAffiliateStats` (Task 3), `auth`, `prisma`.
- Produces: `AffiliateDashboard({ affiliate: { name, code }, stats: AffiliateStats, baseUrl: string })`; `GET /api/affiliate/me` → `{ isAffiliate: boolean }`.

- [ ] **Step 1: Implement `components/affiliate/AffiliateDashboard.tsx`:**

```tsx
import type { AffiliateStats } from "@/lib/affiliate"

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export default function AffiliateDashboard({
  affiliate,
  stats,
  baseUrl,
}: {
  affiliate: { name: string; code: string }
  stats: AffiliateStats
  baseUrl: string
}) {
  const link = `${baseUrl}/shft?ref=${affiliate.code}`
  const tiles: [string, string][] = [
    ["Clicks (30d / all)", `${stats.clicks30d} / ${stats.clicksTotal}`],
    ["Sales", String(stats.salesCount)],
    ["Revenue driven", usd(stats.grossCents)],
    ["Commission earned", usd(stats.commissionCents)],
    ["Owed to you", usd(stats.owedCents)],
  ]
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 text-neutral-100">
      <h1 className="text-2xl font-semibold">shft affiliate — {affiliate.name}</h1>
      <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-sm">
        <p>
          Your link: <code className="select-all break-all text-amber-300">{link}</code>
        </p>
        <p className="mt-1">
          Your code (buyers can type it at checkout): <code className="select-all text-amber-300">{affiliate.code}</code>
        </p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-neutral-700 bg-neutral-900 p-3">
            <div className="text-xs text-neutral-400">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Sales</h2>
      {stats.referrals.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">No attributed sales yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-400">
              <tr>
                <th className="py-1 pr-4">Date</th>
                <th className="py-1 pr-4">Sale</th>
                <th className="py-1 pr-4">Your cut</th>
                <th className="py-1 pr-4">Via</th>
                <th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.referrals.map((r) => (
                <tr key={r.id} className="border-t border-neutral-800">
                  <td className="py-1.5 pr-4">{fmtDate(r.createdAt)}</td>
                  <td className="py-1.5 pr-4">{usd(r.grossAmountCents)}</td>
                  <td className="py-1.5 pr-4">{usd(r.commissionCents)}</td>
                  <td className="py-1.5 pr-4">{r.source === "code" ? "typed code" : "link"}</td>
                  <td className="py-1.5">{r.refundedAt ? "refunded" : r.paidOut ? "paid" : "pending payout"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold">Payouts</h2>
      {stats.payouts.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">No payouts yet.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {stats.payouts.map((p) => (
            <li key={p.id} className="rounded border border-neutral-800 bg-neutral-900 px-3 py-2">
              {fmtDate(p.paidAt)} — {usd(p.amountCents)}
              {p.note ? <span className="text-neutral-400"> · {p.note}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement `app/affiliate/[token]/page.tsx`:**

```tsx
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { getAffiliateStats } from "@/lib/affiliate"
import AffiliateDashboard from "@/components/affiliate/AffiliateDashboard"
import SiteNav from "@/components/SiteNav"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AffiliateTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const affiliate = await prisma.affiliate.findUnique({ where: { dashboardToken: token } })
  if (!affiliate) notFound()
  const stats = await getAffiliateStats(affiliate.id)
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  return (
    <>
      <SiteNav />
      <AffiliateDashboard affiliate={{ name: affiliate.name, code: affiliate.code }} stats={stats} baseUrl={baseUrl} />
    </>
  )
}
```

- [ ] **Step 3: Implement `app/affiliate/page.tsx`** (logged-in entry; auto-links by verified email on first visit):

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getAffiliateStats } from "@/lib/affiliate"
import AffiliateDashboard from "@/components/affiliate/AffiliateDashboard"
import SiteNav from "@/components/SiteNav"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AffiliatePage() {
  const session = await auth()
  const note = (text: string) => (
    <>
      <SiteNav />
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-neutral-300">
        <p>{text}</p>
        <p className="mt-4 text-sm">
          <Link href="/" className="underline">Back home</Link>
        </p>
      </div>
    </>
  )
  if (!session?.user?.id) return note("Sign in to view your affiliate dashboard.")

  let affiliate = await prisma.affiliate.findUnique({ where: { userId: session.user.id } })
  if (!affiliate) {
    // Auto-link: verified account email matching an unlinked affiliate record.
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (user?.emailVerified) {
      const match = await prisma.affiliate.findFirst({
        where: { email: { equals: user.email, mode: "insensitive" }, userId: null },
      })
      if (match) {
        affiliate = await prisma.affiliate.update({ where: { id: match.id }, data: { userId: user.id } })
      }
    }
  }
  if (!affiliate) {
    return note("The shft affiliate program is invite-only. If you make videos and want in, reach out — otherwise, nothing to see here.")
  }
  const stats = await getAffiliateStats(affiliate.id)
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  return (
    <>
      <SiteNav />
      <AffiliateDashboard affiliate={{ name: affiliate.name, code: affiliate.code }} stats={stats} baseUrl={baseUrl} />
    </>
  )
}
```

- [ ] **Step 4: Implement `app/api/affiliate/me/route.ts`:**

```ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Lets the nav decide whether to show the "Affiliate" link.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ isAffiliate: false })
  try {
    const byUser = await prisma.affiliate.findUnique({ where: { userId: session.user.id } })
    if (byUser) return NextResponse.json({ isAffiliate: true })
    if (session.user.email) {
      const byEmail = await prisma.affiliate.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
      })
      return NextResponse.json({ isAffiliate: Boolean(byEmail) })
    }
  } catch (e) {
    console.error("[affiliate me]", e)
  }
  return NextResponse.json({ isAffiliate: false })
}
```

- [ ] **Step 5: Nav link in `components/SiteNav.tsx`.** Add state + fetch (sessionStorage-cached so it's one request per tab, only for signed-in users):

```tsx
const [isAffiliate, setIsAffiliate] = useState(false)
useEffect(() => {
  if (!session?.user) return
  const cached = sessionStorage.getItem("sr_is_affiliate")
  if (cached !== null) {
    setIsAffiliate(cached === "1")
    return
  }
  fetch("/api/affiliate/me")
    .then((r) => r.json())
    .then((d) => {
      sessionStorage.setItem("sr_is_affiliate", d.isAffiliate ? "1" : "0")
      setIsAffiliate(Boolean(d.isAffiliate))
    })
    .catch(() => {})
}, [session?.user])
```

Then render, directly after the `/profile` `<Link>` in BOTH the desktop nav (~line 125) and the mobile drawer (~line 245), following each location's existing className pattern:

```tsx
{isAffiliate && (
  <Link href="/affiliate" className={/* same classes as the sibling /profile link */}>
    Affiliate
  </Link>
)}
```

- [ ] **Step 6: Verify.** `npm run lint`; dev server: `/affiliate/bogustoken` → 404; `/affiliate` signed out → sign-in note; signed in as non-affiliate → invite-only note.
- [ ] **Step 7: Commit** — `git add app/affiliate app/api/affiliate components/affiliate components/SiteNav.tsx && git commit -m "feat(affiliate): creator dashboard via token link and /affiliate account page"`.

---

### Task 8: Admin — gate, API routes, master panel UI

**Files:**
- Create: `lib/admin.ts`
- Create: `app/api/admin/affiliates/route.ts` (GET list, POST create)
- Create: `app/api/admin/affiliates/[id]/route.ts` (PATCH update)
- Create: `app/api/admin/affiliates/[id]/payout/route.ts` (POST record payout)
- Create: `app/api/admin/affiliates/[id]/regenerate-token/route.ts` (POST)
- Create: `app/admin/affiliates/page.tsx` + `components/affiliate/AdminAffiliates.tsx`
- Modify: `.env.example` (add `ADMIN_EMAILS`)

**Interfaces:**
- Consumes: `getAffiliateStats`, `recordPayout`, `generateDashboardToken`, `normalizeAffiliateCode`.
- Produces: `requireAdmin(): Promise<Session | null>`; admin JSON API used only by `AdminAffiliates.tsx`.

- [ ] **Step 1: `lib/admin.ts`:**

```ts
import { auth } from "@/lib/auth"

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(email.toLowerCase())
}

// Returns the session when the signed-in user is an admin, else null.
export async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.email || !isAdminEmail(session.user.email)) return null
  return session
}
```

- [ ] **Step 2: `.env.example`** — append under the Stripe block:

```bash
# Comma-separated emails allowed into /admin (affiliate management)
ADMIN_EMAILS=""
```

- [ ] **Step 3: `app/api/admin/affiliates/route.ts`:**

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { generateDashboardToken, getAffiliateStats } from "@/lib/affiliate"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const affiliates = await prisma.affiliate.findMany({ orderBy: { createdAt: "asc" } })
  const withStats = await Promise.all(
    affiliates.map(async (a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      email: a.email,
      commissionPercent: a.commissionPercent,
      dashboardToken: a.dashboardToken,
      userId: a.userId,
      active: a.active,
      notes: a.notes,
      stats: await getAffiliateStats(a.id),
    }))
  )
  return NextResponse.json({ affiliates: withStats })
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const body = await request.json().catch(() => null)
  const code = normalizeAffiliateCode(body?.code)
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const commissionPercent = Number.isInteger(body?.commissionPercent) ? body.commissionPercent : 30
  if (!code || !name || !email || commissionPercent < 1 || commissionPercent > 90) {
    return NextResponse.json({ error: "Need name, email, and a code (2-32 chars, a-z 0-9 -). Percent 1-90." }, { status: 400 })
  }
  const linkedUser = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })
  try {
    const affiliate = await prisma.affiliate.create({
      data: {
        code,
        name,
        email,
        commissionPercent,
        dashboardToken: generateDashboardToken(),
        userId: linkedUser?.id ?? null,
        notes: typeof body?.notes === "string" ? body.notes : null,
      },
    })
    return NextResponse.json({ affiliate })
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "That code (or linked user) already exists." }, { status: 409 })
    }
    console.error("[admin affiliates create]", e)
    return NextResponse.json({ error: "Create failed." }, { status: 500 })
  }
}
```

- [ ] **Step 4: `app/api/admin/affiliates/[id]/route.ts`:**

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Bad body." }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (body.code !== undefined) {
    const code = normalizeAffiliateCode(body.code)
    if (!code) return NextResponse.json({ error: "Invalid code." }, { status: 400 })
    data.code = code
  }
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
  if (typeof body.email === "string" && body.email.trim()) data.email = body.email.trim().toLowerCase()
  if (Number.isInteger(body.commissionPercent) && body.commissionPercent >= 1 && body.commissionPercent <= 90)
    data.commissionPercent = body.commissionPercent
  if (typeof body.active === "boolean") data.active = body.active
  if (body.notes !== undefined) data.notes = typeof body.notes === "string" ? body.notes : null

  try {
    const affiliate = await prisma.affiliate.update({ where: { id }, data })
    return NextResponse.json({ affiliate })
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "That code is taken." }, { status: 409 })
    }
    console.error("[admin affiliates update]", e)
    return NextResponse.json({ error: "Update failed." }, { status: 500 })
  }
}
```

- [ ] **Step 5: `app/api/admin/affiliates/[id]/payout/route.ts`:**

```ts
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { recordPayout } from "@/lib/affiliate"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const { id } = await params
  const body = await request.json().catch(() => null)
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null
  try {
    const payout = await recordPayout(id, note)
    if (!payout) return NextResponse.json({ error: "Nothing owed." }, { status: 400 })
    return NextResponse.json({ payout })
  } catch (e) {
    console.error("[admin payout]", e)
    return NextResponse.json({ error: "Payout failed." }, { status: 500 })
  }
}
```

- [ ] **Step 6: `app/api/admin/affiliates/[id]/regenerate-token/route.ts`:**

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { generateDashboardToken } from "@/lib/affiliate"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const { id } = await params
  try {
    const affiliate = await prisma.affiliate.update({
      where: { id },
      data: { dashboardToken: generateDashboardToken() },
    })
    return NextResponse.json({ dashboardToken: affiliate.dashboardToken })
  } catch (e) {
    console.error("[admin regenerate token]", e)
    return NextResponse.json({ error: "Regenerate failed." }, { status: 500 })
  }
}
```

- [ ] **Step 7: `app/admin/affiliates/page.tsx`** (server gate, renders client panel):

```tsx
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin"
import AdminAffiliates from "@/components/affiliate/AdminAffiliates"
import SiteNav from "@/components/SiteNav"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminAffiliatesPage() {
  if (!(await requireAdmin())) notFound()
  return (
    <>
      <SiteNav />
      <AdminAffiliates baseUrl={process.env.NEXTAUTH_URL || "http://localhost:3000"} />
    </>
  )
}
```

- [ ] **Step 8: `components/affiliate/AdminAffiliates.tsx`** — client component. Requirements (implement with plain `useState` + `fetch`, matching site styling):
  - On mount: `GET /api/admin/affiliates`, store list; show per-affiliate rows: name, code, email, %, active, clicks 30d/total, sales, gross, owed, refunded-after-payout warning when > 0.
  - "New affiliate" form: name, email, code, percent (default 30), notes → `POST /api/admin/affiliates`; on success show the dashboard link `${baseUrl}/affiliate/${dashboardToken}` with a copy button.
  - Row expand: edit fields → `PATCH /api/admin/affiliates/{id}`; toggle active; "Regenerate link" → `POST .../regenerate-token` (confirm first — old link dies); "Record payout" shows owed amount + note input → `POST .../payout` (confirm first; explain it stamps all currently-owed sales as paid).
  - Full referral + payout history per affiliate from `stats` (already in GET payload).
  - Money renders via a local `usd(cents)` helper identical to the dashboard's; errors surface inline.

```tsx
"use client"
// (Full component per the requirements above — plain useState/fetch, one file,
// no new dependencies. Keep it a flat list + expandable rows; dark theme classes
// consistent with AffiliateDashboard.tsx.)
```

- [ ] **Step 9: Verify.** Set `ADMIN_EMAILS` in worktree `.env` to your login email; dev server: `/admin/affiliates` as admin → panel loads; signed out / non-admin → 404. Create a test affiliate, open its token dashboard, record a payout with $0 owed → "Nothing owed."
- [ ] **Step 10: Commit** — `git add lib/admin.ts app/api/admin app/admin components/affiliate/AdminAffiliates.tsx .env.example && git commit -m "feat(affiliate): admin master panel with payouts + token management"`.

---

### Task 9: End-to-end verification + build

**Files:** none new.

- [ ] **Step 1:** `npx tsx scripts/test-affiliate-logic.ts` — all pass.
- [ ] **Step 2:** `npm run lint` — clean (or only pre-existing warnings).
- [ ] **Step 3:** `npm run build` — succeeds.
- [ ] **Step 4: Manual flow on dev server:** create affiliate in admin → visit `/shft?ref=<code>` → cookie set + click counted → both dashboards show the click. If Stripe TEST keys are available in the worktree `.env`, complete a test purchase with the ref cookie and confirm: referral row created, owed updates, refund in Stripe test dashboard claws it back (requires `stripe listen` or configured test webhook). If only LIVE keys exist, stop at checkout-page render (creator-code field visible) and flag live verification as a post-deploy step.
- [ ] **Step 5: Commit any fixes**, then final commit.

**Post-deploy checklist (for the final summary):**
1. Set `ADMIN_EMAILS` in DigitalOcean App Platform env.
2. Add `charge.refunded` to the Stripe webhook endpoint's enabled events.
3. Run `npx prisma migrate deploy` against production (or confirm the deploy pipeline does).
4. Create the first real affiliate and send them their token link.
