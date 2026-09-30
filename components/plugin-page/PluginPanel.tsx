"use client"

import { useState, type CSSProperties, type ReactNode } from "react"
import type { Panel, PanelShot, PanelSpot } from "./types"
import styles from "./plugin-panel.module.css"

/** A spot's box as percentages of its shot, so it scales with the image. */
function boxOf(spot: PanelSpot, shot: PanelShot): CSSProperties {
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`
  return {
    left: pct(spot.at.x - spot.at.w / 2, shot.width),
    top: pct(spot.at.y - spot.at.h / 2, shot.height),
    width: pct(spot.at.w, shot.width),
    height: pct(spot.at.h, shot.height),
  }
}

/**
 * How far each spot's touch target may grow past its own box, in the shot's
 * pixels, without reaching a neighbour's. A knob on a phone is 20 to 30px
 * across and wants to be 44; the knobs either side of it want the same, and
 * in a row of six there is not room for all of them. So each spot may grow by
 * half the gap to whatever is next to it, and no further - two fingertips'
 * worth of target never lands on one control.
 *
 * For each pair, the two are apart along x, along y, or both. Growth is only
 * limited along the axis that separates them (the wider gap, when it is
 * both): that alone keeps the pair from overlapping, and leaves the other axis
 * free. Spots that already overlap - a badge on a knob, anything on the tube -
 * are left out: there is no gap between them to share.
 */
function growth(spots: readonly PanelSpot[]): { x: number; y: number }[] {
  const edges = (s: PanelSpot) => ({
    l: s.at.x - s.at.w / 2, r: s.at.x + s.at.w / 2, t: s.at.y - s.at.h / 2, b: s.at.y + s.at.h / 2,
  })
  return spots.map((s, i) => {
    const a = edges(s)
    let x = Infinity
    let y = Infinity
    spots.forEach((o, j) => {
      if (j === i) return
      const b = edges(o)
      const gapX = Math.max(b.l - a.r, a.l - b.r, 0)
      const gapY = Math.max(b.t - a.b, a.t - b.b, 0)
      if (gapX === 0 && gapY === 0) return
      if (gapX >= gapY) x = Math.min(x, gapX / 2)
      else y = Math.min(y, gapY / 2)
    })
    return { x, y }
  })
}

/**
 * A panel much wider than it is tall. shft's screenshots are 1.21 to 1 and
 * drft's 1.29; fltr's are 1.73, the whole of a 1280px interface. It needs
 * more room than the others: most of the hero on a desktop, and on a phone
 * the full width of the screen, edge to edge (see Hero and its stylesheet).
 */
export const isWidePanel = (panel: Panel): boolean => {
  const shot = panel.views[0]?.shot
  return shot ? shot.width / shot.height > 1.5 : false
}

/** The most a target may be, as a percentage of the spot's own side. */
const reach = (side: number, grow: number) =>
  Number.isFinite(grow) ? `${(((side + 2 * grow) / side) * 100).toFixed(1)}%` : "1000%"

/**
 * The plugin's own interface as the hero: a screenshot that says what each
 * control does as the pointer crosses it, in a bar underneath. It is the help
 * bar the plugins themselves carry along their bottom edge ("hover any control
 * to see what it does"), made true of the picture of them.
 *
 * Nothing moves until it is pointed at. Hovering, focusing or tapping a
 * control rings it and fills the bar; the bar keeps the last control it was
 * given, so its text does not vanish while it is being read. The plugin's own
 * page tabs in the screenshot are real: clicking one swaps the screenshot for
 * that page's, with that page's controls.
 *
 * Where there is no pointer to hover with, tapping does the same job — and the
 * page tabs, which are a few millimetres wide on a phone, are repeated as
 * full-size buttons in the bar (see the stylesheet's `hover: none` rule).
 *
 * `fallback` is what to show if the first screenshot fails to load. It is
 * passed in rather than imported because MediaFallback lives in sections.tsx,
 * which imports this file.
 */
export default function PluginPanel({
  panel,
  fallback = null,
  className = "",
}: {
  panel: Panel
  fallback?: ReactNode
  className?: string
}) {
  const [viewId, setViewId] = useState(panel.views[0]?.id)
  const [spotId, setSpotId] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const first = panel.views[0]
  if (!first) return null
  if (failed) return <>{fallback}</>

  const view = panel.views.find((v) => v.id === viewId) ?? first
  const spot = view.spots.find((s) => s.id === spotId) ?? null

  // The same two-sided check MediaSlot makes: `onError` hears a failure after
  // hydration, the ref catches one that finished before any listener existed.
  const onFail = () => setFailed(true)
  const alreadyFailed = (el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0 && el.src) onFail()
  }

  // A page tab keeps the bar on itself after the click, in the new view, so
  // what was just clicked is what the bar is still talking about. Every view
  // carries the tabs under the same ids, which is what makes that work.
  const open = (s: PanelSpot) => {
    setSpotId(s.id)
    if (s.opens && panel.views.some((v) => v.id === s.opens)) setViewId(s.opens)
  }

  const tone = spot?.tone ?? "var(--panel-accent)"
  const room = growth(view.spots)

  return (
    <div
      className={`${styles.panel} ${className}`}
      style={{
        ["--panel-ratio" as string]: (first.shot.width / first.shot.height).toFixed(4),
        ...(panel.theme
          ? {
              ["--panel-ground" as string]: panel.theme.ground,
              ["--panel-ink" as string]: panel.theme.ink,
              ["--panel-accent" as string]: panel.theme.accent,
            }
          : {}),
      }}
      data-plugin-panel
      data-panel-wide={isWidePanel(panel) ? "" : undefined}
      data-panel-view={view.id}
      data-panel-spot={spot?.id ?? ""}
    >
      <div className={styles.screen} style={{ aspectRatio: `${first.shot.width} / ${first.shot.height}` }}>
        {panel.views.map((v, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={v.id}
            ref={i === 0 ? alreadyFailed : undefined}
            className={`${styles.shot} ${v.id === view.id ? styles.shotOn : ""}`}
            src={v.shot.src}
            alt={v.id === view.id ? v.shot.alt : ""}
            aria-hidden={v.id === view.id ? undefined : true}
            width={v.shot.width}
            height={v.shot.height}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            onError={i === 0 ? onFail : undefined}
          />
        ))}

        {spot && (
          <span
            className={`${styles.ring} ${spot.round ? styles.round : ""}`}
            style={{ ...boxOf(spot, view.shot), ["--tone" as string]: tone }}
            data-panel-ring
            aria-hidden
          />
        )}

        {view.spots.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.spot} ${s.round ? styles.round : ""} ${s.opens && s.opens !== view.id ? styles.door : ""}`}
            style={boxOf(s, view.shot)}
            aria-label={s.opens && s.opens !== view.id ? `${s.name} — open` : s.name}
            aria-describedby={`panel-text-${view.id}-${s.id}`}
            data-panel-hit={s.id}
            data-panel-opens={s.opens && s.opens !== view.id ? s.opens : undefined}
            onMouseEnter={() => setSpotId(s.id)}
            onFocus={() => setSpotId(s.id)}
            onClick={() => open(s)}
          >
            {/* The touch target: see `growth` above, and `.reach` in the
                stylesheet, which only gives it a size where there is no
                pointer to aim with. */}
            <span
              className={styles.reach}
              style={{ ["--reach-x" as string]: reach(s.at.w, room[i].x), ["--reach-y" as string]: reach(s.at.h, room[i].y) }}
            />
          </button>
        ))}
      </div>

      <div className={styles.bar}>
        {/* Only shown where there is no pointer to hover with. */}
        {panel.views.length > 1 && (
          <div className={styles.pages} data-panel-pages>
            {panel.views.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`${styles.page} ${v.id === view.id ? styles.pageOn : ""}`}
                aria-pressed={v.id === view.id}
                data-panel-page={v.id}
                onClick={() => {
                  setViewId(v.id)
                  setSpotId(null)
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* Every text the bar can show sits in the same grid cell and only the
            current one is visible, so the bar is always as tall as its longest
            and nothing on the page moves as the pointer does. */}
        <div className={styles.texts} aria-live="polite">
          <p className={`${styles.text} ${styles.idle} ${spot ? "" : styles.textOn}`} aria-hidden={spot ? true : undefined} data-panel-idle>
            <span className={styles.idleHover}>{panel.idle}</span>
            <span className={styles.idleTouch}>{panel.idleTouch}</span>
          </p>
          {panel.views.map((v) =>
            v.spots.map((s) => {
              const on = v.id === view.id && s.id === spot?.id
              return (
                <div
                  key={`${v.id}-${s.id}`}
                  id={`panel-text-${v.id}-${s.id}`}
                  className={`${styles.text} ${on ? styles.textOn : ""}`}
                  aria-hidden={on ? undefined : true}
                  data-panel-text={on ? s.id : undefined}
                >
                  <span className={styles.name} style={{ color: s.tone ?? "var(--panel-accent)" }}>{s.name}</span>
                  <span>{s.what}</span>
                  {/* A page tab's tip is where a click on it leads, which is
                      nowhere when it is the page already showing. */}
                  {s.tip && !(s.opens && s.opens === v.id) ? (
                    <>
                      <span className={styles.try}>{s.opens ? "click" : "try"}</span>
                      <span className={styles.tip}>{s.tip}</span>
                    </>
                  ) : null}
                </div>
              )
            }),
          )}
        </div>
      </div>
    </div>
  )
}
