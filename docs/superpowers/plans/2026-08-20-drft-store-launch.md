# drft Store Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship drft to sampleroll.com — a CRT-dark landing page at `/drft`, a `/plugins` storefront with bundle + crossgrade commerce, and the backend to sell all of it.

**Architecture:** Clone-and-retheme of the existing shft stack. drft gets its own page directory and mirrored API routes; the Stripe webhook generalizes from a hardcoded shft branch to a product-grant map (`shft` / `drft` / `bundle`); all display prices centralize in `lib/products.ts`. Zero restructuring of the live shft page beyond a minimal crossgrade-price diff.

**Tech Stack:** Next.js (App Router, webpack build), CSS Modules, Prisma + Postgres, Stripe Checkout (one-time payments), NextAuth (`@/lib/auth`), Meta Pixel. Assets rendered from the plugin itself via `trak_snapshot` in the CRTV repo.

**Spec:** `docs/superpowers/specs/2026-08-20-drft-store-launch-design.md`

## Global Constraints

- **Repos:** site = `/Users/troycarson/Documents/Cursor Projects/thesampledig` (branch `main`); plugin = `/Users/troycarson/Documents/JUCE Projects/CRTV` (asset generation only — do not commit anything there).
- **Prices (exact):** shft $19 / $39 MSRP; drft $19 / $39 MSRP; bundle $34, struck $38, "$78 MSRP" as secondary context, limited time; crossgrade $15, struck $19, symmetric both directions.
- **Env vars (checkout stays dormant with 503 until set):** `STRIPE_DRFT_PRICE_ID`, `STRIPE_BUNDLE_PRICE_ID`, `STRIPE_DRFT_CROSSGRADE_PRICE_ID`, `STRIPE_SHFT_CROSSGRADE_PRICE_ID` (existing: `STRIPE_SECRET_KEY`, `STRIPE_SHFT_PRICE_ID`).
- **drft palette (from the plugin's chassis):** bg `#191714`, panel `#221f1a`, seam `#0a0908`, cream `#efe9dc`, silk `#a89c86`, silk-dim `#6e6557`, LED green `#7fae4a`, LED amber `#d99a2b`, LED red `#c8402e`.
- **No test framework exists in this repo** (verified: package.json has no jest/vitest). Verification per task = `npm run lint` + `npm run build` (runs tsc) + the manual checks written into each task. Do not introduce a test framework.
- **License keys are never regenerated** on an existing Purchase row — preserve the upsert + `updateMany where licenseKey: null` pattern everywhere it appears.
- **drft copy:** platform line separators are plain ASCII `" - "` (e.g. `One-time purchase - macOS & Windows - VST3 / AU / Standalone`). drft ships macOS (VST3 / AU / Standalone) + Windows (VST3 / Standalone).
- **Knob/capability titles are UPPERCASE mono** in the plugin's silk-screen style — monospace, uppercase, letter-spaced (`TAPE SPEED`, `BASS MONO`, never `Tape speed`) — matching the chassis silk labels (Troy's request, confirmed against the real UI).
- **The six character knobs are BURN, DRIFT, BEND, DROPOUT, WASH, NOISE** (verified against the rendered plugin UI). Never write "bend, drift, burn, wash, drop" in copy — those are `trak_snapshot` CLI arg names, and the CLI order (`bend drift burn wash drop`) differs from the UI panel order. drift's visual is a blurred echo trail (2026-08-20 change), not a shake — copy may lean on that.
- Commit after every task with the message given in the task.

---

### Task 1: Pricing + drft product registry (`lib/products.ts`)

**Files:**
- Modify: `lib/products.ts`

**Interfaces:**
- Consumes: existing `ProductDef` / `ProductAsset` types in the same file.
- Produces: `PRICING` const (shape below) — imported by Tasks 7, 8, 9. `PRODUCTS.drft` — makes `/products` downloads render with zero page changes (that page already calls `getProduct(purchase.product)`).

- [ ] **Step 1: Add the `PRICING` export**

At the top of `lib/products.ts` (after the imports/comment block, before `PRODUCTS`):

```ts
// Display prices for the store pages. Stripe charges whatever the price IDs in
// the env are configured to — keep these in sync with the Stripe dashboard.
export const PRICING = {
  shft: { price: 19, msrp: 39 },
  drft: { price: 19, msrp: 39 },
  // struck $38 = the two sale prices; "$78 MSRP" is secondary context only.
  bundle: { price: 34, compareAt: 38, msrp: 78 },
  // Own one plugin, buy the other: $19 + $15 = $34 — exactly the bundle deal.
  crossgrade: { price: 15, compareAt: 19 },
} as const
```

- [ ] **Step 2: Add the drft `ProductDef`**

Inside `PRODUCTS`, after the `shft` entry:

```ts
  drft: {
    id: "drft",
    name: "drft",
    version: "1.0.0",
    blurb: "VHS / CRT circuit-bend video-sound effect — macOS (VST3 / AU / Standalone) & Windows (VST3 / Standalone).",
    changelog: [
      {
        version: "1.0.0",
        notes: [
          "First release. Six character knobs — burn, drift, bend, dropout, wash, noise — over a true-16:9 CRT that plays your video, a GIF, or your live camera through the effect.",
          "Dropouts tear the picture and the sound in the same instant, feed lets the picture drive the sound, and REC exports what you see and hear as a real MP4.",
          "Your licence key is on this page, just below the download buttons — paste it into drft the first time you open it. One key covers 3 machines.",
        ],
      },
    ],
    assets: [
      {
        id: "installer",
        label: "drft installer — macOS",
        key: process.env.DRFT_INSTALLER_KEY || "drft/drft-1.0.0.pkg",
        filename: "drft-1.0.0.pkg",
      },
      {
        id: "installer-win",
        label: "drft installer — Windows",
        key: process.env.DRFT_INSTALLER_WIN_KEY || "drft/drft-1.0.0-setup.exe",
        filename: "drft-1.0.0-setup.exe",
      },
      {
        id: "manual",
        label: "User manual (PDF)",
        key: process.env.DRFT_MANUAL_KEY || "drft/drft-manual-v1.0.pdf",
        filename: "drft-manual-v1.0.pdf",
      },
    ],
  },
```

(If no manual ships at launch, the entry stays — `/products` renders a download button that 404s only if clicked before upload; the upload script in Task 10 can upload any subset. Leave it in.)

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: both clean. (Build is slow; that's normal for this repo.)

- [ ] **Step 4: Commit**

```bash
git add lib/products.ts
git commit -m "feat: drft product def + centralized PRICING in lib/products.ts"
```

---

### Task 2: drft API routes — ownership, claim, checkout (with crossgrade)

**Files:**
- Create: `app/api/drft/ownership/route.ts`
- Create: `app/api/drft/claim/route.ts`
- Create: `app/api/drft/checkout/route.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`, `prisma` from `@/lib/db`, `generateLicenseKey` from `@/lib/license-key`, `recordAffiliateReferral` from `@/lib/affiliate`, `normalizeAffiliateCode` from `@/lib/affiliate-logic`, `readAttributionMetadata` from `@/lib/attribution-snapshot` — all exactly as `app/api/shft/*` uses them.
- Produces (consumed by Tasks 7, 8):
  - `GET /api/drft/ownership` → `{ owned: boolean }`
  - `POST /api/drft/checkout` → 200 `{ url }` | 401 | 409 | 503 (dormant)
  - `POST /api/drft/claim` body `{ sessionId }` → `{ ok: true }` | 4xx/5xx
  - Success URLs carry `&paid=15|19` for the Meta Pixel value (crossgrade vs full price).

- [ ] **Step 1: Create `app/api/drft/ownership/route.ts`**

```ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Does the signed-in user already own drft? Used by the landing/store pages to
// swap the Buy button for a Download link. Returns { owned: false } logged out.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ owned: false })
  }
  const purchase = await prisma.purchase.findUnique({
    where: { userId_product: { userId: session.user.id, product: "drft" } },
  })
  return NextResponse.json({ owned: Boolean(purchase) })
}
```

- [ ] **Step 2: Create `app/api/drft/claim/route.ts`**

Identical logic to `app/api/shft/claim/route.ts` with the product string swapped:

```ts
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordAffiliateReferral } from "@/lib/affiliate"
import { generateLicenseKey } from "@/lib/license-key"

// Called by the success page with the Stripe checkout session id. Confirms the
// session is a paid drft purchase belonging to the signed-in user, then records
// the Purchase immediately (self-heals if the webhook is delayed) so the
// /products page shows the download right away.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 })
  }

  let sessionId: string | undefined
  try {
    sessionId = (await request.json())?.sessionId
  } catch {
    /* handled below */
  }
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "Missing session id." }, { status: 400 })
  }

  try {
    const stripe = new Stripe(secret)
    const checkout = await stripe.checkout.sessions.retrieve(sessionId)
    const paid = checkout.payment_status === "paid"
    const isDrft = checkout.metadata?.product === "drft"
    const buyerId = checkout.client_reference_id ?? checkout.metadata?.userId
    if (!paid || !isDrft || buyerId !== session.user.id) {
      return NextResponse.json({ error: "No completed drft purchase for your account." }, { status: 403 })
    }

    const purchase = await prisma.purchase.upsert({
      where: { userId_product: { userId: session.user.id, product: "drft" } },
      create: {
        userId: session.user.id,
        product: "drft",
        stripeSessionId: checkout.id,
        licenseKey: generateLicenseKey(),
      },
      update: { stripeSessionId: checkout.id },
    })
    // The webhook and this route can run concurrently on the same purchase.
    // updateMany with licenseKey:null in the WHERE means the loser writes
    // nothing, so the buyer is never emailed a key that lost the race.
    if (!purchase.licenseKey) {
      await prisma.purchase.updateMany({
        where: { id: purchase.id, licenseKey: null },
        data: { licenseKey: generateLicenseKey() },
      })
    }
    await recordAffiliateReferral(checkout, purchase.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[drft claim]", e)
    return NextResponse.json({ error: "Could not verify your purchase." }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create `app/api/drft/checkout/route.ts`**

Clone of shft's checkout with three deliberate differences: product string, crossgrade price selection, and `&paid=` on the success URL:

```ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"
import { readAttributionMetadata } from "@/lib/attribution-snapshot"
import { PRICING } from "@/lib/products"

// One-time checkout for the drft plugin. Requires login so the purchase can be
// tied to an account and surfaced on the /products page.
// Dormant until BOTH env vars are set:
//   STRIPE_SECRET_KEY     — already used by the subscription checkout
//   STRIPE_DRFT_PRICE_ID  — the one-time price for drft
// Crossgrade: a user who already owns shft checks out against
// STRIPE_DRFT_CROSSGRADE_PRICE_ID ($15) instead, falling back to the full
// price ID if the crossgrade one isn't configured yet.
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const fullPriceId = process.env.STRIPE_DRFT_PRICE_ID
  if (!secret || !fullPriceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 })
  }

  // Already own it? Don't let them pay twice — send them to their downloads.
  const existing = await prisma.purchase.findUnique({
    where: { userId_product: { userId: session.user.id, product: "drft" } },
  })
  if (existing) {
    return NextResponse.json({ error: "already_owned" }, { status: 409 })
  }

  // Crossgrade: owning shft earns the $15 complete-the-pair price. Ownership is
  // checked server-side here — nothing client-controlled picks the price.
  const ownsShft = Boolean(
    await prisma.purchase.findUnique({
      where: { userId_product: { userId: session.user.id, product: "shft" } },
    })
  )
  const crossgradeId = process.env.STRIPE_DRFT_CROSSGRADE_PRICE_ID
  const priceId = ownsShft && crossgradeId ? crossgradeId : fullPriceId
  const paidValue = ownsShft && crossgradeId ? PRICING.crossgrade.price : PRICING.drft.price

  // Affiliate attribution: forward a valid ?ref= cookie code into session
  // metadata; the webhook re-validates it against an active affiliate.
  let affiliateCode: string | null = null
  try {
    const cookieStore = await cookies()
    const raw = normalizeAffiliateCode(cookieStore.get("shft_ref")?.value)
    if (raw) {
      const affiliate = await prisma.affiliate.findUnique({ where: { code: raw } })
      if (affiliate?.active) affiliateCode = raw
    }
  } catch (e) {
    console.error("[drft checkout] affiliate cookie read failed", e)
  }

  try {
    const stripe = new Stripe(secret)
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    const attrMetadata = await readAttributionMetadata()

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/drft?purchase=success&session_id={CHECKOUT_SESSION_ID}&paid=${paidValue}`,
      cancel_url: `${baseUrl}/drft?purchase=canceled`,
      customer_creation: "always",
      customer_email: session.user.email || undefined,
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      client_reference_id: session.user.id,
      metadata: {
        product: "drft",
        userId: session.user.id,
        ...(affiliateCode ? { affiliateCode } : {}),
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

    return NextResponse.json({ url: checkoutSession.url })
  } catch (e) {
    console.error("[drft checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: clean. Then start `npm run dev:direct` and check:
- `curl -s localhost:3000/api/drft/ownership` → `{"owned":false}`
- `curl -s -X POST localhost:3000/api/drft/checkout` → `{"error":"Checkout opens at launch."}` (503, dormant — env var unset locally)

- [ ] **Step 5: Commit**

```bash
git add app/api/drft
git commit -m "feat: drft checkout/claim/ownership API routes with shft-owner crossgrade pricing"
```

---

### Task 3: shft checkout crossgrade (minimal diff to the live route)

**Files:**
- Modify: `app/api/shft/checkout/route.ts`

**Interfaces:**
- Produces: shft checkout now charges `STRIPE_SHFT_CROSSGRADE_PRICE_ID` ($15) when the buyer owns drft, and its success URL carries `&paid=15|19` (consumed by Task 9's pixel change).

- [ ] **Step 1: Add the import**

At the top of `app/api/shft/checkout/route.ts`, add to the existing imports:

```ts
import { PRICING } from "@/lib/products"
```

- [ ] **Step 2: Add crossgrade selection after the already-owned check**

Directly after the `if (existing) { ... 409 ... }` block, insert:

```ts
  // Crossgrade: owning drft earns the $15 complete-the-pair price. Ownership is
  // checked server-side here — nothing client-controlled picks the price.
  const ownsDrft = Boolean(
    await prisma.purchase.findUnique({
      where: { userId_product: { userId: session.user.id, product: "drft" } },
    })
  )
  const crossgradeId = process.env.STRIPE_SHFT_CROSSGRADE_PRICE_ID
  const chosenPriceId = ownsDrft && crossgradeId ? crossgradeId : priceId
  const paidValue = ownsDrft && crossgradeId ? PRICING.crossgrade.price : PRICING.shft.price
```

- [ ] **Step 3: Use the chosen price and tag the success URL**

In the `stripe.checkout.sessions.create` call, change exactly two lines:

```ts
      line_items: [{ price: chosenPriceId, quantity: 1 }],
      success_url: `${baseUrl}/shft?purchase=success&session_id={CHECKOUT_SESSION_ID}&paid=${paidValue}`,
```

(Everything else in the route stays byte-identical — this is a live, selling code path.)

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: clean. With no `STRIPE_SHFT_CROSSGRADE_PRICE_ID` set, behavior is identical to before (falls back to `priceId`), so production is safe even if this deploys before the Stripe price exists.

- [ ] **Step 5: Commit**

```bash
git add app/api/shft/checkout/route.ts
git commit -m "feat: shft checkout crossgrade price for drft owners"
```

---

### Task 4: Bundle API routes — checkout with guard rails, claim granting both

**Files:**
- Create: `app/api/bundle/checkout/route.ts`
- Create: `app/api/bundle/claim/route.ts`

**Interfaces:**
- Produces (consumed by Task 8):
  - `POST /api/bundle/checkout` → 200 `{ url }` | 401 `{ error: "auth_required" }` | 409 `{ error: "already_owned" }` (owns both) | 409 `{ error: "own_one", owns: "shft" | "drft" }` (client refreshes to crossgrade state) | 503 dormant.
  - `POST /api/bundle/claim` body `{ sessionId }` → `{ ok: true }`; upserts BOTH Purchase rows.
  - Success URL: `/plugins?purchase=success&session_id={CHECKOUT_SESSION_ID}&paid=34`; cancel: `/plugins?purchase=canceled`.
- Affiliate: one referral per checkout session — recorded against the shft purchase row only (the `AffiliateReferral` ↔ `Purchase` relation is one-to-one; crediting both rows would double-pay).

- [ ] **Step 1: Create `app/api/bundle/checkout/route.ts`**

```ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"
import { readAttributionMetadata } from "@/lib/attribution-snapshot"
import { PRICING } from "@/lib/products"

// One-time checkout for the shft + drft bundle. One Stripe price, one line
// item; the webhook (and /api/bundle/claim) grant BOTH products.
// Guard rails: owners of both get 409 already_owned; owners of one get 409
// own_one — the storefront swaps to the $15 crossgrade offer instead, so no
// path through here can double-charge.
// Dormant until STRIPE_SECRET_KEY + STRIPE_BUNDLE_PRICE_ID are set.
export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_BUNDLE_PRICE_ID
  if (!secret || !priceId) {
    return NextResponse.json({ error: "Checkout opens at launch." }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 })
  }

  const owned = await prisma.purchase.findMany({
    where: { userId: session.user.id, product: { in: ["shft", "drft"] } },
    select: { product: true },
  })
  const ownedSet = new Set(owned.map((p) => p.product))
  if (ownedSet.size === 2) {
    return NextResponse.json({ error: "already_owned" }, { status: 409 })
  }
  if (ownedSet.size === 1) {
    return NextResponse.json({ error: "own_one", owns: [...ownedSet][0] }, { status: 409 })
  }

  // Affiliate attribution: forward a valid ?ref= cookie code into session
  // metadata; the webhook re-validates it against an active affiliate.
  let affiliateCode: string | null = null
  try {
    const cookieStore = await cookies()
    const raw = normalizeAffiliateCode(cookieStore.get("shft_ref")?.value)
    if (raw) {
      const affiliate = await prisma.affiliate.findUnique({ where: { code: raw } })
      if (affiliate?.active) affiliateCode = raw
    }
  } catch (e) {
    console.error("[bundle checkout] affiliate cookie read failed", e)
  }

  try {
    const stripe = new Stripe(secret)
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    const attrMetadata = await readAttributionMetadata()

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/plugins?purchase=success&session_id={CHECKOUT_SESSION_ID}&paid=${PRICING.bundle.price}`,
      cancel_url: `${baseUrl}/plugins?purchase=canceled`,
      customer_creation: "always",
      customer_email: session.user.email || undefined,
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      client_reference_id: session.user.id,
      metadata: {
        product: "bundle",
        userId: session.user.id,
        ...(affiliateCode ? { affiliateCode } : {}),
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

    return NextResponse.json({ url: checkoutSession.url })
  } catch (e) {
    console.error("[bundle checkout]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/bundle/claim/route.ts`**

```ts
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordAffiliateReferral } from "@/lib/affiliate"
import { generateLicenseKey } from "@/lib/license-key"

// Called by /plugins after a bundle purchase. Confirms the session is a paid
// bundle purchase belonging to the signed-in user, then records BOTH Purchase
// rows immediately (self-heals if the webhook is delayed).
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 })
  }

  let sessionId: string | undefined
  try {
    sessionId = (await request.json())?.sessionId
  } catch {
    /* handled below */
  }
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "Missing session id." }, { status: 400 })
  }

  try {
    const stripe = new Stripe(secret)
    const checkout = await stripe.checkout.sessions.retrieve(sessionId)
    const paid = checkout.payment_status === "paid"
    const isBundle = checkout.metadata?.product === "bundle"
    const buyerId = checkout.client_reference_id ?? checkout.metadata?.userId
    if (!paid || !isBundle || buyerId !== session.user.id) {
      return NextResponse.json({ error: "No completed bundle purchase for your account." }, { status: 403 })
    }

    // Grant both plugins. Upsert never regenerates an existing key, and the
    // updateMany-with-null-WHERE key fill is race-safe against the webhook.
    let shftPurchaseId: string | null = null
    for (const product of ["shft", "drft"] as const) {
      const purchase = await prisma.purchase.upsert({
        where: { userId_product: { userId: session.user.id, product } },
        create: {
          userId: session.user.id,
          product,
          stripeSessionId: checkout.id,
          licenseKey: generateLicenseKey(),
        },
        update: { stripeSessionId: checkout.id },
      })
      if (!purchase.licenseKey) {
        await prisma.purchase.updateMany({
          where: { id: purchase.id, licenseKey: null },
          data: { licenseKey: generateLicenseKey() },
        })
      }
      if (product === "shft") shftPurchaseId = purchase.id
    }
    // One referral per checkout session — against the shft row only (the
    // relation is one-to-one; crediting both rows would double-pay).
    if (shftPurchaseId) {
      await recordAffiliateReferral(checkout, shftPurchaseId)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[bundle claim]", e)
    return NextResponse.json({ error: "Could not verify your purchase." }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: clean. With dev server: `curl -s -X POST localhost:3000/api/bundle/checkout` → 503 dormant message.

- [ ] **Step 4: Commit**

```bash
git add app/api/bundle
git commit -m "feat: bundle checkout with own-one/own-both guard rails + claim granting both plugins"
```

---

### Task 5: Webhook product map + product-aware purchase email + product-aware license keys

**Files:**
- Modify: `lib/license-key.ts` (both functions)
- Modify: `app/api/drft/claim/route.ts` (two `generateLicenseKey()` call sites)
- Modify: `app/api/bundle/claim/route.ts` (the per-product `generateLicenseKey()` call sites inside the grant transaction)
- Modify: `lib/email.ts` (the `sendShftPurchaseEmail` function, ~line 85)
- Modify: `app/api/stripe/webhook/route.ts` (the shft branch inside `checkout.session.completed`, ~lines 48–104)

**Interfaces:**
- Consumes: `sendMailWithFallback`, `FROM`, `APP_URL` already defined in `lib/email.ts`; `generateKeycode`/`normalizeKeycode` in `lib/keycode.ts`.
- Produces: `generateLicenseKey(product?: "shft" | "drft", pick?)` (defaults `"shft"` — existing call sites stay valid); `normalizeLicenseKey` accepting both `SHFT-` and `DRFT-` keys; `sendPluginPurchaseEmail(email: string, items: { product: "shft" | "drft"; licenseKey: string | null }[])` in `lib/email.ts`. Webhook grants via `PLUGIN_GRANTS` map: `shft` → `["shft"]`, `drft` → `["drft"]`, `bundle` → `["shft", "drft"]`.

- [ ] **Step 0: Product-aware license keys**

Replace the two functions in `lib/license-key.ts`:

```ts
const KEY_PREFIX: Record<string, string> = { shft: "SHFT", drft: "DRFT" }

export function generateLicenseKey(
  product: "shft" | "drft" = "shft",
  pick: (max: number) => number = randomInt
): string {
  return generateKeycode(KEY_PREFIX[product], pick)
}

/** Accepts keys of either product — the caller resolves which product via the
    Purchase row the key belongs to. */
export function normalizeLicenseKey(input: string): string | null {
  return normalizeKeycode("SHFT", input) ?? normalizeKeycode("DRFT", input)
}
```

Then update the drft-minting call sites so drft keys read `DRFT-…`:
- `app/api/drft/claim/route.ts`: both `generateLicenseKey()` → `generateLicenseKey("drft")`.
- `app/api/bundle/claim/route.ts`: both per-product calls inside the grant loop → `generateLicenseKey(product)`.

Untouched on purpose: `app/api/shft/claim/route.ts` and `app/api/comps/redeem/route.ts` (default `"shft"` keeps their behavior identical).

- [ ] **Step 1: Confirm the only caller**

Run: `grep -rn "sendShftPurchaseEmail" app lib scripts`
Expected: exactly two hits — the definition in `lib/email.ts` and the call in `app/api/stripe/webhook/route.ts`. If anything else calls it, stop and update this task before proceeding.

- [ ] **Step 2: Replace `sendShftPurchaseEmail` with `sendPluginPurchaseEmail`**

In `lib/email.ts`, replace the whole `sendShftPurchaseEmail` function with:

```ts
const PLUGIN_EMAIL_COPY: Record<string, { formats: string }> = {
  shft: { formats: "macOS (VST3 / AU / Standalone) or Windows (VST3 / Standalone)" },
  drft: { formats: "macOS (VST3 / AU / Standalone) or Windows (VST3 / Standalone)" },
}

/** Purchase receipt for one or more plugins (a bundle purchase sends one email
    covering both keys). Key blocks are omitted when a key is missing rather
    than printing an empty box — /products always shows the real one. */
export async function sendPluginPurchaseEmail(
  email: string,
  items: { product: "shft" | "drft"; licenseKey: string | null }[]
) {
  const url = `${APP_URL}/products`
  const names = items.map((i) => i.product).join(" + ")

  const keyBlocks = items
    .filter((i) => i.licenseKey)
    .map(
      (i) => `
        <p style="color: #555; margin-bottom: 8px; font-size: 14px;">Your ${i.product} licence key</p>
        <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px;
                  letter-spacing: 1px; background: #f4f4f4; border: 1px solid #e4e4e4;
                  border-radius: 8px; padding: 12px 16px; margin: 0 0 16px;">
          ${i.licenseKey}
        </p>
        <p style="color: #555; margin-bottom: 24px; font-size: 14px;">
          Paste it into ${i.product} the first time you open it. It activates up to 3 machines,
          and you can free one any time from My Products.
        </p>`
    )
    .join("")

  const downloadLines = items
    .map((i) => `<strong>${i.product}</strong> for ${PLUGIN_EMAIL_COPY[i.product]?.formats ?? "macOS & Windows"}`)
    .join(" and ")

  await sendMailWithFallback({
    from: FROM,
    to: email,
    subject: `Your ${names} download is ready`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Thanks for buying ${names}</h1>
        <p style="color: #555; margin-bottom: 24px;">
          Your purchase is complete. Head to <strong>My Products</strong> to download ${downloadLines},
          plus the user manual — any time, as many times as you need.
        </p>
        ${keyBlocks}
        <a href="${url}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
          Go to My Products
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          Sign in with this email address to see your download. Reply here if you hit any trouble and we'll sort you out.
        </p>
        <p style="color: #ccc; font-size: 12px; margin-top: 8px;">
          Or copy this link: ${url}
        </p>
      </div>
    `,
  })
}
```

(Keep everything else in `lib/email.ts` — `FROM`, `APP_URL`, `sendMailWithFallback`, other senders — untouched. Preserve the closing markup of the original function if it had more after line 125; only the one function is replaced.)

- [ ] **Step 3: Generalize the webhook's shft branch**

In `app/api/stripe/webhook/route.ts`, change the import:

```ts
import { sendPluginPurchaseEmail } from "@/lib/email"
```

(replacing `sendShftPurchaseEmail` in the import list), and replace the block that starts with `// --- shft plugin: one-time purchase, recorded against the user account. ---` and ends with its closing `break` — i.e. the whole `if (session.metadata?.product === "shft") { ... break }` — with:

```ts
        // --- Plugin purchases: single products and the bundle. -----------------
        // metadata.product → which Purchase rows to grant.
        const PLUGIN_GRANTS: Record<string, ("shft" | "drft")[]> = {
          shft: ["shft"],
          drft: ["drft"],
          bundle: ["shft", "drft"],
        }
        const grantProducts = PLUGIN_GRANTS[session.metadata?.product ?? ""]
        if (grantProducts) {
          const buyerId = session.client_reference_id ?? session.metadata?.userId
          // Hoisted: the email below is sent even when there is no buyerId, and
          // it needs the keys. Missing keys are omitted from the template rather
          // than printing something that cannot activate.
          const emailItems: { product: "shft" | "drft"; licenseKey: string | null }[] = []

          if (buyerId && typeof buyerId === "string") {
            let referralPurchaseId: string | null = null
            let first = true
            for (const product of grantProducts) {
              // stripeSessionId is @unique on Purchase: one checkout session
              // cannot stamp two rows, so only the FIRST granted product
              // carries it (bundle: shft — the same row the referral hangs
              // off). The second row is created with null, like comp grants.
              const purchase = await prisma.purchase.upsert({
                where: { userId_product: { userId: buyerId, product } },
                create: {
                  userId: buyerId,
                  product,
                  stripeSessionId: first ? session.id : null,
                  licenseKey: generateLicenseKey(product),
                },
                // Never regenerate: a buyer may already have the old key in the
                // plugin, and rotating it would deactivate them silently.
                update: first ? { stripeSessionId: session.id } : {},
              })
              first = false

              let licenseKey = purchase.licenseKey
              if (!licenseKey) {
                // The row predates licensing, or was created by an older deploy.
                //
                // Conditional update, then re-read: this route and the claim
                // routes can run concurrently on the same purchase. A
                // read-then-write would let the second mint overwrite the first,
                // so the buyer gets emailed a key that is no longer on their
                // account. With licenseKey:null in the WHERE the loser writes
                // nothing, and the re-read returns whichever key actually won.
                await prisma.purchase.updateMany({
                  where: { id: purchase.id, licenseKey: null },
                  data: { licenseKey: generateLicenseKey(product) },
                })
                const filled = await prisma.purchase.findUnique({
                  where: { id: purchase.id },
                  select: { licenseKey: true },
                })
                licenseKey = filled?.licenseKey ?? null
              }
              emailItems.push({ product, licenseKey })
              // One referral per checkout session — first granted product only
              // (the AffiliateReferral↔Purchase relation is one-to-one).
              if (!referralPurchaseId) referralPurchaseId = purchase.id
            }
            if (referralPurchaseId) {
              await recordAffiliateReferral(session, referralPurchaseId)
            }
          } else {
            console.warn("[Stripe webhook] plugin purchase missing userId")
          }
          const email = session.customer_details?.email ?? session.customer_email ?? null
          if (email) {
            try {
              await sendPluginPurchaseEmail(
                email,
                emailItems.length
                  ? emailItems
                  : grantProducts.map((product) => ({ product, licenseKey: null }))
              )
            } catch (e) {
              console.error("[Stripe webhook] plugin purchase email failed:", e)
            }
          }
          break
        }
```

Leave the rest of the `checkout.session.completed` case (the subscription path below it) and all other event types untouched.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: clean, and `grep -rn "sendShftPurchaseEmail" app lib scripts` now returns nothing.

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts app/api/stripe/webhook/route.ts
git commit -m "feat: webhook grants via product map (shft/drft/bundle), product-aware purchase email"
```

---

### Task 6: drft page assets rendered from the real plugin

**Files:**
- Create: `public/drft/hero-poster.jpg`, `public/drft/og.png`, `public/drft/tube.png`, `public/drft/knobs.png`, `public/drft/drop.png`, `public/drft/feed.png`, `public/drft/nosignal.png` (+ optionally `public/drft/rec.mp4` / `rec-poster.jpg`)

**Interfaces:**
- Produces: image/video files at the exact paths above, referenced by Task 7's `BLOCKS` array and hero. All renders come from `trak_snapshot`, which draws the REAL plugin editor.

- [ ] **Step 1: Build the snapshot tool (CRTV repo)**

```bash
cd "/Users/troycarson/Documents/JUCE Projects/CRTV"
cmake -B build -G Ninja && cmake --build build --target trak_snapshot
SNAP=$(find build -name trak_snapshot -type f -perm +111 | head -1)
echo "$SNAP"
```

- [ ] **Step 2: Render the shots**

Usage refresher: `trak_snapshot out 2.0 [bend drift burn wash drop] [media] [aspect012]`. Seconds ≥ 1.4 keeps the param OSD out of the frame. Use a scratch dir, then eyeball every PNG before copying (per the CRTV repo's own rule: always eyeball the PNG).

```bash
OUT=/tmp/drft-shots && mkdir -p $OUT && cd $OUT
"$SNAP" hero    2.0  0.7 0.6 0.5 0.4 0.6                      # heavy character — hero poster + og source
"$SNAP" knobs   2.0  0.9 0.3 0.8 0.2 0.3                      # bent + burnt — character-knobs block
"$SNAP" drop    2.0  0.2 0.2 0.1 0.1 0.9                      # dropout-slammed — dropouts block
"$SNAP" tube    2.0  0.3 0.3 0.2 0.3 0.1 "/Users/troycarson/Documents/Cursor Projects/thesampledig/dig-browser-recording.mov"   # media on the tube, light damage — tube block
"$SNAP" feed    2.0  0.4 0.5 0.3 0.7 0.2 "/Users/troycarson/Documents/Cursor Projects/thesampledig/dig-browser-recording.mov"   # media, washier settings — feed block
"$SNAP" nosignal 2.0 0.3 0.3 0.3 0.3 0.3 live                 # deterministic NO SIGNAL dead channel
TRAK_RECORD=$OUT/rec.mp4 "$SNAP" recrun 4.0 0.5 0.5 0.5 0.5 0.7   # real export-path clip for the REC block
```

(Exact knob values are taste — vary them until the five shots look distinct. If the media render fails on the .mov, use any local .mp4 instead.)

- [ ] **Step 3: Convert + copy into the site repo**

```bash
SITE="/Users/troycarson/Documents/Cursor Projects/thesampledig/public/drft" && mkdir -p "$SITE"
sips -s format jpeg -s formatOptions 82 $OUT/hero.png --out "$SITE/hero-poster.jpg"
sips -z 630 1200 $OUT/hero.png --out "$SITE/og.png"      # 1200x630 OG crop
cp $OUT/tube.png $OUT/feed.png $OUT/knobs.png $OUT/drop.png $OUT/nosignal.png "$SITE/"
cp $OUT/rec.mp4 "$SITE/rec.mp4" 2>/dev/null || true
[ -f "$SITE/rec.mp4" ] && sips -s format jpeg $OUT/drop.png --out "$SITE/rec-poster.jpg"
```

Then LOOK at every file in `public/drft/` (open them) — confirm no param OSD overlay, no blank tubes (except `nosignal.png`, which should show the dead-channel screen), and that the five block images are visually distinct. Re-render with different knob values if not.

- [ ] **Step 4: Commit**

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
git add public/drft
git commit -m "feat: drft page assets rendered from the plugin via trak_snapshot"
```

---

### Task 7: drft landing page (`/drft`)

**Files:**
- Create: `app/drft/page.tsx`
- Create: `app/drft/DrftLanding.tsx`
- Create: `app/drft/drft.module.css`

**Interfaces:**
- Consumes: `PRICING` from `@/lib/products` (Task 1); `/api/drft/{checkout,claim,ownership}` (Task 2); `/api/shft/ownership` (existing); `trackMeta` from `@/lib/meta-pixel`; `SiteNav` from `@/components/SiteNav`; assets from Task 6.
- Produces: the `/drft` route. Hero expects Troy's video at `public/drft/hero.mp4` — until that file exists the `<video poster>` shows `hero-poster.jpg` (a missing mp4 source just never starts playback; the poster stays).

- [ ] **Step 1: Create `app/drft/page.tsx`**

```tsx
import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import DrftLanding from "./DrftLanding"
import styles from "./drft.module.css"

export const metadata: Metadata = {
  title: "drft — VHS / CRT Circuit-Bend FX Plugin | Sample Roll",
  description:
    "drft is a VHS / CRT circuit-bend effect. Six character knobs — burn, drift, bend, dropout, wash, noise — run your sound through a dying tape machine while a true-16:9 CRT plays your video, a GIF, or your live camera through the same damage. Press REC and export what you see and hear as a real MP4. VST3 / AU / Standalone for macOS & Windows.",
  openGraph: {
    title: "drft — VHS / CRT Circuit-Bend FX",
    description:
      "Your sound through a dying tape machine, your picture on a CRT wired to the same damage. VST3 / AU / Standalone for macOS & Windows.",
    images: ["/drft/og.png"],
    type: "website",
  },
  alternates: { canonical: "/drft" },
}

export default function DrftPage() {
  return (
    <div className={styles.page}>
      <header className="site-header w-full shrink-0">
        <SiteNav />
      </header>
      <DrftLanding />
    </div>
  )
}
```

- [ ] **Step 2: Create `app/drft/DrftLanding.tsx`**

```tsx
"use client"

import { useEffect, useState, type ReactNode } from "react"
import styles from "./drft.module.css"
import { trackMeta } from "@/lib/meta-pixel"
import { PRICING } from "@/lib/products"

/* ---- capability icons (thin-line, matching the hardware look) ------------ */
function IconTape() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="8" cy="12" r="2.4" />
      <circle cx="16" cy="12" r="2.4" />
      <path d="M8 14.4h8" />
    </svg>
  )
}
function IconDice() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" />
      <circle cx="9" cy="15" r="1.2" fill="currentColor" />
    </svg>
  )
}
function IconPreset() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h10" />
      <circle cx="17" cy="17" r="1.4" fill="currentColor" />
    </svg>
  )
}
function IconMono() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12h4l2-6 3 12 3-9 2 3h4" />
    </svg>
  )
}
function IconSync() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4M7 9l3 2-3 2" />
    </svg>
  )
}
function IconPower() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v8" />
      <path d="M6.2 6.2a8 8 0 1 0 11.6 0" />
    </svg>
  )
}

// Titles stay UPPERCASE — silk-screen style, like the labels on the chassis.
const CAPS: { icon: ReactNode; title: string; desc: string }[] = [
  { icon: <IconTape />, title: "TAPE SPEED", desc: "Slow the whole machine down. Pitch, picture and damage all follow, like a deck running on a dying motor." },
  { icon: <IconDice />, title: "DICE", desc: "One click re-rolls the character knobs into a new broken machine. Keep rolling until you find the one." },
  { icon: <IconPreset />, title: "PRESETS", desc: "A factory bank of broken machines, plus your own saves - user presets live in a plain folder on disk." },
  { icon: <IconMono />, title: "BASS MONO", desc: "All the wobble and smear stays up top - the low end folds to mono so the bottom never goes seasick." },
  { icon: <IconSync />, title: "VIDEO SYNC", desc: "The tube locks to your host transport, so the picture scrubs, loops and lands exactly with the session." },
  { icon: <IconPower />, title: "POWER SWITCH", desc: "A real rocker on the chassis. Flip it and the tube snaps to black while the sound passes clean." },
]

const BLOCKS: { title: string; desc: string; img: string; alt: string; video?: string; poster?: string }[] = [
  {
    title: "A picture behind the sound",
    desc: "Drop a video, a GIF or a still onto the tube - or go live from your camera - and it plays through the same circuit as your audio. The screen is a true 16:9 CRT, so what you see in the plugin is exactly what an export frames at 1920x1080.",
    img: "/drft/tube.png",
    alt: "drft's CRT tube playing video through the effect",
  },
  {
    title: "Six knobs of character",
    desc: "BURN scorches it hot, DRIFT lets the tape wander and leaves a blurred echo smearing behind the picture, BEND warps and skews, DROPOUT punches holes in the take, WASH softens everything to mush, NOISE buries it in snow. Sound and picture ride the same knobs - turn one and you hear it and see it move together.",
    img: "/drft/knobs.png",
    alt: "drft character knobs - burn, drift, bend, dropout, wash, noise",
  },
  {
    title: "When it drops, it drops everywhere",
    desc: "Dropouts are wired straight across the machine: the instant one punches a hole in the audio, the picture tears with it. Not a visualizer guessing along - one event, heard and seen.",
    img: "/drft/drop.png",
    alt: "drft dropout tearing the picture and the audio together",
  },
  {
    title: "The picture plays the sound",
    desc: "feed reads the frame - how bright, how busy, how broken - and pushes it back into the audio. A hot white flash leans on the sound; a dead channel goes quiet. Run a music video through it and the mix starts breathing with the footage.",
    img: "/drft/feed.png",
    alt: "drft feed - frame statistics modulating the audio",
  },
  {
    title: "Press REC, keep the take",
    desc: "The REC key captures the tube and the sound together and writes a real MP4 - the export re-renders every frame through the same pipeline, so the file matches what you watched. Circuit-bent music videos straight out of the plugin.",
    img: "/drft/drop.png",
    video: "/drft/rec.mp4",
    poster: "/drft/rec-poster.jpg",
    alt: "drft REC export - MP4 written from the plugin",
  },
]

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is drft?",
    a: "drft is a VHS / CRT circuit-bend effect. Six character knobs - burn, drift, bend, dropout, wash, noise - run your audio through a dying tape machine, while a true-16:9 CRT on the panel plays your video, a GIF or your live camera through the same damage. Dropouts tear picture and sound together, feed lets the picture push back into the audio, and REC exports what you see and hear as a real MP4.",
  },
  {
    q: "Which formats does it come in, and will it work in my DAW?",
    a: "drft runs on macOS (Apple Silicon and Intel) as VST3, AU, and Standalone, and on Windows as VST3 and Standalone - so it works in DAWs like Ableton Live, Logic Pro, FL Studio, Bitwig, Studio One and more.",
  },
  {
    q: "Do I need to use video?",
    a: "No. drft is a full audio effect on its own - the tube just shows the dead channel until you feed it something. Load media or a camera when you want the picture, and press REC when you want to keep it.",
  },
  {
    q: "Is it a subscription?",
    a: "No. drft is a one-time purchase with free updates - buy it once, keep it forever. The $19 launch price is a limited discount off the regular $39. Already own shft? You get drft for $15.",
  },
]

async function startCheckout(): Promise<{ url: string | null; needsAuth: boolean; alreadyOwned: boolean }> {
  try {
    const res = await fetch("/api/drft/checkout", { method: "POST" })
    if (res.status === 401) return { url: null, needsAuth: true, alreadyOwned: false }
    if (res.status === 409) return { url: null, needsAuth: false, alreadyOwned: true }
    const data = await res.json().catch(() => ({}))
    if (res.ok && typeof data?.url === "string") return { url: data.url, needsAuth: false, alreadyOwned: false }
  } catch {
    /* fall through */
  }
  return { url: null, needsAuth: false, alreadyOwned: false }
}

/** Buy Now button. Shows the crossgrade price to shft owners. Kicks off Stripe
    checkout; sends logged-out users to sign in first, owners to their
    downloads, and falls back to "Opens at launch" until the price env is set. */
function BuyButton({ className, owned, ownsShft }: { className: string; owned: boolean; ownsShft: boolean }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (owned) {
    return (
      <a className={className} href="/products">
        You own drft — Download
      </a>
    )
  }

  const buy = async () => {
    setBusy(true)
    setFailed(false)
    const { url, needsAuth, alreadyOwned } = await startCheckout()
    if (needsAuth) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent("/drft")}`
      return
    }
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

  const price = ownsShft ? PRICING.crossgrade.price : PRICING.drft.price
  const struck = ownsShft ? PRICING.crossgrade.compareAt : PRICING.drft.msrp

  return (
    <button type="button" className={className} onClick={buy} disabled={busy}>
      {busy ? (
        "…"
      ) : failed ? (
        "Opens at launch"
      ) : (
        <>
          Buy Now — <span className={styles.priceSale}>${price}</span> <s>${struck}</s>
        </>
      )}
    </button>
  )
}

function PurchaseBanner() {
  const [canceled, setCanceled] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get("purchase")
    if (p === "canceled") {
      setCanceled(true)
      return
    }
    if (p !== "success") return

    // Meta Pixel: value rides the ?paid= param the checkout route stamped on
    // the success URL (19 full / 15 crossgrade). Fired before the redirect —
    // fbq beacons survive the navigation.
    const paid = Number(params.get("paid")) || PRICING.drft.price
    trackMeta("Purchase", { value: paid, currency: "USD", content_name: "drft", content_type: "product" })

    const sessionId = params.get("session_id")
    if (!sessionId) {
      window.location.replace("/products")
      return
    }
    fetch("/api/drft/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).finally(() => {
      window.location.replace("/products")
    })
  }, [])

  if (!canceled) return null
  return <div className={styles.bannerInfo}>Checkout canceled — no charge was made. Grab drft whenever you&apos;re ready.</div>
}

function StickyBar({ owned, ownsShft }: { owned: boolean; ownsShft: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const sentinel = document.getElementById("drft-hero-sentinel")
    if (!sentinel) return
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { rootMargin: "0px" })
    io.observe(sentinel)
    return () => io.disconnect()
  }, [])

  return (
    <div className={`${styles.stickyBar} ${show ? styles.stickyBarShow : ""}`} aria-hidden={!show}>
      <div className={styles.stickyInner}>
        <span className={styles.stickyName}>drft</span>
        <span className={styles.stickyMeta}>VHS / CRT circuit-bend FX</span>
        <span className={styles.stickySpacer} />
        <BuyButton className={styles.stickyBtn} owned={owned} ownsShft={ownsShft} />
      </div>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`${styles.faqItem} ${open ? styles.faqOpen : ""}`}>
      <button type="button" className={styles.faqQ} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {q}
        <span className={styles.faqPlus} aria-hidden>
          +
        </span>
      </button>
      <div className={styles.faqA}>
        <p className={styles.faqAInner}>{a}</p>
      </div>
    </div>
  )
}

export default function DrftLanding() {
  const [owned, setOwned] = useState(false)
  const [ownsShft, setOwnsShft] = useState(false)
  useEffect(() => {
    fetch("/api/drft/ownership")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.owned) setOwned(true)
      })
      .catch(() => {})
    fetch("/api/shft/ownership")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.owned) setOwnsShft(true)
      })
      .catch(() => {})
  }, [])

  return (
    <>
      <PurchaseBanner />
      <StickyBar owned={owned} ownsShft={ownsShft} />

      {/* ---- Hero: full-bleed looping video + wordmark + CTA -------------- */}
      <section className={styles.hero}>
        <video
          className={styles.heroMediaLayer}
          poster="/drft/hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        >
          <source src="/drft/hero.mp4" type="video/mp4" />
        </video>
        <div className={styles.heroScanlines} aria-hidden />
        <div className={styles.heroScrim} />
        <div className={styles.heroContent}>
          <p className={styles.heroOsd} aria-hidden>
            <span className={styles.recDot} /> REC - SP 00:00:19
          </p>
          <h1 className={styles.heroWordmark}>drft</h1>
          <p className={styles.heroSubtitle}>VHS / CRT circuit-bend FX</p>
          <div className={styles.heroCtaRow}>
            <BuyButton className={styles.pillLight} owned={owned} ownsShft={ownsShft} />
            <p className={styles.heroPrice}>One-time purchase - macOS &amp; Windows - VST3 / AU / Standalone</p>
          </div>
        </div>
      </section>
      {/* Out of hero flow so it doesn't affect the hero's vertical centering. */}
      <span id="drft-hero-sentinel" aria-hidden />

      {/* ---- Intro -------------------------------------------------------- */}
      <section className={styles.intro}>
        <p className={styles.eyebrow}>INSIDE DRFT</p>
        <h2 className={styles.introTitle}>A dying machine you can play</h2>
        <p className={styles.introSub}>
          Tape wow, head burn, tracking wash, dropouts, snow - six knobs of damage
          over a CRT that shows you everything it does to the sound.
        </p>
      </section>

      {/* ---- Alternating feature blocks ----------------------------------- */}
      <div className={styles.blocks}>
        {BLOCKS.map((b, i) => (
          <section key={b.title} className={`${styles.block} ${i % 2 === 1 ? styles.blockAlt : ""}`}>
            <div className={styles.blockMedia}>
              <div className={styles.shotFrame}>
                {b.video ? (
                  <video
                    className={styles.shotImg}
                    src={b.video}
                    poster={b.poster}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-label={b.alt}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.shotImg} src={b.img} alt={b.alt} />
                )}
              </div>
            </div>
            <div>
              <p className={styles.blockOsd} aria-hidden>{`TRK 0${i + 1}`}</p>
              <h2 className={styles.blockTitle}>{b.title}</h2>
              <p className={styles.blockDesc}>{b.desc}</p>
            </div>
          </section>
        ))}
      </div>

      {/* ---- Capabilities ------------------------------------------------- */}
      <div className={styles.caps}>
        <div className={styles.capsHead}>
          <h2 className={styles.capsTitle}>The rest of the chassis</h2>
        </div>
        <div className={styles.capsGrid}>
          {CAPS.map((c) => (
            <div key={c.title}>
              <div className={styles.capIcon}>{c.icon}</div>
              <p className={styles.capTitle}>{c.title}</p>
              <p className={styles.capDesc}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ---- FAQ ---------------------------------------------------------- */}
      <div className={styles.faq}>
        <h2 className={styles.faqTitle}>Questions</h2>
        {FAQS.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </div>

      {/* ---- Get drft (final) --------------------------------------------- */}
      <section className={styles.getStarted} id="drft-buy">
        <h2 className={styles.gsTitle}>Get drft</h2>
        <p className={styles.gsSub}>
          One-time purchase, free updates. The $19 launch price is a limited discount off $39.
        </p>
        <div className={styles.gsForm}>
          <BuyButton className={styles.pillDark} owned={owned} ownsShft={ownsShft} />
        </div>
      </section>
    </>
  )
}
```

- [ ] **Step 3: Create `app/drft/drft.module.css`**

Structural skeleton mirrors `app/shft/shft.module.css` (open it side-by-side for the layout values); the theme is entirely different. Full file:

```css
/* drft landing — CRT dark, "the page is the device".
   Palette comes from the plugin's own chassis tokens (Source/ui/UiTokens.h). */

.page {
  --chassis: #191714;
  --panel: #221f1a;
  --seam: #0a0908;
  --cream: #efe9dc;
  --silk: #a89c86;
  --silk-dim: #6e6557;
  --led-green: #7fae4a;
  --led-amber: #d99a2b;
  --led-red: #c8402e;
  --line: rgba(168, 156, 134, 0.16);
  background: var(--chassis);
  color: var(--silk);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--font-geist-sans), system-ui, sans-serif;
}

/* ---- OSD chrome (monospace, like the plugin's on-screen display) -------- */
.eyebrow,
.heroOsd,
.blockOsd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  color: var(--led-green);
  text-shadow: 0 0 8px rgba(127, 174, 74, 0.5);
  text-transform: uppercase;
}

.recDot {
  display: inline-block;
  width: 0.55em;
  height: 0.55em;
  border-radius: 50%;
  background: var(--led-red);
  box-shadow: 0 0 8px rgba(200, 64, 46, 0.8);
  margin-right: 0.45em;
  animation: recBlink 1.2s steps(1) infinite;
}
@keyframes recBlink {
  50% { opacity: 0.15; }
}

/* ---- Shared pills ------------------------------------------------------- */
.pillLight,
.pillDark,
.stickyBtn {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  border: 0;
  border-radius: 999px;
  padding: 0.85rem 1.6rem;
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: filter 0.15s, transform 0.1s;
}
.pillLight {
  color: #10130a;
  background: var(--led-green);
  box-shadow: 0 0 18px rgba(127, 174, 74, 0.35);
}
.pillLight:hover { filter: brightness(1.08); transform: translateY(-1px); }
.pillDark {
  color: var(--cream);
  background: var(--panel);
  border: 1px solid var(--line);
  box-shadow: inset 0 1px 0 rgba(239, 233, 220, 0.06);
}
.pillDark:hover { filter: brightness(1.12); }
.pillLight:disabled, .pillDark:disabled, .stickyBtn:disabled { opacity: 0.6; cursor: default; }
.pillLight s, .pillDark s, .stickyBtn s { opacity: 0.55; font-weight: 400; }
.priceSale { color: inherit; }
.pillDark .priceSale, .stickyBtn .priceSale { color: var(--led-amber); }

.bannerInfo {
  background: var(--panel);
  color: var(--cream);
  border-bottom: 1px solid var(--seam);
  text-align: center;
  padding: 0.7rem 1rem;
  font-size: 0.92rem;
}

/* ---- Hero --------------------------------------------------------------- */
.hero {
  position: relative;
  min-height: 88vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #000;
  border-bottom: 1px solid var(--seam);
}
.heroMediaLayer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* Scanlines + vignette over the video — the CRT glass. */
.heroScanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0px,
    rgba(0, 0, 0, 0) 2px,
    rgba(0, 0, 0, 0.22) 3px
  );
  mix-blend-mode: multiply;
}
.heroScrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.55) 100%),
    linear-gradient(to top, rgba(10, 9, 8, 0.85) 0%, rgba(10, 9, 8, 0) 35%);
}
.heroContent {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 2rem 1.25rem;
}
.heroOsd { margin-bottom: 1.2rem; }
.heroWordmark {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: clamp(4rem, 14vw, 8.5rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.9;
  color: var(--cream);
  text-shadow:
    0 0 24px rgba(239, 233, 220, 0.35),
    2px 0 0 rgba(200, 64, 46, 0.35),
    -2px 0 0 rgba(74, 144, 174, 0.35);
  margin: 0 0 0.6rem;
}
.heroSubtitle {
  color: var(--silk);
  font-size: 1.15rem;
  margin-bottom: 2rem;
}
.heroCtaRow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
}
.heroPrice {
  color: var(--silk-dim);
  font-size: 0.9rem;
}

/* ---- Intro -------------------------------------------------------------- */
.intro {
  max-width: 44rem;
  margin: 0 auto;
  padding: 5.5rem 1.5rem 3.5rem;
  text-align: center;
}
.introTitle {
  color: var(--cream);
  font-size: clamp(1.8rem, 4.5vw, 2.6rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0.9rem 0 1rem;
}
.introSub {
  color: var(--silk);
  font-size: 1.08rem;
  line-height: 1.65;
}

/* ---- Feature blocks ----------------------------------------------------- */
.blocks {
  display: flex;
  flex-direction: column;
}
.block {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3.5rem;
  align-items: center;
  max-width: 72rem;
  margin: 0 auto;
  padding: 4rem 1.5rem;
}
.blockAlt { direction: rtl; }
.blockAlt > * { direction: ltr; }
.blockMedia { min-width: 0; }
/* Every screenshot sits behind CRT glass: bezel, scanlines, glow. */
.shotFrame {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: #000;
  border: 1px solid var(--seam);
  box-shadow:
    0 0 0 6px var(--panel),
    0 0 0 7px var(--seam),
    0 18px 50px rgba(0, 0, 0, 0.55),
    0 0 40px rgba(127, 174, 74, 0.06);
}
.shotFrame::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0px,
    rgba(0, 0, 0, 0) 2px,
    rgba(0, 0, 0, 0.16) 3px
  );
}
.shotImg {
  display: block;
  width: 100%;
  height: auto;
}
.blockOsd { margin-bottom: 0.7rem; }
.blockTitle {
  color: var(--cream);
  font-size: clamp(1.5rem, 3.2vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.015em;
  margin-bottom: 0.9rem;
}
.blockDesc {
  color: var(--silk);
  font-size: 1.02rem;
  line-height: 1.7;
}

/* ---- Capabilities grid --------------------------------------------------- */
.caps {
  border-top: 1px solid var(--seam);
  background: var(--panel);
  padding: 5rem 1.5rem;
}
.capsHead {
  max-width: 72rem;
  margin: 0 auto 2.8rem;
}
.capsTitle {
  color: var(--cream);
  font-size: clamp(1.6rem, 3.6vw, 2.2rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.capsGrid {
  max-width: 72rem;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.6rem 2.2rem;
}
.capIcon { color: var(--led-green); margin-bottom: 0.7rem; }
/* Silk-screen label: UPPERCASE mono, letter-spaced — same treatment as the
   knob labels on the chassis. Titles are authored uppercase; no transform. */
.capTitle {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.08em;
  color: var(--cream);
  font-weight: 600;
  margin-bottom: 0.35rem;
}
.capDesc {
  color: var(--silk);
  font-size: 0.95rem;
  line-height: 1.6;
}

/* ---- FAQ ----------------------------------------------------------------- */
.faq {
  max-width: 44rem;
  margin: 0 auto;
  padding: 5rem 1.5rem;
}
.faqTitle {
  color: var(--cream);
  font-size: clamp(1.6rem, 3.6vw, 2.2rem);
  font-weight: 700;
  margin-bottom: 1.6rem;
}
.faqItem { border-bottom: 1px solid var(--line); }
.faqQ {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: none;
  border: 0;
  color: var(--cream);
  font-family: inherit;
  font-size: 1.05rem;
  font-weight: 600;
  text-align: left;
  padding: 1.1rem 0;
  cursor: pointer;
}
.faqPlus {
  color: var(--led-green);
  font-size: 1.3rem;
  transition: transform 0.2s;
}
.faqOpen .faqPlus { transform: rotate(45deg); }
.faqA {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease;
}
.faqOpen .faqA { grid-template-rows: 1fr; }
.faqAInner {
  overflow: hidden;
  color: var(--silk);
  line-height: 1.7;
  padding-bottom: 0;
}
.faqOpen .faqAInner { padding-bottom: 1.1rem; }

/* ---- Final CTA ----------------------------------------------------------- */
.getStarted {
  border-top: 1px solid var(--seam);
  background: var(--panel);
  text-align: center;
  padding: 5rem 1.5rem 6rem;
}
.gsTitle {
  color: var(--cream);
  font-size: clamp(1.8rem, 4.5vw, 2.6rem);
  font-weight: 700;
  margin-bottom: 0.8rem;
}
.gsSub {
  color: var(--silk);
  margin-bottom: 1.8rem;
}
.gsForm { display: flex; justify-content: center; }

/* ---- Sticky buy bar ------------------------------------------------------ */
.stickyBar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  transform: translateY(110%);
  transition: transform 0.25s ease;
  background: rgba(25, 23, 20, 0.92);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--seam);
}
.stickyBarShow { transform: translateY(0); }
.stickyInner {
  max-width: 72rem;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.7rem 1.25rem;
}
.stickyName {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--cream);
  font-weight: 700;
  font-size: 1.05rem;
}
.stickyMeta { color: var(--silk-dim); font-size: 0.85rem; }
.stickySpacer { flex: 1; }
.stickyBtn {
  color: #10130a;
  background: var(--led-green);
  padding: 0.6rem 1.2rem;
  font-size: 0.92rem;
}

/* ---- Responsive ---------------------------------------------------------- */
@media (max-width: 860px) {
  .block { grid-template-columns: 1fr; gap: 1.8rem; padding: 2.8rem 1.25rem; }
  .blockAlt { direction: ltr; }
  .capsGrid { grid-template-columns: 1fr 1fr; }
  .hero { min-height: 72vh; }
}
@media (max-width: 560px) {
  .capsGrid { grid-template-columns: 1fr; }
  .stickyMeta { display: none; }
}
```

- [ ] **Step 4: Verify in the browser**

Run `npm run dev:direct`, open `http://localhost:3000/drft` and check:
- Hero shows the poster (no `hero.mp4` yet — poster must hold), blinking REC dot, glitch-shadow wordmark.
- All five blocks show their images behind the CRT bezel/scanlines; block 5 falls back to its poster if `rec.mp4` wasn't produced.
- Buy button reads `Buy Now — $19 $39` (struck), clicking it logged-out redirects to `/login?callbackUrl=%2Fdrft`.
- Sticky bar appears on scroll past the hero; FAQ items expand.
- Mobile width (device toolbar ~390px): blocks stack, caps go single-column, no horizontal scroll.

Also: `npm run lint && npm run build` → clean.

- [ ] **Step 5: Commit**

```bash
git add app/drft
git commit -m "feat: drft landing page - CRT-dark retro theme, crossgrade-aware buy flow"
```

---

### Task 8: `/plugins` storefront

**Files:**
- Create: `app/plugins/page.tsx`
- Create: `app/plugins/PluginsStore.tsx`
- Create: `app/plugins/plugins.module.css`

**Interfaces:**
- Consumes: `PRICING`, `/api/shft/ownership`, `/api/drft/ownership`, `/api/shft/checkout`, `/api/drft/checkout`, `/api/bundle/checkout`, `/api/bundle/claim`, `trackMeta`, `SiteNav`. Card art: `/shft/sc2.png` (existing) and `/drft/tube.png` (Task 6).
- Produces: the `/plugins` route (nav target in Task 9).

- [ ] **Step 1: Create `app/plugins/page.tsx`**

```tsx
import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import PluginsStore from "./PluginsStore"

export const metadata: Metadata = {
  title: "Plugins — shft & drft | Sample Roll",
  description:
    "Sample Roll plugins: shft, the tempo-synced trance-gate multi-FX, and drft, the VHS / CRT circuit-bend effect. $19 each, or both for $34 for a limited time. VST3 / AU / Standalone for macOS & Windows.",
  openGraph: {
    title: "Sample Roll Plugins — shft & drft",
    description: "shft + drft — $19 each, or both for $34 for a limited time.",
    images: ["/drft/og.png"],
    type: "website",
  },
  alternates: { canonical: "/plugins" },
}

export default function PluginsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="site-header w-full shrink-0">
        <SiteNav />
      </header>
      <PluginsStore />
    </div>
  )
}
```

- [ ] **Step 2: Create `app/plugins/PluginsStore.tsx`**

```tsx
"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import styles from "./plugins.module.css"
import { trackMeta } from "@/lib/meta-pixel"
import { PRICING } from "@/lib/products"

type PluginId = "shft" | "drft"

const PLUGINS: { id: PluginId; name: string; tagline: string; img: string; theme: string; href: string }[] = [
  {
    id: "shft",
    name: "shft",
    tagline: "Tempo-synced trance-gate multi-FX. Sixteen steps chop your audio into living rhythm.",
    img: "/shft/sc2.png",
    theme: "cardShft",
    href: "/shft",
  },
  {
    id: "drft",
    name: "drft",
    tagline: "VHS / CRT circuit-bend FX. Your sound through a dying tape machine, picture and all.",
    img: "/drft/tube.png",
    theme: "cardDrft",
    href: "/drft",
  },
]

async function startCheckout(endpoint: string): Promise<{ url: string | null; needsAuth: boolean; conflict: boolean }> {
  try {
    const res = await fetch(endpoint, { method: "POST" })
    if (res.status === 401) return { url: null, needsAuth: true, conflict: false }
    if (res.status === 409) return { url: null, needsAuth: false, conflict: true }
    const data = await res.json().catch(() => ({}))
    if (res.ok && typeof data?.url === "string") return { url: data.url, needsAuth: false, conflict: false }
  } catch {
    /* fall through */
  }
  return { url: null, needsAuth: false, conflict: false }
}

/** Buy button used for singles and the bundle. On 409 (ownership changed under
    us) it reloads so the page re-renders the right state. */
function BuyBtn({ endpoint, className, children }: { endpoint: string; className: string; children: ReactNode }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const buy = async () => {
    setBusy(true)
    setFailed(false)
    const { url, needsAuth, conflict } = await startCheckout(endpoint)
    if (needsAuth) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent("/plugins")}`
      return
    }
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

function PurchaseBanner() {
  const [canceled, setCanceled] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get("purchase")
    if (p === "canceled") {
      setCanceled(true)
      return
    }
    if (p !== "success") return

    const paid = Number(params.get("paid")) || PRICING.bundle.price
    trackMeta("Purchase", { value: paid, currency: "USD", content_name: "bundle", content_type: "product" })

    const sessionId = params.get("session_id")
    if (!sessionId) {
      window.location.replace("/products")
      return
    }
    fetch("/api/bundle/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).finally(() => {
      window.location.replace("/products")
    })
  }, [])

  if (!canceled) return null
  return <div className={styles.bannerInfo}>Checkout canceled — no charge was made. The bundle is here whenever you&apos;re ready.</div>
}

export default function PluginsStore() {
  const [owned, setOwned] = useState<Record<PluginId, boolean>>({ shft: false, drft: false })

  useEffect(() => {
    for (const id of ["shft", "drft"] as const) {
      fetch(`/api/${id}/ownership`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.owned) setOwned((o) => ({ ...o, [id]: true }))
        })
        .catch(() => {})
    }
  }, [])

  const ownCount = Number(owned.shft) + Number(owned.drft)
  const missing: PluginId = owned.shft ? "drft" : "shft"

  return (
    <main className={styles.store}>
      <PurchaseBanner />
      <div className={styles.head}>
        <h1 className={styles.title}>Plugins</h1>
        <p className={styles.sub}>Instruments of damage and rhythm. One-time purchase, free updates, macOS &amp; Windows.</p>
      </div>

      <div className={styles.cards}>
        {PLUGINS.map((p) => (
          <article key={p.id} className={`${styles.card} ${styles[p.theme]}`}>
            <Link href={p.href} className={styles.cardMedia} aria-label={`Learn more about ${p.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.cardImg} src={p.img} alt={`${p.name} plugin UI`} />
            </Link>
            <div className={styles.cardBody}>
              <h2 className={styles.cardName}>{p.name}</h2>
              <p className={styles.cardTagline}>{p.tagline}</p>
              <div className={styles.cardRow}>
                {owned[p.id] ? (
                  <a className={styles.cardBuy} href="/products">
                    You own {p.name} — Download
                  </a>
                ) : (
                  <BuyBtn endpoint={`/api/${p.id}/checkout`} className={styles.cardBuy}>
                    Buy — <strong>${ownCount === 1 && p.id === missing ? PRICING.crossgrade.price : PRICING[p.id].price}</strong>{" "}
                    <s>${ownCount === 1 && p.id === missing ? PRICING.crossgrade.compareAt : PRICING[p.id].msrp}</s>
                  </BuyBtn>
                )}
                <Link href={p.href} className={styles.cardMore}>
                  Learn more →
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* ---- Bundle banner: state depends on how much of the pair you own --- */}
      <section className={styles.bundle}>
        {ownCount === 0 && (
          <>
            <p className={styles.bundleTag}>LIMITED TIME</p>
            <h2 className={styles.bundleTitle}>shft + drft — the pair</h2>
            <p className={styles.bundleSub}>
              Both plugins for <strong>${PRICING.bundle.price}</strong> <s>${PRICING.bundle.compareAt}</s>
              <span className={styles.bundleMsrp}> (${PRICING.bundle.msrp} MSRP)</span>
            </p>
            <BuyBtn endpoint="/api/bundle/checkout" className={styles.bundleBuy}>
              Get the bundle — ${PRICING.bundle.price}
            </BuyBtn>
          </>
        )}
        {ownCount === 1 && (
          <>
            <p className={styles.bundleTag}>COMPLETE THE PAIR</p>
            <h2 className={styles.bundleTitle}>You own {owned.shft ? "shft" : "drft"} — get {missing} for ${PRICING.crossgrade.price}</h2>
            <p className={styles.bundleSub}>
              Same deal as the bundle: <strong>${PRICING.crossgrade.price}</strong> <s>${PRICING.crossgrade.compareAt}</s> brings your pair to ${PRICING.bundle.price} total.
            </p>
            <BuyBtn endpoint={`/api/${missing}/checkout`} className={styles.bundleBuy}>
              Get {missing} — ${PRICING.crossgrade.price}
            </BuyBtn>
          </>
        )}
        {ownCount === 2 && (
          <>
            <h2 className={styles.bundleTitle}>You own the whole rack</h2>
            <p className={styles.bundleSub}>Both plugins are yours — downloads and licence keys live in My Products.</p>
            <a href="/products" className={styles.bundleBuy}>
              Go to My Products
            </a>
          </>
        )}
      </section>
    </main>
  )
}
```

- [ ] **Step 3: Create `app/plugins/plugins.module.css`**

```css
/* /plugins storefront — neutral site chrome; each card carries its own art. */

.store {
  flex: 1;
  width: 100%;
  max-width: 72rem;
  margin: 0 auto;
  padding: 3rem 1.5rem 5rem;
}

.bannerInfo {
  background: var(--primary, #1a1a1a);
  color: #fff;
  text-align: center;
  padding: 0.7rem 1rem;
  font-size: 0.92rem;
  border-radius: 10px;
  margin-bottom: 1.5rem;
}

.head { text-align: center; margin-bottom: 2.8rem; }
.title {
  font-size: clamp(2rem, 5vw, 2.8rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.sub { opacity: 0.7; margin-top: 0.5rem; }

.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.6rem;
}
.card {
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
/* Each product's card wears its own theme. */
.cardShft {
  background: #efe9dc;
  color: #24211d;
}
.cardDrft {
  background: #191714;
  color: #efe9dc;
  border-color: #0a0908;
}
.cardMedia { display: block; background: #000; }
.cardImg {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
}
.cardBody { padding: 1.4rem 1.5rem 1.6rem; display: flex; flex-direction: column; gap: 0.6rem; flex: 1; }
.cardName {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.cardDrft .cardName { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.cardTagline { opacity: 0.75; line-height: 1.55; flex: 1; }
.cardRow { display: flex; align-items: center; gap: 1rem; margin-top: 0.4rem; }
.cardBuy {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  border: 0;
  border-radius: 999px;
  padding: 0.65rem 1.2rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  background: #24211d;
  color: #f4efe4;
  transition: filter 0.15s;
}
.cardBuy:hover { filter: brightness(1.15); }
.cardBuy:disabled { opacity: 0.6; cursor: default; }
.cardBuy s { opacity: 0.55; font-weight: 400; }
.cardDrft .cardBuy { background: #7fae4a; color: #10130a; }
.cardMore { font-size: 0.92rem; text-decoration: underline; opacity: 0.8; color: inherit; }

/* ---- Bundle banner ------------------------------------------------------- */
.bundle {
  margin-top: 2rem;
  border-radius: 16px;
  padding: 2.4rem 1.8rem;
  text-align: center;
  color: #efe9dc;
  background:
    repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0) 0 2px, rgba(0, 0, 0, 0.18) 2px 3px),
    linear-gradient(120deg, #191714 0%, #221f1a 55%, #2a2015 100%);
  border: 1px solid #0a0908;
}
.bundleTag {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  color: #d99a2b;
  margin-bottom: 0.7rem;
}
.bundleTitle {
  font-size: clamp(1.4rem, 3.5vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.015em;
  margin-bottom: 0.5rem;
}
.bundleSub { opacity: 0.85; margin-bottom: 1.4rem; }
.bundleSub s { opacity: 0.55; }
.bundleMsrp { opacity: 0.55; font-size: 0.9em; }
.bundleBuy {
  display: inline-flex;
  border: 0;
  border-radius: 999px;
  padding: 0.85rem 1.7rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  background: #d99a2b;
  color: #191714;
  transition: filter 0.15s;
}
.bundleBuy:hover { filter: brightness(1.08); }
.bundleBuy:disabled { opacity: 0.6; cursor: default; }

@media (max-width: 760px) {
  .cards { grid-template-columns: 1fr; }
  .cardRow { flex-wrap: wrap; }
}
```

- [ ] **Step 4: Verify in the browser**

`npm run dev:direct`, open `http://localhost:3000/plugins`:
- Two cards (shft paper, drft dark) with prices `$19 $39` struck, Learn more links land on `/shft` and `/drft`.
- Bundle banner shows LIMITED TIME / $34 struck $38 / ($78 MSRP).
- Logged out, clicking any Buy → `/login?callbackUrl=%2Fplugins`.
- To eyeball the own-one state without a purchase: temporarily flip the initial state to `{ shft: true, drft: false }` in `PluginsStore.tsx`, confirm the shft card shows Download, the drft card shows `$15 $19`, and the banner reads "COMPLETE THE PAIR … get drft for $15" — then revert the flip before committing.
- Mobile width: cards stack.

`npm run lint && npm run build` → clean.

- [ ] **Step 5: Commit**

```bash
git add app/plugins
git commit -m "feat: /plugins storefront - product cards, bundle banner, ownership-aware crossgrade states"
```

---

### Task 9: Nav → /plugins, sitemap, shft page crossgrade display

**Files:**
- Modify: `components/SiteNav.tsx` (desktop link ~line 142, mobile drawer link ~line 271)
- Modify: `app/sitemap.ts`
- Modify: `app/shft/ShftLanding.tsx` (BuyButton, PurchaseBanner, ownership effect)

**Interfaces:**
- Consumes: `/plugins` route (Task 8), `/api/drft/ownership` (Task 2), `PRICING` (Task 1), `&paid=` success-URL param (Task 3).

- [ ] **Step 1: Point both nav links at `/plugins`**

In `components/SiteNav.tsx`, the desktop link (~line 142) becomes:

```tsx
          <Link href="/plugins" className={`${navLinkBase} ${isActive("/plugins") || isActive("/shft") || isActive("/drft") ? navLinkActive : ""}`} style={navLinkStyle} aria-current={pathname === "/plugins" ? "page" : undefined}>
            Plugins
          </Link>
```

and the mobile drawer link (~line 271) becomes:

```tsx
            <Link
              href="/plugins"
              className={`${navLinkBase} nav-drawer-link inline-block py-3 !h-auto !px-0 ${pathname === "/plugins" || pathname === "/shft" || pathname === "/drft" ? navLinkActive : ""}`}
              style={navLinkStyle}
              onClick={closeMenu}
              aria-current={pathname === "/plugins" ? "page" : undefined}
            >
              Plugins
            </Link>
```

(`isActive` is prefix-based, so `/shft` and `/drft` sub-paths keep the tab lit too.)

- [ ] **Step 2: Add the store routes to the sitemap**

In `app/sitemap.ts`, add to `staticRoutes` (note `/shft` was missing entirely — this fixes that too):

```ts
    { url: `${base}/plugins`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/shft`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/drft`, lastModified, changeFrequency: "weekly", priority: 0.9 },
```

- [ ] **Step 3: shft page shows the crossgrade price to drft owners**

In `app/shft/ShftLanding.tsx` (live page — minimal diffs only):

a. Add the import:

```ts
import { PRICING } from "@/lib/products"
```

b. In `ShftLanding`, add drft ownership state alongside the existing `owned` effect:

```tsx
  const [ownsDrft, setOwnsDrft] = useState(false)
```

and inside the existing `useEffect`, after the shft ownership fetch:

```tsx
    fetch("/api/drft/ownership")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.owned) setOwnsDrft(true)
      })
      .catch(() => {})
```

c. Change `BuyButton`'s signature to `{ className, owned, ownsDrft }: { className: string; owned: boolean; ownsDrft: boolean }` and replace its hardcoded price line:

```tsx
        <>
          Buy Now — <span className={styles.priceSale}>${ownsDrft ? PRICING.crossgrade.price : PRICING.shft.price}</span>{" "}
          <s>${ownsDrft ? PRICING.crossgrade.compareAt : PRICING.shft.msrp}</s>
        </>
```

d. Pass `ownsDrft={ownsDrft}` at all four `BuyButton` call sites (hero, sticky bar via a new `ownsDrft` prop on `StickyBar`, FAQ-bottom `pillDark`, and update `StickyBar`'s props to `{ owned, ownsDrft }: { owned: boolean; ownsDrft: boolean }` forwarding it).

e. In `PurchaseBanner`, replace the hardcoded pixel value:

```tsx
    const paid = Number(params.get("paid")) || PRICING.shft.price
    trackMeta("Purchase", { value: paid, currency: "USD", content_name: "shft", content_type: "product" })
```

- [ ] **Step 4: Verify**

`npm run lint && npm run build` → clean. In the dev server:
- Nav "Plugins" goes to `/plugins` (desktop + hamburger); tab stays highlighted on `/plugins`, `/shft`, and `/drft`.
- `/shft` still renders identically for a logged-out visitor (price `$19 $39`).
- `curl -s localhost:3000/sitemap.xml | grep -E "plugins|shft|drft"` shows all three URLs.

- [ ] **Step 5: Commit**

```bash
git add components/SiteNav.tsx app/sitemap.ts app/shft/ShftLanding.tsx
git commit -m "feat: nav Plugins -> /plugins, store routes in sitemap, shft crossgrade price display"
```

---

### Task 10: drft release upload script

**Files:**
- Create: `scripts/upload-drft-release.mjs`

**Interfaces:**
- Consumes: same `SPACES_*` env vars as the shft script; object keys must match Task 1's drft asset keys (`DRFT_INSTALLER_KEY` / `DRFT_INSTALLER_WIN_KEY` / `DRFT_MANUAL_KEY` env overrides, defaults `drft/drft-1.0.0.pkg`, `drft/drft-1.0.0-setup.exe`, `drft/drft-manual-v1.0.pdf`).

- [ ] **Step 1: Create the script**

Copy `scripts/upload-shft-release.mjs` to `scripts/upload-drft-release.mjs`, then change ONLY:
- The header comment: `shft` → `drft` in the description and usage lines (usage shows `node scripts/upload-drft-release.mjs`).
- The three `uploads.push` key lines:

```js
if (opts.installer)    uploads.push({ path: opts.installer,    key: process.env.DRFT_INSTALLER_KEY     || "drft/drft-1.0.0.pkg",       type: "application/octet-stream" })
if (opts.installerWin) uploads.push({ path: opts.installerWin, key: process.env.DRFT_INSTALLER_WIN_KEY || "drft/drft-1.0.0-setup.exe",  type: "application/octet-stream" })
if (opts.manual)       uploads.push({ path: opts.manual,       key: process.env.DRFT_MANUAL_KEY        || "drft/drft-manual-v1.0.pdf",  type: "application/pdf" })
```

- The usage error string: `Usage: node scripts/upload-drft-release.mjs [--installer <pkg>] [--installer-win <exe>] [--manual <pdf>]`

Everything else (S3 client setup, flag parsing, upload loop) stays identical.

- [ ] **Step 2: Verify**

Run: `node scripts/upload-drft-release.mjs`
Expected: exits 1 with the missing-SPACES-env error (proves it parses and runs). Confirm the default keys printed in the file match `lib/products.ts` drft asset keys exactly: `grep -o 'drft/[a-z0-9.-]*' scripts/upload-drft-release.mjs lib/products.ts | sort | uniq -c` — every key appears twice.

- [ ] **Step 3: Commit**

```bash
git add scripts/upload-drft-release.mjs
git commit -m "feat: drft release upload script"
```

---

### Task 11: Final verification pass

**Files:** none (fixes only if checks fail)

- [ ] **Step 1: Full build gate**

```bash
npm run lint && npm run build
```
Expected: both clean.

- [ ] **Step 2: Manual state walkthrough (dev server, checkout dormant)**

With `npm run dev:direct`:

| Check | Expected |
| --- | --- |
| `/plugins` logged out | Both cards $19 struck $39; bundle $34 struck $38 ($78 MSRP); Buy → login redirect with `callbackUrl=/plugins` |
| `/drft` logged out | CRT-dark page, poster hero with blinking REC, Buy `$19 $39`, sticky bar on scroll, FAQ expands, mobile stacks |
| `/shft` logged out | Unchanged vs production ($19 struck $39) |
| Nav | "Plugins" → `/plugins` from any page, desktop + hamburger; tab lit on all three store routes |
| APIs | `POST /api/drft/checkout` → 503; `POST /api/bundle/checkout` → 503 (dormant, envs unset); `GET /api/drft/ownership` → `{"owned":false}` |
| `sitemap.xml` | contains `/plugins`, `/shft`, `/drft` |
| Own-one simulation | Flip `PluginsStore` initial owned state to `{ shft: true, drft: false }`: card Download / other card $15 / COMPLETE THE PAIR banner. Revert after. |

- [ ] **Step 3: Launch-day checklist (record in the commit/PR description — no code)**

Ship-day steps that are configuration, not code:
1. Create four Stripe prices ($19 drft, $34 bundle, $15 crossgrade x2) and set `STRIPE_DRFT_PRICE_ID`, `STRIPE_BUNDLE_PRICE_ID`, `STRIPE_DRFT_CROSSGRADE_PRICE_ID`, `STRIPE_SHFT_CROSSGRADE_PRICE_ID` in production.
2. Upload installers: `node scripts/upload-drft-release.mjs --installer drft-1.0.0.pkg --installer-win drft-1.0.0-setup.exe [--manual drft-manual-v1.0.pdf]`.
3. Drop Troy's `hero.mp4` into `public/drft/` when ready (poster holds until then).
4. Test-mode Stripe run of all three flows (single, bundle, crossgrade) before flipping live keys.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: final verification pass for drft store launch"
```
(Skip if nothing changed.)
