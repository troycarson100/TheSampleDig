# Plugin storefront redesign — handoff

Branch: `feat/plugin-pages-redesign` · 27 commits · 13 tasks, each reviewed · whole-branch
review complete, its fix wave verified.

**The release is deliberately held until the FLTR plugin itself ships.** The branch is
buildable, reviewed and green, but not meant to merge before then.

## State at handoff

| Check | Result |
|---|---|
| `npx tsx --test lib/*.test.ts` | 146 / 146 |
| `node scripts/verify-plugin-chrome.mjs` | 36 / 36 |
| `NODE_OPTIONS=--experimental-strip-types node scripts/verify-plugins-index.mjs` | 11 / 11 |
| `npx tsx scripts/verify-plugin-pricing.mjs` | 7 / 7 |
| `node scripts/verify-shft-social.mjs` | pass |
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | exit 0 |
| `npm run lint` | 297 problems — all pre-existing on `main`, zero added |

All 16 ownership-state combinations (4 states × 4 pages) were walked by hand against a
seeded local database. No purchase control anywhere offers a plugin the visitor owns.

## Blocking before launch

**Stripe price env vars were renamed so a stale config fails closed** rather than silently
charging the old amount while granting the new products. Set these or checkout returns
`503 "Checkout opens at launch."`:

| Old | New |
|---|---|
| `STRIPE_SHFT_PRICE_ID` | `STRIPE_SHFT29_PRICE_ID` |
| `STRIPE_DRFT_PRICE_ID` | `STRIPE_DRFT29_PRICE_ID` |
| `STRIPE_BUNDLE_PRICE_ID` | `STRIPE_BUNDLE3_PRICE_ID` |

`STRIPE_FLTR_PRICE_ID` is new and unchanged. The Stripe price objects themselves must also
be updated: shft and drft to $29, the bundle to $59 covering all three.

Also outstanding, owner-supplied:
- `public/fltr/hero.png` — the FLTR hero and its card render a deliberate themed empty panel
  until this exists. Nothing looks broken; the hero is simply a placeholder.
- FLTR capability icons (shft and drft have six each; FLTR ships text-only by choice).
- FLTR feature-block screenshots — all six blocks are currently text-only, which is the
  largest remaining reason the three pages do not fully read as one family.

All three flow through genuinely optional fields, so adding them later is a content edit
with no code change.

## Known and deliberately deferred

1. **Dead CSS.** `app/shft/shft.module.css` (68 of 76 classes unused) and
   `app/drft/drft.module.css` (55 of 90) were never touched by the migrations, despite the
   spec listing both as rewritten. ~23 KB ships on every product page. The hazard is not the
   bytes: the dead names include `.hero`, `.block`, `.blockAlt`, `.intro`, `.caps`, `.faq`,
   `.getStarted` — the same names `components/plugin-page/plugin-page.module.css` now owns.
   A maintainer editing `.block` in `drft.module.css` will see nothing change. Wants a prune,
   not a deletion; several classes are still live.
2. **The `three-plugin-bundle` bell alert has no ownership gate** (`lib/site-alerts.ts`).
   The only flag available is `hideForShftOwners`, which cannot express "owns all three", so
   an owner of everything is still shown the $59 offer in their notifications — the one
   surface in this redesign that is not ownership-aware is the one it added.
3. **`--plugin-accent-2` / `--card-accent-2` are written but never read.** drft's LED amber
   `#d99a2b` and FLTR's violet `#8b7fd4` never reach a pixel; all three pages are
   single-accent designs. Harmless plumbing — remove it or use it.
4. **Guest bundle checkout bypasses the ownership guard.** Pre-existing, but this branch
   moved the bundle offer from one page onto a sticky rail across four. A signed-out owner
   can pay $59 and receive nothing; the duplicate-purchase alert fires after the charge.
   Superseded by planned work — see below.
5. **`scripts/backfill-license-keys.ts`** coerces any non-drft product to `"shft"`. Proven
   unreachable for FLTR (no path creates an FLTR purchase with a null licence key), but it
   is a landmine for a fourth plugin.

## Increment 2, spec B — navigation and ticker (complete, 2026-09-26)

Shipped on this same branch. The ticker and the rail had both been advertising the bundle;
they now have separate jobs. The ticker grew to 64px and carries fltr's introductory price
with a real countdown; the rail keeps the bundle. The nav's "Plugins" item gained a hover
dropdown listing the three plugins and the bundle.

**One owner action arms it:** set `NEXT_PUBLIC_FLTR_INTRO_ENDS` to an ISO date **with an
explicit `Z` or offset** — without one it parses as local time and the offer would end at a
different absolute instant in every timezone while Stripe changes at exactly one. Until it is
set the countdown never renders and the ticker behaves as it did before.

**Nothing raises the price when the clock expires.** At zero the clock disappears and the
ticker falls back to whichever offer suits that visitor. Raise `PRICING.fltr.price` and the
Stripe price object together, by hand. The failure mode is therefore a deal running long,
never a page quoting a price Stripe is not charging.

**The lint baseline moved 297 → 298 deliberately.** An `eslint-disable` for
`react-hooks/set-state-in-effect` was removed from `Countdown.tsx` so the count reflects how
many instances actually exist — the same rule fires unsuppressed at `FeatureGateModal.tsx:53`
and `SiteNav.tsx:61`. 298 is correct; treat a return to 297 as suspicious.

**Accepted, not a defect:** the open dropdown covers the ticker's countdown digits. Measured:
it covers only the ticker, never the plugin rail, with roughly 500px of ticker visible either
side and "GET FLTR →" still visible and clickable.

**Deferred from its final review:** `useOwnsShft` and `usePluginOwnership` both fire on every
page carrying `SiteNav`, including pages with no storefront on them. The second returns a
strict superset of the first, so it is one redundant round trip per page view — and the two
have *opposite* failure policies for the same fact: `useOwnsShft` fails open to `owned: false`,
while `usePluginOwnership` surfaces `error` precisely so nothing is offered on unknown
ownership. Consolidating them halves the requests and removes the divergence.

## Increment 2, spec A — cart and checkout (complete, 2026-09-27)

Shipped on this branch. A slide-out cart holds any combination of plugins; a `/checkout`
page identifies the buyer by session or email **before** Stripe; the server re-checks
ownership and never trusts the posted cart; one multi-line-item Stripe session takes the
money. `/plugins` is retired — the cart is the bundle's home.

**Buying without an account still works.** What was removed is *anonymous* checkout, not
guest checkout: the email is now typed on our page rather than Stripe's, one step earlier,
which is what makes it possible to check what someone owns before charging them. The
existing machinery still creates and verifies their account after purchase and mints a
set-password link.

**Reviews on this increment found three defects the implementers' own testing could not
see**, each because they were verifying their design worked rather than trying to break it:

1. **A bypassable ownership gate.** The route accepted any non-empty string as an email and
   never forwarded it to Stripe, so the checked address was not the charged address. A
   guest owning one plugin could POST `{"email":"."}` and buy the $59 bundle. It also fired
   on an ordinary typo.
2. **An unescaped `ILIKE` email lookup.** Prisma's `mode: "insensitive"` compiles to
   `WHERE email ILIKE $1` **unescaped**, so `_` and `%` in an address act as wildcards.
   `john_smith@example.com` could resolve to `johnXsmith@example.com`. Binding
   `customer_email` made it reachable from the grant path — a payment could land on a
   stranger's account. Fixed across **all ten** call sites, including login, password reset
   and licence-key resend, by dropping `mode: "insensitive"` for a plain comparison against
   a pre-lowercased value. Verified safe: 1,736 user rows, 0 mixed-case, all 20 write sites
   lowercase first.
3. **The cart was never emptied after a purchase.** `clear()` existed and was called from
   nowhere, and the ownership drop effect cannot fire for a guest. The double-charge hole
   reopened from the other end, one typo later. Now cleared at `/thanks`, including for
   returning guests whose claim is withheld.

**Production database footgun — fixed, but know it existed.** `.env` holds production
Supabase credentials and `.env.local` overrides them. Next.js layers the two, but a
standalone script run with `node -r dotenv/config` loads only `.env` and hits **production**
— which is how a stray test row briefly reached the live database during this work. It was
deleted. `scripts/ensure-not-production-db.ts` now refuses to run any of the 19
Prisma-touching scripts against a Supabase host unless `ALLOW_PROD_DB=1` is set.
`lib/db.ts` is untouched, so the deployed app is unaffected.

**Lint baseline is now 299**, down from 300 because deleting `PluginsStore.tsx` removed a
pre-existing error with the file. Treat a change in either direction as worth checking.

## Next project — spec C, the interactive hotspot hero

Still to do, and the last piece of the audio-spices comparison:

- A hoverable product image on each plugin page where each knob explains itself, with the
  video loop moved below it.
- **Content-heavy**: it needs a hotspot coordinate and a line of copy for every control on
  three plugins. The copy can be drafted from the changelogs, the manual and the FLTR spec,
  but it needs Troy's correction — and FLTR's cannot be built at all until
  `public/fltr/hero.png` exists.

## Earlier cart decisions, now implemented

- **Cart**, slide-out, in the style of audio-spices.com. Pricing: items sit at their single
  price and the $59 bundle price applies automatically once all three are in the cart, shown
  as one `Bundle — all three (−$18)` line. **No two-item price** — the retired two-plugin
  bundle stays retired, so no progressive tiers.
- **Checkout moves off Stripe's hosted page** to an own-page flow with Stripe Elements:
  billing details on the left, live order summary on the right, and account creation
  (no email verification) *or* sign-in before payment. A confirm-email field is required,
  since licence keys are delivered by email and there is no verification step to catch typos.
- Prerequisites: `lib/plugin-checkout.ts` takes a single `priceId` today and the webhook
  grants via `PLUGIN_GRANTS[product]` — a cart needs multi-line-item sessions and
  grant-an-arbitrary-set.
- **Open question for that spec:** whether a pure-guest path survives at all. Guest checkout
  shipped to production on 2026-09-07 and was migrated across all 1,912 users; requiring an
  account at checkout reverses that decision rather than extending it. Requiring one is also
  what finally closes deferred item 4 above.
