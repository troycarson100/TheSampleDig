import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import SiteNav from "@/components/SiteNav"
import AttributionChart from "@/components/AttributionChart"
import {
  resolveRange,
  bucketsForRange,
  seriesFor,
  todayKeyIn,
  shiftDayKey,
  CHART_HISTORY_DAYS,
  HOURLY_HISTORY_DAYS,
  REPORT_TZ,
} from "@/lib/attribution-chart"
import type { ChartPoint } from "@/lib/attribution-chart"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

function fmt(d: Date): string {
  return d.toLocaleString("en-US", { timeZone: REPORT_TZ, hour12: true })
}

/**
 * Reading the clock is impure and the purity lint forbids it during render, so
 * the window is resolved here. The page is force-dynamic, so this still
 * evaluates once per request.
 */
function windowFor(sp: { days?: string; from?: string; to?: string }) {
  const now = new Date()
  const todayKey = todayKeyIn(now)
  // The whole preloaded history, not just the visible window: the browser
  // windows into this locally, so zooming and panning need no round trip.
  const daily = bucketsForRange({
    from: shiftDayKey(todayKey, -(CHART_HISTORY_DAYS - 1)),
    to: todayKey,
    granularity: "day",
  })
  const hourly = bucketsForRange({
    from: shiftDayKey(todayKey, -(HOURLY_HISTORY_DAYS - 1)),
    to: todayKey,
    granularity: "hour",
  })
  const committed = resolveRange(sp, now)
  return {
    todayKey,
    daily,
    hourly,
    hourlyFrom: shiftDayKey(todayKey, -(HOURLY_HISTORY_DAYS - 1)),
    committed,
    committedBuckets: bucketsForRange(committed),
  }
}

/** Group a list of nullable keys into sorted [label, count] pairs. */
function tally(rows: { key: string | null; count: number }[]): [string, number][] {
  const m = new Map<string, number>()
  for (const r of rows) {
    const label = r.key || "(direct / none)"
    m.set(label, (m.get(label) ?? 0) + r.count)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export default async function AdminAttributionPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; from?: string; to?: string; bucket?: string }>
}) {
  if (!(await requireAdmin())) notFound()

  const sp = await searchParams
  const { todayKey, daily, hourly, hourlyFrom, committed, committedBuckets } = windowFor(sp)

  // The bucket list is the only source of truth for the drill-down: an
  // unrecognised ?bucket= is simply not found, so it can only ever mean "no
  // filter" rather than a date this page has to validate.
  const selected = committedBuckets.find((b) => b.key === sp.bucket) ?? null

  // The chart is fed the whole preloaded history; the tables only ever show
  // the committed window, or the single bucket clicked inside it.
  const historyRange = { gte: daily[0].start }
  const tableStart = selected ? selected.start : committedBuckets[0].start
  const tableEnd = selected ? selected.end : committedBuckets[committedBuckets.length - 1].end
  const tableRange = { gte: tableStart, lt: tableEnd }

  const [landingRows, signupRows, allSales, landingTimes, signupTimes] = await Promise.all([
    prisma.landingEvent.groupBy({
      by: ["referrerHost"],
      where: { createdAt: tableRange },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["attributionReferrerHost"],
      where: { createdAt: tableRange },
      _count: { _all: true },
    }),
    prisma.purchase.findMany({
      where: { createdAt: historyRange },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            email: true,
            attributionReferrerHost: true,
            attributionUtmSource: true,
            attributionUtmCampaign: true,
            attributionLandingPath: true,
          },
        },
      },
    }),
    // Timestamps only, for the chart. LandingEvent.visitorId is unique, so this
    // is one row per first-touch visitor rather than one per pageview - bounded
    // by visitor count, not by traffic.
    prisma.landingEvent.findMany({ where: { createdAt: historyRange }, select: { createdAt: true } }),
    prisma.user.findMany({ where: { createdAt: historyRange }, select: { createdAt: true } }),
  ])

  const [utmLandings, utmSignups] = await Promise.all([
    prisma.landingEvent.groupBy({
      by: ["utmSource", "utmCampaign"],
      where: { createdAt: tableRange },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["attributionUtmSource"],
      where: { createdAt: tableRange },
      _count: { _all: true },
    }),
  ])

  // Sales are fetched once over the whole window for the chart; the table
  // filters them in memory rather than paying for a second query.
  const sales = allSales.filter((s) => s.createdAt >= tableStart && s.createdAt < tableEnd)

  const landingTimestamps = landingTimes.map((r) => r.createdAt)
  const signupTimestamps = signupTimes.map((r) => r.createdAt)
  const saleTimestamps = allSales.map((s) => s.createdAt)

  // Only plain data crosses into the client component - no Date objects.
  function pointsFor(bucketList: typeof daily): ChartPoint[] {
    const landed = seriesFor(bucketList, landingTimestamps)
    const signed = seriesFor(bucketList, signupTimestamps)
    const sold = seriesFor(bucketList, saleTimestamps)
    return bucketList.map((b, i) => ({
      key: b.key,
      label: b.label,
      landings: landed[i] ?? 0,
      signups: signed[i] ?? 0,
      sales: sold[i] ?? 0,
    }))
  }
  const dailyPoints = pointsFor(daily)
  const hourlyPoints = pointsFor(hourly)

  const landings = tally(landingRows.map((r) => ({ key: r.referrerHost, count: r._count._all })))
  const signups = new Map(
    tally(signupRows.map((r) => ({ key: r.attributionReferrerHost, count: r._count._all })))
  )
  const salesByHost = new Map<string, number>()
  for (const s of sales) {
    const k = s.user.attributionReferrerHost || "(direct / none)"
    salesByHost.set(k, (salesByHost.get(k) ?? 0) + 1)
  }

  const utmRows = tally(
    utmLandings.map((r) => ({
      key: r.utmSource ? `${r.utmSource} / ${r.utmCampaign ?? "—"}` : null,
      count: r._count._all,
    }))
  )
  const utmSignupsBySource = new Map(
    tally(utmSignups.map((r) => ({ key: r.attributionUtmSource, count: r._count._all })))
  )

  const th = "text-left px-3 py-2 text-xs uppercase tracking-wide opacity-60"
  const td = "px-3 py-2 text-sm border-t"

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-5xl mx-auto px-4 mt-[56px] py-8" style={{ color: "var(--foreground)" }}>
        <h1 className="text-2xl font-bold mb-1">Attribution</h1>
        <p className="text-sm opacity-70 mb-4">First-touch. Times in Pacific.</p>

        <AttributionChart
          daily={dailyPoints}
          hourly={hourlyPoints}
          hourlyFrom={hourlyFrom}
          committedFrom={committed.from}
          committedTo={committed.to}
          todayKey={todayKey}
          selectedKey={selected?.key ?? null}
        />

        {selected && (
          <p className="text-sm mb-6">
            Tables below show <strong>{selected.label}</strong> only.{" "}
            <a
              href={`?from=${committed.from}&to=${committed.to}`}
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              ← back to the whole window
            </a>
          </p>
        )}

        <h2 className="text-lg font-semibold mt-8 mb-2">By referrer</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Referrer</th>
              <th className={th}>Landings</th>
              <th className={th}>Signups</th>
              <th className={th}>Sales</th>
            </tr>
          </thead>
          <tbody>
            {landings.length === 0 && (
              <tr>
                <td className={td} colSpan={4}>
                  No landings recorded in this range.
                </td>
              </tr>
            )}
            {landings.map(([host, count]) => (
              <tr key={host}>
                <td className={td}>{host}</td>
                <td className={td}>{count}</td>
                <td className={td}>{signups.get(host) ?? 0}</td>
                <td className={td}>{salesByHost.get(host) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-lg font-semibold mt-8 mb-2">By UTM source / campaign</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Source / campaign</th>
              <th className={th}>Landings</th>
              <th className={th}>Signups (by source)</th>
            </tr>
          </thead>
          <tbody>
            {utmRows.length === 0 && (
              <tr>
                <td className={td} colSpan={3}>
                  No tagged traffic in this range.
                </td>
              </tr>
            )}
            {utmRows.map(([label, count]) => (
              <tr key={label}>
                <td className={td}>{label}</td>
                <td className={td}>{count}</td>
                <td className={td}>{utmSignupsBySource.get(label.split(" / ")[0]) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-lg font-semibold mt-8 mb-2">Sales ({sales.length})</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>When (PT)</th>
              <th className={th}>Buyer</th>
              <th className={th}>Product</th>
              <th className={th}>Referrer</th>
              <th className={th}>UTM source</th>
              <th className={th}>Landed on</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr>
                <td className={td} colSpan={6}>
                  No sales in this range.
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr key={s.id}>
                <td className={td}>{fmt(s.createdAt)}</td>
                <td className={td}>{s.user.email}</td>
                <td className={td}>{s.product}</td>
                <td className={td}>{s.user.attributionReferrerHost ?? "—"}</td>
                <td className={td}>{s.user.attributionUtmSource ?? "—"}</td>
                <td className={td}>{s.user.attributionLandingPath ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  )
}
