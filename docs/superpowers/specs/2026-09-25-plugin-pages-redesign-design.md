# Plugin pages redesign + FLTR launch

Date: 2026-09-25
Branch: `feat/plugin-pages-redesign`

## Goal

Make the plugin range feel like one storefront you never leave. Today `/plugins`,
`/shft` and `/drft` are three unrelated pages; from a product page there is no way
to reach a sibling plugin or see the bundle without going back. The redesign adds a
persistent sale strip and plugin rail above every plugin page, rebuilds the two
product pages onto one shared template, and adds a third plugin, FLTR.

Inspired by the layout of audio-spices.com/anise: a dark offer strip under the nav,
a cream rail of plugin pills below it with a visually distinct bundle CTA, then the
product hero.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Redesign depth | Full rebuild of shft and drft onto a shared template | Three pages that are visibly one family; the alternative left the pages themselves untouched |
| Third plugin | FLTR, live and buyable at launch | Not a waitlist tease |
| Plugin name | `FLTR` | Chosen over the `sift` branding currently in the plugin UI. **The in-app logo still reads `sift` and needs changing separately — out of scope here** |
| Pricing | shft $29, drft $29, FLTR $19 intro; MSRP $49 each | Replaces $19/$19 with MSRP $39 |
| Bundle | All three, $59, struck against $147 (save $88) | The two-plugin bundle is retired |
| Upgrade path | None. Singles only | Existing owners buy what they are missing at single price; `crossgrade` is deleted entirely |
| FLTR intro price | $19 with no announced end | No countdown anywhere; nothing to expire |
| Sale strip | Evergreen, ownership-aware, no countdown | Follows from having no deadline to count to |
| Release timing | Whole release held until FLTR is ready to ship | One coherent pricing story; branch stays unmerged until then |

### Known consequence, accepted

Early customers who paid $19 for one plugin now pay $29 + $19 = $48 to complete the
set, reaching $67 total — more than the $59 a brand-new customer pays for all three.
This was raised and the no-upgrade-path option was chosen deliberately. Recorded here
so it is a known trade-off rather than a surprise in a support email.

## Scope

**In:** `/plugins` redesign; shft and drft rebuilt on a shared template; new `/fltr`
page; shared chrome component; new pricing; FLTR commerce (checkout, ownership,
product definition, downloads); removal of crossgrade; retirement of `/offers`.

**Out:** the plugin binaries themselves; Stripe dashboard configuration; the `sift`→
`FLTR` rename inside the plugin; any change to `/dig`, `/pro` or the marketplace.

## Architecture

### 1. `lib/plugins.ts` — marketing catalog (new)

`lib/products.ts` is about downloads and licensing — assets, changelogs, object keys —
and is already ~400 lines, most of it changelog prose. The presentation concerns
(display order, category line, accent colour, art paths) are a different axis and go
in their own module, joined to products by id.

```ts
export const PLUGIN_ORDER = ["shft", "drft", "fltr"] as const
export type PluginId = (typeof PLUGIN_ORDER)[number]

export interface PluginMeta {
  id: PluginId
  name: string          // "shft"
  category: string      // "trance gate" | "vhs / crt fx" | "filter in key"
  tagline: string       // one sentence, used on cards and hero
  accent: string        // pill dot + page accent
  ground: "light" | "warm" | "dark"
  href: string
  art: { card: string; hero: string; heroPoster?: string }
}

export const PLUGINS: Record<PluginId, PluginMeta>
```

Themes, confirmed against the existing CSS modules and the FLTR UI screenshot:

| Plugin | Ground | Accent | Source |
|---|---|---|---|
| shft | light cream `#efe9dc` on ink `#24211d` | burnt orange → gold `#a6633c`→`#d9a040` | existing `shft.module.css` |
| drft | warm chassis `#e0c69f` | LED pink/amber/red `#ef1f71` `#d99a2b` `#c8402e` | existing `drft.module.css` |
| FLTR | near-black `#0d1117` | teal `#4fd1c5` with violet secondary | the plugin UI itself |

Three distinct grounds, one house. FLTR being dark is what keeps it from reading as a
recolour of shft.

### 2. `components/PluginChrome.tsx` — the shared chrome (new)

Rendered under `SiteNav` on `/plugins`, `/shft`, `/drft`, `/fltr`. Cream ground on
every page regardless of that page's own theme, so the rail is a constant.

```
┌─ SiteNav ──────────────────────────────────────────┐
├─ SALE STRIP   dark #1a1714, scrolls away           │
│    ALL THREE PLUGINS · $59  $̶1̶4̶7̶  save $88     →   │
├─ PILL RAIL    cream #efe9dc, sticky on scroll      │
│    ● shft   ● drft   ● fltr    [ all three $59 → ] │
└────────────────────────────────────────────────────┘
```

**Pill rail.** One pill per plugin in `PLUGIN_ORDER`, each with its accent dot; the
active plugin's pill is filled dark. A final, visually distinct bundle pill uses the
existing burnt-orange→gold gradient — already the house "hot" colour, so it reads as
the loud one without introducing a new hue. Sticky on scroll: this is what produces
the "always on one page" feeling that motivated the redesign. Horizontally scrollable
below ~520px rather than wrapping.

**Sale strip.** Ownership-aware, and this is load-bearing. With crossgrade gone, showing
"all three for $59" to someone who already owns shft would charge them for shft a second
time. So:

| Owns | Strip shows |
|---|---|
| nothing | the bundle — all three, $59, save $88 |
| exactly two | the single plugin they are missing, at its own price |
| exactly one | the two they are missing, named, at their combined single price — linking to `/plugins` rather than a checkout, since there is no two-plugin price to charge |
| all three | no strip at all |

This also closes the duplicate-purchase hole recorded in `2026-09-22-block-duplicate-purchases-design.md`
for the bundle path specifically — it stops advertising a bundle that would re-charge
for an owned plugin. It does **not** replace the blocking gate that spec describes; the
server-side guard is still the real fix and remains unbuilt.

**Ownership data.** One `/api/plugins/ownership` returning all three products in a single
response, replacing the current per-plugin fetches. With three plugins the existing
pattern would fire three requests on every plugin page.

### 3. `components/plugin-page/` — the shared product template (new)

| Component | Role |
|---|---|
| `PluginHero` | badge, category line, large name, description, buy row, media slot |
| `PluginIntro` | single statement + supporting media |
| `PluginBlocks` | alternating feature blocks, driven by data |
| `PluginCaps` | capability grid (formats, platforms) |
| `PluginFaq` | question list |
| `PluginBuy` | closing purchase section |
| `PluginStickyBuy` | sticky buy bar, generalised from drft's existing one |

Theming through CSS custom properties (`--plugin-accent`, `--plugin-ground`,
`--plugin-ink`) set on one wrapper element, so identical markup renders light shft,
warm drft and dark FLTR.

Each page becomes **data plus template**: `app/<id>/content.ts` exports the blocks,
capabilities and FAQ as arrays. This is what collapses ~900 lines of hand-built page
into three thin ones, and it is what makes the three pages stay consistent as they change.

Media handling carries over from the existing pages: `<video>` with poster frame where a
video exists, still image otherwise, and a graceful fallback when an asset is absent so
a missing file looks intentional rather than broken.

### 4. `/plugins` index

Sale strip and rail from the shared chrome, then:
- Bundle panel leading the page — all three, $59 struck against $147. Its ownership
  states reduce to: owns none (bundle), owns some (buy what is missing), owns all
  (link to My Products). The four-state crossgrade logic is gone.
- Three plugin cards in `PLUGIN_ORDER`, each themed to its plugin.

### 5. `/fltr` page content

Built from the supplied FLTR spec.

- **Hero** — badge `OUT NOW`, category `filter in key`, name `FLTR`, one-sentence
  description, buy row `$19` struck `$49`. Media: the plugin UI still at
  `public/fltr/hero.png`.
- **Intro** — a filter that plays in key.
- **Blocks:**
  1. *Twelve characters* — Ladder, SEM, Disperse, Phase, Shift, Comb, Formant, Fold,
     Liquid, Shatter, Chord, Harmony; the Shape morph; level-matched so switching
     changes colour, not volume.
  2. *Chord and Harmony* — partials snapped to a chord; root plus 14 scales including a
     custom one; chord wheel I–VII with glide; Pull (Snap→Conform), Wave, Power, OTT,
     Arp, Quality.
  3. *Topologies and drive* — two cores as Single, Series, Parallel, Split L/R, Split M/S
     or Band, plus Width; Soft/Transistor/Fold saturation pre or post; 1×/2×/4×
     oversampling; auto-gain.
  4. *Movement* — Follow, Move, Draw, Macro; drag-and-drop routing with depth chips;
     cutoff modulation in semitones (±48) so a depth is the same musical distance
     wherever the filter sits.
  5. *Push* — Tune, Keytrack, Feedback (Comb, Spiral, Bloom), FM, Smear, Freeze.
  6. *The interface* — the live filter curve drawn ~30×/sec with a ghost of the set curve
     behind it when modulation moves it; the pad; drag footers; the Tune keyboard;
     presets as plain files you can move, share and version.
- **Capabilities** — VST3, AU, Standalone; JUCE 8; macOS universal binary (Apple silicon
  and Intel). **Windows support is unconfirmed — see Open questions.**
- **FAQ** — one-time purchase with free updates; formats and platforms; system
  requirements; what separates it from an ordinary filter.

### 6. Commerce

`PRICING` in `lib/products.ts`:

```ts
shft:   { price: 29, msrp: 49 }
drft:   { price: 29, msrp: 49 }
fltr:   { price: 19, msrp: 49 }   // intro price, no announced end
bundle: { price: 59, compareAt: 147, msrp: 147 }
// crossgrade: deleted
```

Prices are struck against MSRP throughout, matching the existing house convention.
Bundle saves $88 against MSRP (and $18 against the three sale prices).

- **`lib/products.ts`** gains an `fltr` `ProductDef`: blurb, version, assets. Object keys
  follow the drft pattern — module-level consts, env-overridable, filename derived from
  the key via `basename()` so the download name can never drift from the object served.
- **`/api/fltr/checkout`** and FLTR handling in ownership, mirroring shft and drft.
- **`/api/bundle/checkout`** grants all three products. Its `own_one` → crossgrade branch
  is removed. Ownership guards become: owns all three → `409 already_owned`; owns one or
  two → `409 partial_owner` with the owned ids, which the client handles by reloading so
  the page re-renders the singles it should have shown. A partial owner must never reach
  bundle checkout, because there is no bundle price that is correct for them — they would
  be charged for a plugin they already have.
- **No Prisma migration.** `Purchase.product` is a plain `String` with
  `@@unique([userId, product])`; `"fltr"` needs no schema change.

## Cleanup this forces

| Where | Change |
|---|---|
| `app/offers/` | No offers remain once crossgrade dies. Redirect `/offers` → `/plugins`, delete `OffersView.tsx` and `offers.module.css` |
| `app/api/{shft,drft}/ownership` | Drop the `crossgrade` flag |
| `app/plugins/PluginsStore.tsx` | Rebuilt; crossgrade states gone |
| `app/drft/DrftLanding.tsx` | Rebuilt on the template; ~12 crossgrade references gone |
| `components/ShftPromoDock.tsx` | Quotes the old $19 price |
| Page metadata | `/plugins`, `/shft`, `/drft`, `/offers` descriptions all quote old prices |
| `app/shft/ShftLanding.tsx`, `app/drft/DrftLanding.tsx` | FAQ copy hardcodes "$19 launch price ... off $39" |

## File map

```
NEW
  lib/plugins.ts                          marketing catalog
  components/PluginChrome.tsx             sale strip + pill rail
  components/plugin-chrome.module.css
  components/plugin-page/*.tsx            shared template components
  components/plugin-page/*.module.css
  app/api/plugins/ownership/route.ts      all three in one response
  app/api/fltr/checkout/route.ts
  app/fltr/page.tsx
  app/fltr/FltrLanding.tsx
  app/fltr/content.ts
  app/fltr/fltr.module.css
  app/shft/content.ts
  app/drft/content.ts
  public/fltr/hero.png                    SUPPLIED BY TROY

REWRITTEN
  app/plugins/PluginsStore.tsx  app/plugins/plugins.module.css
  app/shft/ShftLanding.tsx      app/shft/shft.module.css
  app/drft/DrftLanding.tsx      app/drft/drft.module.css

EDITED
  lib/products.ts               PRICING, fltr ProductDef
  app/api/bundle/checkout/route.ts
  app/api/{shft,drft}/ownership/route.ts
  components/ShftPromoDock.tsx
  components/SiteNav.tsx        active state must include /fltr

DELETED
  app/offers/OffersView.tsx  app/offers/offers.module.css
```

## Verification

Playwright against the dev server, following the project's usual pattern
(`createRequire` on the project `package.json`, dev server normally already on :3000).

1. Rail renders on all four plugin pages, with the correct pill marked active on each.
2. Bundle pill and sale-strip CTA both reach bundle checkout.
3. Sale strip renders the right variant for owns-none / owns-some / owns-all.
4. Rail stays fixed while the page scrolls; scrolls horizontally at 375px wide.
5. All three product pages render every template section with their own theme applied.
6. Every displayed price comes from `PRICING` — grep gate proving no literal `$19`,
   `$34`, `$15` or `$39` survives in plugin pages or metadata.
7. Grep gate proving no `crossgrade` identifier survives outside the spec archive.
8. `npm run lint` and `npm run build` clean.

Ownership states are exercised by signing in as a local test account, per the project's
existing approach to verifying account-dependent pages.

## Launch checklist — actions only Troy can take

These gate the merge, since the release is held for FLTR.

- [ ] Finish FLTR Phase 5 (A/B, undo, CI)
- [ ] Save the plugin UI screenshot to `public/fltr/hero.png`
- [ ] Build and upload the FLTR installer(s); set the object keys
- [ ] Create the Stripe price for FLTR; set `STRIPE_FLTR_PRICE_ID`
- [ ] Update the Stripe bundle price to $59 and confirm `STRIPE_BUNDLE_PRICE_ID`
- [ ] Raise the shft and drft Stripe prices to $29
- [ ] Decide the `sift` → `FLTR` rename inside the plugin UI
- [ ] Confirm whether FLTR ships on Windows at launch

## Open questions

1. **Windows.** shft and drft both ship macOS + Windows. The FLTR spec describes a macOS
   universal binary and `auval`, with no Windows mention. The capabilities block and the
   product definition's assets must not claim Windows unless it is real. Assumed
   **macOS-only at launch** until confirmed; if Windows lands, it is an additive change
   to `content.ts` and one more asset entry.
2. **FLTR version number** for `lib/products.ts` — assumed `1.0.0`.
