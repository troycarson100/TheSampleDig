"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import Countdown from "@/components/Countdown"
import PluginGlyph from "@/components/plugin-page/PluginGlyph"
import styles from "@/components/plugin-chrome.module.css"
import { countWord, introWindow, pluginList, PLUGIN_ORDER, PLUGINS, type PluginId } from "@/lib/plugins"
import { PRICING } from "@/lib/products"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"
import { trackMeta } from "@/lib/meta-pixel"
import { useCart } from "@/components/CartProvider"

/** Joins names the way a sentence does: "drft and fltr". */
function nameList(ids: PluginId[]): string {
  const names = ids.map((id) => PLUGINS[id].name)
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** The dark offer band. Never offers a visitor something they already own. */
function SaleStrip({ loading, error, owned, ownedCount, missing }: {
  loading: boolean
  error: boolean
  owned: Record<PluginId, boolean>
  ownedCount: number
  missing: PluginId[]
}) {
  // Re-render when the clock runs out so the strip falls through to the next
  // branch for this visitor, without a reload.
  const [, setExpiredAt] = useState<number | null>(null)
  const intro = introWindow()
  // introWindow() returns a fresh Date instance on every call, and this
  // component re-renders on every unrelated change to `hovered` below (the
  // rail's own hover state) — without memoising, Countdown's effect (keyed on
  // [endsAt, onExpire]) would see a "new" endsAt and onExpire on every pill
  // hover and tear down + rebuild its interval for no reason. Keyed on the
  // timestamp, not the Date object, since introWindow's raw source (env) is
  // stable but the instances it mints are not.
  const introEndsMs = intro.endsAt?.getTime() ?? null
  const endsAt = useMemo(() => (introEndsMs === null ? null : new Date(introEndsMs)), [introEndsMs])
  const onExpire = useCallback(() => setExpiredAt(Date.now()), [])
  const { addAll, open: openCart } = useCart()

  // 1. Unknown ownership: reserve the height, offer nothing.
  if (loading || error) return <div className={styles.strip} data-sale-strip aria-hidden />

  // 2. Owns everything: there is nothing honest to advertise.
  if (ownedCount === PLUGIN_ORDER.length) return null

  // 3. fltr's intro price is the only genuinely time-limited price on the site,
  //    so it outranks the partial-owner nudge while it is running. Also
  //    requires the price to actually be a discount: if fltr's price were
  //    raised to (or past) its MSRP before the deadline passed, this would
  //    otherwise keep advertising a "sale" that no longer saves anyone money —
  //    $49 struck against $49, clock still running.
  if (!owned.fltr && intro.live && endsAt && PRICING.fltr.price < PRICING.fltr.msrp) {
    return (
      <div className={styles.strip} data-sale-strip data-strip-variant="intro">
        <Link href={PLUGINS.fltr.href} className={styles.stripInner}>
          <span className={styles.stripNew}>New</span>
          <span className={styles.stripLabel}>{PLUGINS.fltr.name} intro price</span>
          <span className={styles.stripPrice}>${PRICING.fltr.price}</span>
          <s className={styles.stripWas}>${PRICING.fltr.msrp}</s>
          <Countdown
            endsAt={endsAt}
            onExpire={onExpire}
            className={styles.stripClock}
          />
          <span className={styles.stripLabel}>Get {PLUGINS.fltr.name}</span>
          <span className={styles.stripArrow} aria-hidden>→</span>
        </Link>
      </div>
    )
  }

  // 4. Owns one or two: offer only what is missing, at single price.
  if (ownedCount > 0) {
    const total = missing.reduce((sum, id) => sum + PRICING[id].price, 0)
    const href = missing.length === 1 ? PLUGINS[missing[0]].href : "/shft"
    return (
      <div className={styles.strip} data-sale-strip data-strip-variant="partial">
        <Link href={href} className={styles.stripInner}>
          <span className={styles.stripLabel}>
            {missing.length === 1 ? "Complete the rack" : `${countWord(missing.length)} left`}
          </span>
          <span className={styles.stripNames}>{nameList(missing)}</span>
          <span className={styles.stripPrice}>${total}</span>
          <span className={styles.stripArrow} aria-hidden>→</span>
        </Link>
      </div>
    )
  }

  // 5. Owns nothing: the bundle. A real button, not a link — this opens the
  // cart in place rather than navigating anywhere.
  const save = PRICING.bundle.compareAt - PRICING.bundle.price
  return (
    <div className={styles.strip} data-sale-strip data-strip-variant="bundle">
      <button
        type="button"
        className={`${styles.stripInner} ${styles.stripButton}`}
        onClick={() => { addAll(); openCart() }}
      >
        <span className={styles.stripLabel}>All three plugins</span>
        <span className={styles.stripPrice}>${PRICING.bundle.price}</span>
        <s className={styles.stripWas}>${PRICING.bundle.compareAt}</s>
        <span className={styles.stripSave}>Save ${save}</span>
        <span className={styles.stripArrow} aria-hidden>→</span>
      </button>
    </div>
  )
}

export default function PluginChrome({ active }: { active?: PluginId }) {
  const { loading, error, owned, ownedCount, missing } = usePluginOwnership()
  const [hovered, setHovered] = useState<PluginId | null>(null)
  /** Bumped to remount the bundle glyphs so their draw-in animation replays. */
  const [bundleBeat, setBundleBeat] = useState(0)
  const { ids: cartIds, addAll, open: openCart } = useCart()

  return (
    <div className={styles.chrome}>
      <SaleStrip loading={loading} error={error} owned={owned} ownedCount={ownedCount} missing={missing} />

      <nav className={styles.rail} data-plugin-rail aria-label="Plugins">
        <ul className={styles.pills}>
          {pluginList().map((p) => {
            const isActive = p.id === active
            return (
              <li key={p.id}>
                <Link
                  href={p.href}
                  className={styles.pill}
                  data-pill={p.id}
                  data-active={isActive ? "true" : "false"}
                  aria-current={isActive ? "page" : undefined}
                  style={{ ["--pill-accent" as string]: p.accent }}
                  onMouseEnter={() => setHovered(p.id)}
                  onMouseLeave={() => setHovered((h) => (h === p.id ? null : h))}
                >
                  <PluginGlyph id={p.id} animate={isActive || hovered === p.id} className={styles.pillGlyph} />
                  <span>{p.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        {!loading && !error && ownedCount === 0 && (
          <button
            type="button"
            className={styles.bundlePill}
            data-bundle-pill
            onMouseEnter={() => setBundleBeat((n) => n + 1)}
            onFocus={() => setBundleBeat((n) => n + 1)}
            onClick={() => {
              trackMeta("ViewContent", { content_name: "bundle", content_type: "product" })
              addAll()
              openCart()
            }}
          >
            {/* Every other pill carries one plugin's glyph. This is the only
                control entitled to carry all three, so the marks themselves
                state what the offer contains — the page's own grammar rather
                than added decoration. */}
            {/* The marks draw themselves — shft's gate steps through, drft's
                scanline tears, fltr's curve sweeps — once on mount and again on
                hover, staggered left to right. That is the reward for reaching
                the control; the looping light pass in the stylesheet is what
                draws the eye to it in the first place. `bundleBeat` remounts
                them, which is what replays a CSS animation; PluginGlyph already
                silences all of it under prefers-reduced-motion. */}
            <span className={styles.bundleGlyphs} aria-hidden>
              {pluginList().map((p) => (
                <PluginGlyph key={`${p.id}-${bundleBeat}`} id={p.id} size={14} animate className={styles.bundleGlyph} />
              ))}
            </span>
            <span className={styles.bundleLabel}>All three</span>
            <span className={styles.bundlePrice}>${PRICING.bundle.price}</span>
            <s className={styles.bundleWas}>${PRICING.bundle.compareAt}</s>
            <span className={styles.bundleArrow} aria-hidden>→</span>
          </button>
        )}
        {!loading && !error && ownedCount > 0 && (
          <Link href="/products" className={styles.ownedLink}>
            My products <span aria-hidden>→</span>
          </Link>
        )}

        {/* The only way to open the cart from the site chrome — otherwise it
            appears solely as a side effect of adding something, and an
            abandoned cart becomes invisible and unreachable. A real button:
            it opens the drawer in place and never navigates. Always rendered,
            including at zero, so its position in the rail is constant and the
            count is a readout rather than an element that appears and
            disappears under the cursor. */}
        <button
          type="button"
          className={styles.cartButton}
          data-cart-button
          onClick={openCart}
          aria-label={`Open cart, ${cartIds.length} item${cartIds.length === 1 ? "" : "s"}`}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden focusable="false" className={styles.cartIcon}>
            <path
              d="M2 3h2.2l1.1 2m0 0 1.9 7.6h8l2.3-6.4H5.2ZM8.5 16.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.cartCount}>{cartIds.length}</span>
        </button>
      </nav>
    </div>
  )
}
