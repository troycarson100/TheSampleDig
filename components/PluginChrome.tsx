"use client"

import Link from "next/link"
import { useState } from "react"
import PluginGlyph from "@/components/plugin-page/PluginGlyph"
import styles from "@/components/plugin-chrome.module.css"
import { countWord, pluginList, PLUGIN_ORDER, PLUGINS, type PluginId } from "@/lib/plugins"
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
function SaleStrip({ loading, error, ownedCount, missing }: {
  loading: boolean
  error: boolean
  ownedCount: number
  missing: PluginId[]
}) {
  // Owns everything: there is nothing honest to advertise.
  if (!loading && !error && ownedCount === PLUGIN_ORDER.length) return null

  // Reserve the height while ownership resolves — or failed to resolve — so
  // the page does not jump and nothing gets offered on unknown ownership.
  if (loading || error) return <div className={styles.strip} data-sale-strip aria-hidden />

  if (ownedCount === 0) {
    const save = PRICING.bundle.compareAt - PRICING.bundle.price
    return (
      <div className={styles.strip} data-sale-strip>
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

  // Owns one or two. Offer only what is missing, at single price.
  const total = missing.reduce((sum, id) => sum + PRICING[id].price, 0)
  const href = missing.length === 1 ? PLUGINS[missing[0]].href : "/plugins"
  return (
    <div className={styles.strip} data-sale-strip>
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

export default function PluginChrome({ active }: { active?: PluginId }) {
  const { loading, error, ownedCount, missing } = usePluginOwnership()
  const [hovered, setHovered] = useState<PluginId | null>(null)

  return (
    <div className={styles.chrome}>
      <SaleStrip loading={loading} error={error} ownedCount={ownedCount} missing={missing} />

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
