"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ChartPoint } from "@/lib/attribution-chart"
import {
  zoomRangeAt,
  panRange,
  daySpan,
  shiftDayKey,
  pickPoints,
  withUsableSpan,
  MAX_SPAN_DAYS,
} from "@/lib/attribution-chart"

/**
 * Traffic over time for the admin attribution page.
 *
 * The page ships a year of daily counts and a week of hourly ones up front,
 * and the visible window is client state. Zooming and panning are therefore
 * pure local windowing - instant, and continuous under a trackpad pinch -
 * rather than a navigation each time. The URL catches up on a short debounce,
 * which is what re-renders the tables below.
 *
 * Every control is still a real link or a real GET form underneath, so the
 * page works by keyboard and without JavaScript; the handlers just intercept
 * first when a script is running.
 *
 * Landings are a line, drawn deliberately quiet; signups and sales sit above
 * it in the loud colour with a connector down to the day that produced them.
 * Traffic is context, conversions are the thing you came to find.
 */

type Props = {
  /** Daily counts for the whole preloaded history, oldest first. */
  daily: ChartPoint[]
  /** Hourly counts for the recent past only. */
  hourly: ChartPoint[]
  /** First day the hourly series covers. */
  hourlyFrom: string
  /** The window the server rendered the tables for. */
  committedFrom: string
  committedTo: string
  todayKey: string
  selectedKey: string | null
}

const W = 900
const H = 210
const SIGNUP_Y = 12
const SALE_Y = 32
const PLOT_TOP = 48
const BASELINE = 172
const PLOT_H = BASELINE - PLOT_TOP
const LABEL_Y = 192

const fg = "var(--foreground)"
const primary = "var(--primary)"
/** Roughly half the readout's width, used to keep it clear of the edges. */
const TIP_HALF = 132
/** How long after the last gesture the URL - and so the tables - catch up. */
const COMMIT_DELAY_MS = 350

type View = { from: string; to: string }

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function viewHref(v: View): string {
  return `?from=${v.from}&to=${v.to}`
}

export default function AttributionChart({
  daily,
  hourly,
  hourlyFrom,
  committedFrom,
  committedTo,
  todayKey,
  selectedKey,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  // Where the pointer actually is, in pixels within the chart. The readout
  // tracks this rather than the hovered bucket's centre, which sits up to half
  // a slot away from the cursor and reads as lag.
  const [pointer, setPointer] = useState<{ x: number; y: number; w: number } | null>(null)

  // The local window, plus the committed one it was last reconciled against.
  const [state, setState] = useState<{ committed: View; view: View }>(() => ({
    committed: { from: committedFrom, to: committedTo },
    view: { from: committedFrom, to: committedTo },
  }))

  // Adjusting state during render, which is React's pattern for reacting to a
  // prop change. An incoming window that the view already shows is our own
  // debounced replace arriving, so the view stays put; anything else is an
  // outside navigation - the back button, or a link followed without a script
  // - and the view adopts it.
  if (state.committed.from !== committedFrom || state.committed.to !== committedTo) {
    const incoming = { from: committedFrom, to: committedTo }
    const alreadyShowing = state.view.from === incoming.from && state.view.to === incoming.to
    setState({ committed: incoming, view: alreadyShowing ? state.view : incoming })
  }
  const view = state.view
  const setView = useCallback(
    (next: (prev: View) => View) => setState((prev) => ({ ...prev, view: next(prev.view) })),
    []
  )

  const earliest = daily.length > 0 ? daily[0].key : todayKey

  /** Keep a window inside the history that was actually preloaded. */
  const clampToHistory = useCallback(
    (r: View): View => {
      if (r.from >= earliest) return r
      const span = daySpan(r.from, r.to)
      const to = shiftDayKey(earliest, span - 1)
      return { from: earliest, to: daySpan(to, todayKey) >= 1 ? to : todayKey }
    },
    [earliest, todayKey]
  )

  const settle = useCallback(
    (r: View): View => clampToHistory(withUsableSpan(r.from, r.to, hourlyFrom, todayKey)),
    [clampToHistory, hourlyFrom, todayKey]
  )

  // The URL follows the view on a debounce, and that navigation is what
  // re-renders the tables. Rapid changes - a pinch, a held button - keep
  // resetting the timer, so a whole gesture costs one request.
  useEffect(() => {
    if (view.from === committedFrom && view.to === committedTo) return
    const timer = setTimeout(() => {
      startTransition(() => router.replace(viewHref(view), { scroll: false }))
    }, COMMIT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [view, committedFrom, committedTo, router])

  const { points, granularity } = pickPoints(daily, hourly, hourlyFrom, view.from, view.to)
  const n = points.length
  const slot = W / Math.max(1, n)

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg || n === 0) return
      const rect = svg.getBoundingClientRect()
      if (rect.width === 0) return

      // Converted through the SVG's own matrix rather than by scaling the
      // element's width. Those differ whenever the viewBox and the element
      // disagree on aspect ratio, and the drawing ends up letterboxed inside
      // the box - which silently shifted every reading off the cursor.
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const local = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
      setHover(Math.min(n - 1, Math.max(0, Math.floor(local.x / slot))))
      setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width })
    },
    [n, slot]
  )

  // Pinch to zoom. Applied to the live view on every event, so the chart moves
  // with the fingers instead of snapping when the gesture ends.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      // A macOS trackpad pinch reaches the page as a ctrl-modified wheel
      // event. Plain scrolling has no ctrl and must still scroll the page.
      if (!e.ctrlKey) return
      // Must be cancellable, or the browser zooms the whole page instead -
      // which is why this is a native listener rather than React's onWheel,
      // whose wheel handling is passive.
      e.preventDefault()

      const ctm = el.getScreenCTM()
      if (!ctm) return
      const local = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
      const anchor = Math.min(1, Math.max(0, local.x / W))
      // Spreading fingers gives a negative delta, which narrows the window.
      const factor = Math.exp(e.deltaY * 0.01)
      setView((prev) => settle(zoomRangeAt(prev.from, prev.to, factor, anchor, todayKey)))
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [settle, todayKey, setView])

  const zoomBy = (factor: number) =>
    setView((prev) => settle(zoomRangeAt(prev.from, prev.to, factor, 0.5, todayKey)))
  const panBy = (fraction: number) =>
    setView((prev) => clampToHistory(panRange(prev.from, prev.to, fraction, todayKey)))
  const preset = (days: number) =>
    setView(() => settle({ from: shiftDayKey(todayKey, -(days - 1)), to: todayKey }))

  if (n === 0) return null

  const landings = points.map((p) => p.landings)
  // Floor at 1 so an entirely empty window cannot divide by zero and a flat
  // series sits on the baseline rather than rendering NaN.
  const peak = Math.max(1, ...landings)

  const coords = points.map((p, i) => ({
    x: i * slot + slot / 2,
    y: BASELINE - (p.landings / peak) * PLOT_H,
  }))
  const line = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  // The fill is closed along the baseline, not around the line, so a dip to
  // zero reads as zero rather than as a gap in the shape.
  const area = `M ${coords[0].x.toFixed(1)},${BASELINE} L ${line.replace(/,/g, " ")} L ${coords[
    n - 1
  ].x.toFixed(1)},${BASELINE} Z`

  // Per-bucket dots only while they stay distinguishable; at 365 points they
  // turn the line into a string of beads.
  const showPointDots = slot >= 20
  const labelEvery = Math.max(1, Math.ceil(n / 7))
  const selectedIndex = selectedKey ? points.findIndex((p) => p.key === selectedKey) : -1
  // Hover state survives a window change but the bucket count does not, so a
  // stale index must never reach the arrays.
  const hoverIndex = hover !== null && hover >= 0 && hover < n ? hover : null

  const span = daySpan(view.from, view.to)
  const atToday = view.to === todayKey
  const atEarliest = view.from === earliest
  const activePreset = atToday ? span : null

  const totals = points.reduce(
    (a, p) => ({
      landings: a.landings + p.landings,
      signups: a.signups + p.signups,
      sales: a.sales + p.sales,
    }),
    { landings: 0, signups: 0, sales: 0 }
  )
  const nothingAtAll = totals.landings === 0 && totals.signups === 0 && totals.sales === 0

  const ctrl =
    "inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs no-underline leading-none"
  const ctrlStyle = { borderColor: "var(--border)", color: "var(--foreground)" } as const
  const ctrlOff = { ...ctrlStyle, opacity: 0.35, pointerEvents: "none" as const }
  const ctrlOn = {
    borderColor: primary,
    background: primary,
    color: "var(--primary-foreground, #fff)",
  } as const
  const field =
    "rounded-md border px-2 py-1 text-xs leading-none [color-scheme:light] dark:[color-scheme:dark]"
  const fieldStyle = {
    borderColor: "var(--border)",
    background: "var(--background)",
    color: "var(--foreground)",
  } as const

  const hovered = hoverIndex !== null ? points[hoverIndex] : null

  return (
    <div className="mb-8">
      {/* A real GET form: without a script, submitting it produces ?from=&to=. */}
      <form
        method="get"
        className="flex flex-wrap items-center gap-2 mb-2"
        onSubmit={(e) => {
          const form = e.currentTarget
          const from = (form.elements.namedItem("from") as HTMLInputElement).value
          const to = (form.elements.namedItem("to") as HTMLInputElement).value
          if (!from || !to || from > to) return // let the browser/server deal with it
          e.preventDefault()
          setView(() => settle({ from, to }))
        }}
      >
        <label className="text-xs uppercase tracking-wide opacity-60" htmlFor="attr-from">
          Range
        </label>
        <input
          id="attr-from"
          type="date"
          name="from"
          key={`from-${view.from}`}
          defaultValue={view.from}
          min={earliest}
          max={todayKey}
          className={field}
          style={fieldStyle}
        />
        <span className="text-xs opacity-60">→</span>
        <input
          id="attr-to"
          type="date"
          name="to"
          key={`to-${view.to}`}
          defaultValue={view.to}
          min={earliest}
          max={todayKey}
          className={field}
          style={fieldStyle}
        />
        <button type="submit" className={ctrl} style={ctrlOn}>
          Apply
        </button>

        <span className="mx-1 opacity-25 select-none">|</span>

        {[1, 7, 30, 90].map((d) => (
          <a
            key={d}
            href={`?days=${d}`}
            onClick={(e) => {
              e.preventDefault()
              preset(d)
            }}
            className={ctrl}
            style={d === activePreset ? ctrlOn : ctrlStyle}
          >
            {d}d
          </a>
        ))}
      </form>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <a
          href={viewHref(panRange(view.from, view.to, -0.5, todayKey))}
          onClick={(e) => {
            e.preventDefault()
            panBy(-0.5)
          }}
          className={ctrl}
          style={atEarliest ? ctrlOff : ctrlStyle}
          title="Earlier"
        >
          ◀
        </a>
        <a
          href={viewHref(zoomRangeAt(view.from, view.to, 0.5, 0.5, todayKey))}
          onClick={(e) => {
            e.preventDefault()
            zoomBy(0.5)
          }}
          className={ctrl}
          style={ctrlStyle}
          title="Zoom in"
        >
          −
        </a>
        <a
          href={viewHref(zoomRangeAt(view.from, view.to, 2, 0.5, todayKey))}
          onClick={(e) => {
            e.preventDefault()
            zoomBy(2)
          }}
          className={ctrl}
          style={span >= Math.min(MAX_SPAN_DAYS, daily.length) ? ctrlOff : ctrlStyle}
          title="Zoom out"
        >
          +
        </a>
        <a
          href={viewHref(panRange(view.from, view.to, 0.5, todayKey))}
          onClick={(e) => {
            e.preventDefault()
            panBy(0.5)
          }}
          className={ctrl}
          style={atToday ? ctrlOff : ctrlStyle}
          title="Later"
        >
          ▶
        </a>

        <span className="text-xs opacity-70 ml-1">
          {points[0].label} – {points[n - 1].label}
          <span className="opacity-60">
            {" · "}
            {span} {span === 1 ? "day" : "days"}
            {" · "}
            {granularity === "hour" ? "per hour" : "per day"}
          </span>
        </span>
        {isPending && <span className="text-xs opacity-40">updating tables…</span>}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-1">
        <span className="text-xs opacity-60">
          <span
            className="inline-block align-middle mr-1"
            style={{ width: 14, height: 2, background: fg, opacity: 0.55 }}
          />
          landings
        </span>
        <span className="text-xs opacity-60">
          <span
            className="inline-block align-middle mr-1 rounded-full border"
            style={{ width: 9, height: 9, borderColor: fg }}
          />
          signups
        </span>
        <span className="text-xs opacity-60">
          <span
            className="inline-block align-middle mr-1 rounded-full"
            style={{ width: 9, height: 9, background: primary }}
          />
          sales
        </span>
      </div>

      <div className="relative">
        {hovered && pointer && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border px-2 py-1 text-xs whitespace-nowrap"
            style={{
              // Sits on the cursor, stopping short of either edge so the
              // readout never hangs off the chart.
              left: `${
                pointer.w > TIP_HALF * 2
                  ? Math.min(pointer.w - TIP_HALF, Math.max(TIP_HALF, pointer.x))
                  : pointer.w / 2
              }px`,
              transform: "translateX(-50%)",
              // Just above the pointer, so it never covers the point you are
              // reading.
              top: Math.max(-6, pointer.y - 38),
              borderColor: "var(--border)",
              background: "var(--background)",
              color: "var(--foreground)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
            }}
          >
            <strong>{hovered.label}</strong>
            <span className="opacity-70">
              {" · "}
              {plural(hovered.landings, "landing", "landings")}
              {" · "}
              {plural(hovered.signups, "signup", "signups")}
              {" · "}
              {plural(hovered.sales, "sale", "sales")}
            </span>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          // No height: the drawing then scales to the width and fills it. A
          // fixed height with this viewBox letterboxes it instead, leaving
          // dead space at both ends that pointer maths has to know about.
          style={{ display: "block", overflow: "visible", cursor: "pointer" }}
          onPointerMove={onPointerMove}
          onPointerLeave={() => {
            setHover(null)
            setPointer(null)
          }}
        >
          <desc>
            {`Landings, signups and sales ${
              granularity === "hour" ? "per hour" : "per day"
            } from ${view.from} to ${view.to}. ${plural(
              totals.landings,
              "landing",
              "landings"
            )}, ${plural(totals.signups, "signup", "signups")}, ${plural(
              totals.sales,
              "sale",
              "sales"
            )}.`}
          </desc>

          <line x1={0} y1={PLOT_TOP} x2={W} y2={PLOT_TOP} stroke={fg} strokeOpacity={0.12} />
          <text x={2} y={PLOT_TOP - 5} fontSize={10} fill={fg} fillOpacity={0.5}>
            {peak}
          </text>

          {/* Drawn before the line so the highlight sits behind it. */}
          {selectedIndex >= 0 && (
            <rect
              x={selectedIndex * slot}
              y={0}
              width={slot}
              height={BASELINE}
              fill={fg}
              fillOpacity={0.07}
            />
          )}

          <path d={area} fill={fg} fillOpacity={0.09} />
          <polyline
            points={line}
            fill="none"
            stroke={fg}
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {hoverIndex !== null && (
            <line
              x1={coords[hoverIndex].x}
              y1={PLOT_TOP - 8}
              x2={coords[hoverIndex].x}
              y2={BASELINE}
              stroke={fg}
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          )}

          <line x1={0} y1={BASELINE} x2={W} y2={BASELINE} stroke={fg} strokeOpacity={0.25} />

          {points.map((p, i) => {
            const c = coords[i]
            const selected = p.key === selectedKey
            const isHover = hoverIndex === i
            // Filtering the tables needs the server, so this one is a real
            // navigation. Clicking the selected point again clears it.
            const href = selected ? viewHref(view) : `${viewHref(view)}&bucket=${p.key}`

            const dotR = Math.max(2, Math.min(slot * 0.26, 5))
            const digits = String(p.sales).length
            const pillHalf = Math.min(slot * 0.46, 9 + digits * 4)
            const usePill = p.sales > 1 && pillHalf >= 9

            return (
              <a key={p.key} href={href}>
                <rect x={i * slot} y={0} width={slot} height={BASELINE} fill="transparent" />

                {p.sales > 0 && (
                  <line
                    x1={c.x}
                    y1={SALE_Y + 6}
                    x2={c.x}
                    y2={c.y}
                    stroke={primary}
                    strokeOpacity={0.3}
                    strokeWidth={1}
                  />
                )}

                {(showPointDots || selected || isHover) && (
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={selected || isHover ? 4 : 2.5}
                    fill="var(--background)"
                    stroke={fg}
                    strokeOpacity={selected || isHover ? 0.9 : 0.55}
                    strokeWidth={2}
                  />
                )}

                {p.signups > 0 && (
                  <circle
                    cx={c.x}
                    cy={SIGNUP_Y}
                    r={dotR}
                    fill="none"
                    stroke={fg}
                    strokeOpacity={0.55}
                    strokeWidth={1.5}
                  />
                )}

                {p.sales > 0 && !usePill && (
                  // Slightly fatter for a multi-sale bucket, so density still
                  // reads at a glance when there is no room for the number.
                  <circle cx={c.x} cy={SALE_Y} r={dotR * (p.sales > 1 ? 1.45 : 1)} fill={primary} />
                )}

                {usePill && (
                  <>
                    <rect
                      x={c.x - pillHalf}
                      y={SALE_Y - 8}
                      width={pillHalf * 2}
                      height={16}
                      rx={8}
                      fill={primary}
                    />
                    <text
                      x={c.x}
                      y={SALE_Y + 4}
                      fontSize={11}
                      fontWeight={600}
                      textAnchor="middle"
                      fill="var(--primary-foreground, #fff)"
                    >
                      {p.sales}
                    </text>
                  </>
                )}

                {/* Thinned labels, but the selected bucket always names itself -
                    and a thinned label close enough to collide gives way. */}
                {(selected ||
                  ((i % labelEvery === 0 || i === n - 1) &&
                    !(selectedIndex >= 0 && Math.abs(i - selectedIndex) * slot < 46))) && (
                  <text
                    x={c.x}
                    y={LABEL_Y}
                    fontSize={11}
                    textAnchor="middle"
                    fill={fg}
                    fillOpacity={selected ? 0.9 : 0.55}
                    fontWeight={selected ? 600 : 400}
                  >
                    {p.label}
                  </text>
                )}
              </a>
            )
          })}
        </svg>
      </div>

      <p className="text-xs opacity-60 mt-1">
        {nothingAtAll
          ? "Nothing recorded in this range."
          : selectedKey
            ? "Showing one bucket below. Click it again, or change the range, to clear."
            : `Pinch or use − and + to zoom. Click a point to filter the tables below to that ${
                granularity === "hour" ? "hour" : "day"
              }.`}
      </p>
    </div>
  )
}
