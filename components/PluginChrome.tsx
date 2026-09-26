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
    const href = missing.length === 1 ? PLUGINS[missing[0]].href : "/plugins"
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

  // 5. Owns nothing: the bundle.
  const save = PRICING.bundle.compareAt - PRICING.bundle.price
  return (
    <div className={styles.strip} data-sale-strip data-strip-variant="bundle">
      <Link href="/plugins#bundle" className={styles.stripInner}>
        <span className={styles.stripLabel}>All three plugins</span>
        <span className={styles.stripPrice}>${PRICING.bundle.price}</span>
        <s className={styles.stripWas}>${PRICING.bundle.compareAt}</s>
        <span className={styles.stripSave}>Save ${save}</span>
        <span className={styles.stripArrow} aria-hidden>→</span>
      </Link>
    </div>
  )
}

export default function PluginChrome({ active }: { active?: PluginId }) {
  const { loading, error, owned, ownedCount, missing } = usePluginOwnership()
  const [hovered, setHovered] = useState<PluginId | null>(null)

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
          <Link
            href="/plugins#bundle"
            className={styles.bundlePill}
            data-bundle-pill
            onClick={() => trackMeta("ViewContent", { content_name: "bundle", content_type: "product" })}
          >
            All three · ${PRICING.bundle.price} <span aria-hidden>→</span>
          </Link>
        )}
        {!loading && !error && ownedCount > 0 && (
          <Link href="/products" className={styles.ownedLink}>
            My products <span aria-hidden>→</span>
          </Link>
        )}
      </nav>
    </div>
  )
}
