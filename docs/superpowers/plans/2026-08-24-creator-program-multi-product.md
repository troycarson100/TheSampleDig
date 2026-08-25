# Creator Program Spans shft + drft — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the creator-facing affiliate surface cover shft, drft, and the bundle — per-product share links, a product column on the sales table, and copy that stops saying "shft" — without changing how commission is attributed or paid.

**Architecture:** Attribution already works for every product; all three checkouts forward the same cookie and `creator_code` field. This adds one snapshot column (`AffiliateReferral.product`) written from Stripe session metadata at sale time, threads it to the dashboard, and updates copy in four places. No change to commission math, payouts, or the attribution cookie.

**Tech Stack:** Next.js App Router (server components), Prisma + PostgreSQL on Supabase, Stripe Checkout, TypeScript, Tailwind utility classes with CSS custom properties for theming.

**Spec:** `docs/superpowers/specs/2026-08-24-creator-program-multi-product-design.md`

## Global Constraints

- **Never run `prisma migrate dev` or `prisma migrate reset`.** Local `DATABASE_URL` points at the same Supabase database as production (`docs/DEPLOYMENT-DIGITALOCEAN.md`). Schema changes go in `prisma/migrations/manual/*.sql` and are applied with `npx prisma db execute`, following `prisma/migrations/manual/20260821_comp_code_product.sql`.
- **Never run `npm run lint` bare** — it crashes Node with a V8 out-of-memory. Lint changed files individually: `NODE_OPTIONS=--max-old-space-size=4096 npx eslint <file>`.
- **Commission math does not change.** `computeCommission`, `canInstantPayout`, `recordPayout`, and every payout path stay exactly as they are. Product is a *label*, never an input to money.
- **The `shft_ref` cookie keeps its name.** Renaming it drops every in-flight 60-day attribution window.
- **Product names render lowercase** — `shft`, `drft`, `bundle` — matching the rest of the site.
- **Copy says "creator program", never "shft affiliate".**
- **Commit messages** use the repo's conventional prefixes (`feat:`, `fix:`, `docs:`, `style:`).
- `lib/affiliate-logic.ts` must stay free of DB and Stripe imports — `scripts/test-affiliate-logic.ts` imports it directly and runs standalone.

---

### Task 1: `normalizeReferralProduct` pure helper

The one piece of new logic, and the only testable one. Pure string normalization, added to the file that already holds the affiliate program's pure logic.

**Files:**
- Modify: `lib/affiliate-logic.ts` (append helper at end of file; refresh the file-header comment on line 1)
- Test: `scripts/test-affiliate-logic.ts` (imports at top, cases appended at end)

**Interfaces:**
- Consumes: nothing
- Produces: `normalizeReferralProduct(raw: string | null | undefined): string` — returns a lowercase product slug, falling back to `"shft"`. Task 2 calls it.

- [ ] **Step 1: Write the failing test**

In `scripts/test-affiliate-logic.ts`, add `normalizeReferralProduct` to the existing import block at the top:

```ts
import {
  normalizeAffiliateCode,
  computeCommissionCents,
  attributionCandidates,
  isSelfReferral,
  canInstantPayout,
  computeCommission,
  normalizeReferralProduct,
} from "../lib/affiliate-logic"
```

Then insert these cases immediately before the closing `if (failures > 0) {` block at the end of the file:

```ts
// normalizeReferralProduct: the product a referral was earned on. Permissive —
// a future product slug must survive without editing a list here.
check("referral product shft", normalizeReferralProduct("shft"), "shft")
check("referral product drft", normalizeReferralProduct("drft"), "drft")
check("referral product bundle", normalizeReferralProduct("bundle"), "bundle")
check("referral product lowercases + trims", normalizeReferralProduct("  DRFT  "), "drft")
check("referral product keeps unknown but valid slug", normalizeReferralProduct("pro"), "pro")
check("referral product falls back on null", normalizeReferralProduct(null), "shft")
check("referral product falls back on undefined", normalizeReferralProduct(undefined), "shft")
check("referral product falls back on empty", normalizeReferralProduct(""), "shft")
check("referral product falls back on whitespace", normalizeReferralProduct("   "), "shft")
check("referral product falls back on symbols", normalizeReferralProduct("!!"), "shft")
check("referral product falls back on one char", normalizeReferralProduct("x"), "shft")
check("referral product falls back on 40 chars", normalizeReferralProduct("a".repeat(40)), "shft")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-affiliate-logic.ts`

Expected: FAIL — the run aborts before any check with a module error along the lines of `The requested module '../lib/affiliate-logic' does not provide an export named 'normalizeReferralProduct'`. If instead you see the existing tests pass and only the new ones fail, the export already exists — stop and re-read `lib/affiliate-logic.ts`.

- [ ] **Step 3: Write minimal implementation**

Append to the end of `lib/affiliate-logic.ts`:

```ts
// The product a referral was earned on, taken from Stripe session metadata:
// "shft" | "drft" | "bundle". Permissive on purpose — a future product slug
// labels itself correctly without anyone remembering to edit a list here.
// Falls back to "shft", matching the column default, for the legacy/missing
// case: every referral recorded before this column existed was a shft sale.
export function normalizeReferralProduct(raw: string | null | undefined): string {
  const product = (raw ?? "").toLowerCase().trim()
  return /^[a-z0-9-]{2,16}$/.test(product) ? product : "shft"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-affiliate-logic.ts`

Expected: PASS — every check prints `ok`, and the run ends with `All affiliate-logic tests passed`. Exit code 0.

- [ ] **Step 5: Retire the stale file-header comment**

Line 1 of `lib/affiliate-logic.ts` still scopes this file to shft. Replace it:

```ts
// Pure attribution/commission logic for the creator program (shft, drft, and
// the bundle). No DB or Stripe imports — tested standalone by
// scripts/test-affiliate-logic.ts.
```

This is the same rename Task 4 applies to user-facing copy; it lives here because this file is already open in this task, and Task 4's verification grep expects zero remaining matches.

- [ ] **Step 6: Lint the changed files**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npx eslint lib/affiliate-logic.ts scripts/test-affiliate-logic.ts`

Expected: no errors. Do not run `npm run lint`.

- [ ] **Step 7: Commit**

```bash
git add lib/affiliate-logic.ts scripts/test-affiliate-logic.ts
git commit -m "feat: normalizeReferralProduct for per-product referral labels"
```

---

### Task 2: Persist the product on every referral

Schema, migration, write path, read path — one cohesive change. There is no DB-level test harness in this repo (only pure logic is unit-tested), so verification is the type checker plus the migration running clean and idempotently.

**Files:**
- Modify: `prisma/schema.prisma` (model `AffiliateReferral`, ~line 273-297)
- Create: `prisma/migrations/manual/20260824_affiliate_referral_product.sql`
- Modify: `lib/affiliate.ts` (import line 4; `AffiliateStats` interface line 16-24; `recordAffiliateReferral` create-data ~line 70-84; `getAffiliateStats` return mapping ~line 131-139)

**Interfaces:**
- Consumes: `normalizeReferralProduct(raw: string | null | undefined): string` from Task 1.
- Produces: `AffiliateStats["referrals"][number].product: string`. Task 3 renders it.

- [ ] **Step 1: Add the column to the Prisma schema**

In `prisma/schema.prisma`, in `model AffiliateReferral`, add the `product` field directly after the existing `source` field:

```prisma
  source                String // "link" (cookie) | "code" (typed at checkout)
  // What this sale was for: "shft" | "drft" | "bundle". Snapshot at sale time,
  // like commissionCents — the purchase row can't answer this, because a bundle
  // referral hangs off the shft purchase to keep the relation one-to-one.
  product               String           @default("shft")
```

- [ ] **Step 2: Normalize schema formatting**

Run: `npx prisma format`

Expected: exits 0 and rewrites field alignment in `prisma/schema.prisma`. Review `git diff prisma/schema.prisma` — the only semantic change should be the added `product` field; alignment-only churn on neighbouring lines is fine.

- [ ] **Step 3: Write the migration**

Create `prisma/migrations/manual/20260824_affiliate_referral_product.sql`:

```sql
-- Affiliate referrals become product-aware: shft, drft, or bundle.
--
-- DEFAULT 'shft' is not cosmetic - every referral recorded before this column
-- existed predates the 2026-08-20 drft launch, so the default is what makes
-- the backfill correct with no data migration. Same shape as
-- 20260821_comp_code_product.sql. Applied with:
--   npx prisma db execute --file prisma/migrations/manual/20260824_affiliate_referral_product.sql --schema prisma/schema.prisma
--
-- Deliberately NOT a tracked migration folder: local DATABASE_URL points at the
-- same Supabase database as production, so `migrate dev` would run drift
-- detection against prod. `db execute` runs this one statement and touches no
-- migration history.
ALTER TABLE "affiliate_referrals"
  ADD COLUMN IF NOT EXISTS "product" TEXT NOT NULL DEFAULT 'shft';

-- Adding a column to an existing table needs no new RLS grants.
```

- [ ] **Step 4: Apply the migration**

Run: `npx prisma db execute --file prisma/migrations/manual/20260824_affiliate_referral_product.sql --schema prisma/schema.prisma`

Expected: exits 0, printing `Script executed successfully.` If it errors on connection, confirm `DATABASE_URL` is loaded — do NOT fall back to `prisma migrate dev`.

- [ ] **Step 5: Re-run to prove idempotency**

Run the exact same command from Step 4 a second time.

Expected: exits 0 again with the same message — `ADD COLUMN IF NOT EXISTS` makes the re-run a no-op. If this errors, the `IF NOT EXISTS` clause is missing; fix the SQL.

- [ ] **Step 6: Regenerate the Prisma client**

Run: `npx prisma generate`

Expected: `Generated Prisma Client`. Until this runs, `product` does not exist on the TypeScript client and Step 9 will fail.

- [ ] **Step 7: Stamp the product on write**

In `lib/affiliate.ts`, extend the import on line 4:

```ts
import {
  attributionCandidates,
  computeCommission,
  isSelfReferral,
  normalizeReferralProduct,
} from "@/lib/affiliate-logic"
```

Then in `recordAffiliateReferral`, add one line to the `prisma.affiliateReferral.create` data object, directly after `source: candidate.source,`:

```ts
            currency: session.currency ?? "usd",
            source: candidate.source,
            // All three checkouts set metadata.product (shft | drft | bundle).
            product: normalizeReferralProduct(session.metadata?.product),
```

Change nothing else in this function — the P2002 idempotency catch, the self-referral guard, and the `sendInstantCommission` call all stay as they are.

- [ ] **Step 8: Expose the product on read**

In `lib/affiliate.ts`, add `product` to the `AffiliateStats` interface's `referrals` member, after `createdAt`:

```ts
  referrals: {
    id: string
    createdAt: Date
    product: string
    grossAmountCents: number
    commissionCents: number
    source: string
    refundedAt: Date | null
    paidOut: boolean
  }[]
```

And to the mapping at the end of `getAffiliateStats`, in the same position:

```ts
    referrals: referrals.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      product: r.product,
      grossAmountCents: r.grossAmountCents,
      commissionCents: r.commissionCents,
      source: r.source,
      refundedAt: r.refundedAt,
      paidOut: isPaid(r),
    })),
```

Leave `salesCount`, `grossCents`, `commissionCents`, `owedCents`, and `refundedAfterPayoutCents` untouched — product does not affect any total.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS with no errors. This is the real verification that the generated client picked up the column — if `product` is missing from the client, this fails with `Object literal may only specify known properties` on the create call.

- [ ] **Step 10: Re-run the logic tests**

Run: `npx tsx scripts/test-affiliate-logic.ts`

Expected: PASS, `All affiliate-logic tests passed`. Nothing here should have changed; this confirms Task 1 still holds.

- [ ] **Step 11: Lint the changed file**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npx eslint lib/affiliate.ts`

Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/manual/20260824_affiliate_referral_product.sql lib/affiliate.ts
git commit -m "feat: record which product each affiliate referral sold"
```

---

### Task 3: Dashboard — per-product links, product column, copy

**Files:**
- Modify: `components/affiliate/AffiliateDashboard.tsx` (link derivation line 28; eyebrow line 39; subhead line 44-46; link card lines 48-61; sales table header lines 119-125 and body lines 128-138)

**Interfaces:**
- Consumes: `AffiliateStats["referrals"][number].product: string` from Task 2. The component's existing props (`affiliate`, `stats`, `baseUrl`, `payout`, `connectToken`) do not change — no caller needs updating.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace the single hardcoded link with store + per-plugin links**

In `components/affiliate/AffiliateDashboard.tsx`, replace line 28:

```ts
  const link = `${baseUrl}/shft?ref=${affiliate.code}`
```

with:

```ts
  // /plugins is the storefront listing both plugins and the bundle. The
  // per-plugin links are for creators making a video about one specific plugin;
  // ?ref= is captured in the root layout, so any page URL would work.
  const storeLink = `${baseUrl}/plugins?ref=${affiliate.code}`
  const pluginLinks = [
    { name: "shft", url: `${baseUrl}/shft?ref=${affiliate.code}` },
    { name: "drft", url: `${baseUrl}/drft?ref=${affiliate.code}` },
  ]
```

- [ ] **Step 2: Update the eyebrow and subhead**

Replace `shft affiliate` on line 39 with `creator program`, and the subhead on line 45. The block becomes:

```tsx
      <p className="text-xs uppercase tracking-widest mb-1" style={label}>
        creator program
      </p>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
        {affiliate.name}
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
        Share your link or code — sales on any plugin attribute automatically and show up here.
      </p>
```

- [ ] **Step 3: Rebuild the link card**

Replace the whole link card (lines 48-61, the `<div>` containing "Your link" through the code paragraph) with:

```tsx
      <div className="rounded-xl border p-4 sm:p-5 text-sm" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={label}>
          Your link
        </p>
        <p className="select-all break-all font-medium" style={{ ...mono, color: "var(--primary)" }}>
          {storeLink}
        </p>
        <p className="text-xs uppercase tracking-widest mt-4 mb-2" style={label}>
          Linking to one plugin?
        </p>
        <ul className="space-y-1">
          {pluginLinks.map((plugin) => (
            <li key={plugin.name} className="flex flex-wrap items-baseline gap-x-3">
              <span className="w-10 shrink-0" style={{ ...mono, color: "var(--muted)" }}>
                {plugin.name}
              </span>
              <span className="select-all break-all font-medium" style={{ ...mono, color: "var(--primary)" }}>
                {plugin.url}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs uppercase tracking-widest mt-4 mb-2" style={label}>
          Your code — buyers can type it at checkout
        </p>
        <p className="select-all font-medium" style={{ ...mono, color: "var(--primary)" }}>
          {affiliate.code}
        </p>
      </div>
```

The primary store link keeps visual priority: it sits first, directly under "Your link", while the per-plugin pair is indented under a secondary label inside the same card.

- [ ] **Step 4: Add the Product column to the sales table**

In the table header, add a `Product` cell between `Date` and `Sale`:

```tsx
              <tr className="text-[11px] uppercase tracking-wide" style={label}>
                <th className="px-4 py-2 font-normal">Date</th>
                <th className="px-4 py-2 font-normal">Product</th>
                <th className="px-4 py-2 font-normal">Sale</th>
                <th className="px-4 py-2 font-normal">Your cut</th>
                <th className="px-4 py-2 font-normal">Via</th>
                <th className="px-4 py-2 font-normal">Status</th>
              </tr>
```

And the matching body cell, in the same position:

```tsx
                <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-2" style={mono}>
                    {r.product}
                  </td>
                  <td className="px-4 py-2">{usd(r.grossAmountCents)}</td>
                  <td className="px-4 py-2 font-medium">{usd(r.commissionCents)}</td>
                  <td className="px-4 py-2">{r.source === "code" ? "typed code" : "link"}</td>
                  <td className="px-4 py-2" style={r.refundedAt ? { opacity: 0.55 } : undefined}>
                    {r.refundedAt ? "refunded" : r.paidOut ? "paid" : "pending payout"}
                  </td>
                </tr>
```

`r.product` is already lowercase from `normalizeReferralProduct` — do not add `toUpperCase()` or capitalization.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS. A failure on `r.product` means Task 2 Step 8 was skipped.

- [ ] **Step 6: Lint the changed file**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npx eslint components/affiliate/AffiliateDashboard.tsx`

Expected: no errors.

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev`, then open `http://localhost:3000/affiliate` signed in as an account linked to an affiliate record.

Expected: eyebrow reads `creator program`; the card shows a `/plugins?ref=` link with `shft` and `drft` links beneath it; the sales table has a Product column showing lowercase product names. Existing referrals show `shft` (the column default).

If `npm run dev` hangs with no output, that is the known iCloud dataless-file problem in `~/Documents` — retry, or run from the `~/Developer/thesampledig` clone. It is not caused by this change.

- [ ] **Step 8: Commit**

```bash
git add components/affiliate/AffiliateDashboard.tsx
git commit -m "feat: creator dashboard covers shft, drft, and the bundle"
```

---

### Task 4: Remaining shft-only copy

Copy and one link. No logic, no types.

**Files:**
- Modify: `app/affiliate/page.tsx:48` (invite-only gate text)
- Modify: `components/affiliate/AdminAffiliates.tsx:210` (eyebrow), `:358` (per-affiliate ref link)

**Interfaces:**
- Consumes: nothing
- Produces: nothing

- [ ] **Step 1: Update the invite-only gate copy**

In `app/affiliate/page.tsx`, replace the `Note` text on line 48:

```tsx
      <Note text="The creator program is invite-only. If you make videos and want in, reach out via the Discord — otherwise, nothing to see here." />
```

- [ ] **Step 2: Update the admin eyebrow**

In `components/affiliate/AdminAffiliates.tsx`, replace `shft affiliate program` on line 210:

```tsx
      <p className="text-xs uppercase tracking-widest mb-1" style={labelStyle}>
        creator program
      </p>
```

Leave the `<h1>Affiliates</h1>` beneath it and the "Invite creators, track their sales, and record payouts." subhead unchanged — both are already product-neutral.

- [ ] **Step 3: Point the admin ref link at the storefront**

In `components/affiliate/AdminAffiliates.tsx`, replace the `refLink` on line 358:

```ts
  const refLink = `${baseUrl}/plugins?ref=${a.code}`
```

Leave `dashboardLink` on the line above unchanged. Do not add a Product column to the admin sales view — per-product admin reporting is out of scope.

- [ ] **Step 4: Confirm no shft-only affiliate copy remains**

Run: `rg -n "shft affiliate|/shft\?ref=" app components lib`

Expected: no matches. Any hit is a spot this plan missed — fix it before committing.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Lint the changed files**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npx eslint app/affiliate/page.tsx components/affiliate/AdminAffiliates.tsx`

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/affiliate/page.tsx components/affiliate/AdminAffiliates.tsx
git commit -m "feat: rename the affiliate program to the creator program"
```

---

## Final verification

- [ ] `npx tsx scripts/test-affiliate-logic.ts` → `All affiliate-logic tests passed`
- [ ] `npx tsc --noEmit` → clean
- [ ] `rg -n "shft affiliate|/shft\?ref=" app components lib` → no matches
- [ ] `/affiliate` renders the store link, both plugin links, and the Product column
- [ ] `/admin/affiliates` eyebrow reads `creator program` and Manage shows a `/plugins?ref=` link
- [ ] `git diff main --stat` touches only the eight files in the spec's "Files touched" list
