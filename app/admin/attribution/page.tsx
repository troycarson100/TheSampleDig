import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

const PT = "America/Los_Angeles"

function fmt(d: Date): string {
  return d.toLocaleString("en-US", { timeZone: PT, hour12: true })
}

/**
 * Start of the reporting window. Kept out of the component body because reading
 * the clock is impure and the purity lint forbids that during render. The page
 * is force-dynamic, so this still evaluates once per request.
 */
function cutoff(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
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
  searchParams: Promise<{ days?: string }>
}) {
  if (!(await requireAdmin())) notFound()

  const sp = await searchParams
  const parsed = Number(sp.days)
  const days = Number.isFinite(parsed) ? Math.min(90, Math.max(1, Math.floor(parsed))) : 7
  const range = { gte: cutoff(days) }

  const [landingRows, signupRows, sales] = await Promise.all([
    prisma.landingEvent.groupBy({
      by: ["referrerHost"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["attributionReferrerHost"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.purchase.findMany({
      where: { createdAt: range },
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
  ])

  const [utmLandings, utmSignups] = await Promise.all([
    prisma.landingEvent.groupBy({
      by: ["utmSource", "utmCampaign"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["attributionUtmSource"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
  ])

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
      <main className="max-w-5xl mx-auto px-4 py-8" style={{ color: "var(--foreground)" }}>
        <h1 className="text-2xl font-bold mb-1">Attribution</h1>
        <p className="text-sm opacity-70 mb-6">
          First-touch, last {days} days. Times in Pacific.{" "}
          {[1, 7, 30, 90].map((d) => (
            <a key={d} href={`?days=${d}`} className="underline mr-2" style={{ color: "var(--primary)" }}>
              {d}d
            </a>
          ))}
        </p>

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
