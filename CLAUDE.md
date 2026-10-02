# Sample Roll

Next.js 16 (App Router) / React 19 / TypeScript / Prisma / Stripe / NextAuth.
Two halves share one codebase: **the Dig** (a sample-discovery app) and **the
storefront** that sells three audio plugins — shft, drft and fltr.

---

## Database safety — read this before running anything

**`.env` in this repo carries the PRODUCTION Supabase `DATABASE_URL`.**
`.env.local` overrides it with local Postgres. Next.js layers both, so `npm run
dev` is safe. A standalone script is not:

```bash
node -r dotenv/config scripts/whatever.ts   # loads .env ALONE → PRODUCTION
import "dotenv/config"                       # same trap
```

This is not hypothetical. A script that loaded `.env` this way wrote a test row
to the live database before the guard below existed.

**When a script touches the database:**

```ts
import "./load-env"                    // .env.local first, then .env
import "./ensure-not-production-db"    // refuses *.supabase.co/.com
// only now may you import @/lib/db or @prisma/client
```

Import order is load-bearing — `lib/db.ts` constructs `PrismaClient` at module
scope, so `process.env` must already be correct when it is evaluated.
`scripts/ensure-not-production-db.ts` inspects the **hostname only**, never the
connection string, which carries credentials. `ALLOW_PROD_DB=1` is the only
override and should essentially never be used.

**Never connect to production to verify something.** Not to check a row count,
not read-only. Ask for the query to be run instead. Never print or log database
credentials.

**`local-admin@example.com` has a `shft` purchase dated 2026-08-18.** It belongs
to the project owner. It is not test data — never delete or modify it. Any rows
you seed for testing must be cleaned up, and the cleanup stated explicitly.

### Prisma: never use `mode: "insensitive"` for email lookups

Prisma compiles it to `WHERE email ILIKE $1` with the value **unescaped**, so
`_` and `%` become wildcards — `john_smith@example.com` can match
`johnXsmith@example.com` and hand one person another's account. Every email is
written lowercase at all 20 write sites, so plain `equals` against a
pre-lowercased value is both correct and safe. All 10 read sites were fixed;
keep it that way.

---

## Commands

```bash
npm run dev                      # localhost:3000
npm run build                    # next build --webpack
npm run lint                     # eslint — baseline is 299 problems, pre-existing
npx tsc --noEmit                 # must be clean
npx tsx --test lib/*.test.ts     # unit tests — 176 passing
```

**There is no `test` script in `package.json`.** `npx tsx --test` is the whole
unit-test story; `tsx` is required because the tests import `.ts` directly.

### Browser verification

`scripts/verify-*.mjs` are plain Node + Playwright scripts, not a test
framework. Each uses a local `check(label, condition, detail)` helper, prints
`ok` / `FAIL` lines, and exits non-zero on failure. They need the dev server
running.

```bash
node scripts/verify-plugin-chrome.mjs      # sale strip + sticky rail
node scripts/verify-plugin-panel.mjs       # hero panel: hover help + page tabs
node scripts/verify-drft-compare.mjs       # drft: the dark "hear it" band
node scripts/verify-ab-compare.mjs         # before/after player on drft + fltr
node scripts/verify-storefront-nav.mjs     # nav dropdown + ticker
node scripts/verify-cart.mjs               # cart drawer + checkout
node scripts/verify-plugin-ownership.mjs   # never sell what someone owns
node scripts/verify-plugin-pricing.mjs     # no stale prices in copy
```

`scripts/verify-offer-reminder.ts` is the odd one out: `npx tsx`, no dev server,
no browser. It runs the member-offer reminder end to end against the local
database with Stripe and the mail server faked, and deletes what it seeds.

**Mutation-prove every new assertion.** Break the thing the check covers,
confirm the check goes red, restore. Five shipped assertions could not fail
before this was enforced — including one that compared a pre-scroll position to
a post-scroll one and passed either way.

---

## Conventions

**Single sources of truth.** Derive from these rather than restating their
contents:

| File | Owns |
| --- | --- |
| `lib/plugins.ts` | presentation catalog, `PLUGIN_ORDER`, the fltr intro window |
| `lib/products.ts` | `PRICING`, download assets, changelogs |
| `lib/plugin-products.ts` | entitlement truth — what each purchase grants |
| `lib/cart-pricing.ts` | cart totals, bundle detection |

A literal `3` for "all the plugins" is a bug; use `PLUGIN_ORDER.length`. A
hardcoded `["shft","drft"]` is the bug that made an fltr-only owner read as
owning nothing.

**Never offer or sell someone what they already own, and never act on unknown
ownership.** Any ownership-dependent UI has three states, not two — the
`loading || error` branch must fall through without offering anything.

**Pricing lives in `PRICING`, including in copy.** The pricing gate greps
numerals, so words like "launch price" survive a price change and quietly become
false. Check the sentence, not just the number.

**Hydration.** No `Date.now()`, `localStorage`, or `Math.random()` during server
render. `components/Countdown.tsx` is the pattern: state starts `null`, the real
value arrives in an effect.

**`prefers-reduced-motion`** is respected throughout, and reduced motion means
*removed*, not paused — a frozen animation mid-element reads as a rendering
fault.

**CSS Modules, with a sitewide cascade to fight.** `globals.css` carries
`.theme-vinyl nav a` rules aimed at the dark site nav. Storefront pills are
anchors inside a `<nav>` but on a cream ground, and they lose on specificity.
Add an ancestor class rather than `!important` — the comments in
`components/plugin-chrome.module.css` explain the arithmetic.

---

## Open items

**Branch `feat/plugin-pages-redesign`** — 65 commits, unmerged, **not pushed**.
Three increments: storefront redesign, nav dropdown + countdown ticker, cart +
checkout. Design docs in `docs/superpowers/specs/`, plans and a handoff note in
`docs/superpowers/plans/`.

Before that branch can launch:

- [ ] Create the Stripe price objects and set `STRIPE_SHFT29_PRICE_ID`,
      `STRIPE_DRFT29_PRICE_ID`, `STRIPE_FLTR29_PRICE_ID` ($29 each) and
      `STRIPE_BUNDLE59_PRICE_ID` ($59). The names change with the prices so
      stale config fails closed rather than charging the old amount.
- [ ] Member offer ($10 off any plugin, one single-use code per existing
      account, 30 days). `prisma/migrations/manual/20260930_member_offers.sql`
      is applied to production (2026-09-30). After deploy use `/admin/offers` -
      "Send test to me" first, then Send.
      Accounts made after the first press of Send get nothing. It sends through
      the same SMTP account as everything else, so a Gmail daily cap stops it
      partway; Resume the next day picks up where it stopped.
- [ ] Member offer reminder (2026-10-02): a second, designed email - the bundle
      sale, fltr and each person's own code again - to the people the offer
      went to who have neither used their code (Stripe's word) nor bought fltr.
      `lib/offer-reminder*.ts`, the lower half of `/admin/offers`. Apply
      `prisma/migrations/manual/20261002_member_offer_reminders.sql` to
      production BEFORE deploying, then "Send both tests to me", then Send.
      Someone who owns shft or drft cannot buy the bundle, so they get an email
      about fltr alone. Both buttons land on `/fltr?promo=<code>`; the bundle is
      added from the sale strip there - no link fills the cart by itself.
- [ ] Gift links (`/admin/comps?tab=gifts`, `lib/gift-link.ts`): run
      `prisma/migrations/manual/20261002_gift_links.sql` on production BEFORE
      deploying them. Prisma selects every column, so until it is applied the
      Comp codes page and /redeem fail. Accounts a gift makes before an email
      is put on it live at `@gifts.sampleroll.invalid` with both email
      switches off; `scripts/verify-gift-links.ts` covers the flow.
- [ ] The bundle's countdown ends at `BUNDLE_OFFER_ENDS` in `lib/plugins.ts`.
      On that date the $59 goes up (here and in Stripe) or the date moves.
- `NEXT_PUBLIC_FLTR_INTRO_ENDS` is not to be set: fltr has no intro price any
      more ($29, like the others, since 2026-09-30).
- [ ] Confirm the stray production row is gone:
      `select count(*) from affiliates where lower(code) = 'verifyc2';`
- [ ] Decide the in-plugin `sift` → `fltr` rename.
- [x] fltr's three files are in the bucket's `fltr/` folder (2026-09-30), named
      as `lib/products.ts` expects: `fltr-1.0.0.pkg`, `fltr-1.0.0-setup.exe`,
      `fltr-manual-v1.0.pdf`. 1.0.1's two installers joined them on 2026-10-02.

Not started: the interactive hotspot hero (spec C) — a product image where each
control explains itself, with the video loop moved below. Needs per-control copy
from the owner.
