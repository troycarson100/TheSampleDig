import type { AffiliateStats } from "@/lib/affiliate"

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export default function AffiliateDashboard({
  affiliate,
  stats,
  baseUrl,
}: {
  affiliate: { name: string; code: string }
  stats: AffiliateStats
  baseUrl: string
}) {
  const link = `${baseUrl}/shft?ref=${affiliate.code}`
  const tiles: [string, string][] = [
    ["Clicks (30d / all)", `${stats.clicks30d} / ${stats.clicksTotal}`],
    ["Sales", String(stats.salesCount)],
    ["Revenue driven", usd(stats.grossCents)],
    ["Commission earned", usd(stats.commissionCents)],
    ["Owed to you", usd(stats.owedCents)],
  ]
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 text-neutral-100">
      <h1 className="text-2xl font-semibold">shft affiliate — {affiliate.name}</h1>
      <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-sm">
        <p>
          Your link: <code className="select-all break-all text-amber-300">{link}</code>
        </p>
        <p className="mt-1">
          Your code (buyers can type it at checkout):{" "}
          <code className="select-all text-amber-300">{affiliate.code}</code>
        </p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-neutral-700 bg-neutral-900 p-3">
            <div className="text-xs text-neutral-400">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Sales</h2>
      {stats.referrals.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">No attributed sales yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-400">
              <tr>
                <th className="py-1 pr-4 font-normal">Date</th>
                <th className="py-1 pr-4 font-normal">Sale</th>
                <th className="py-1 pr-4 font-normal">Your cut</th>
                <th className="py-1 pr-4 font-normal">Via</th>
                <th className="py-1 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.referrals.map((r) => (
                <tr key={r.id} className="border-t border-neutral-800">
                  <td className="py-1.5 pr-4">{fmtDate(r.createdAt)}</td>
                  <td className="py-1.5 pr-4">{usd(r.grossAmountCents)}</td>
                  <td className="py-1.5 pr-4">{usd(r.commissionCents)}</td>
                  <td className="py-1.5 pr-4">{r.source === "code" ? "typed code" : "link"}</td>
                  <td className="py-1.5">{r.refundedAt ? "refunded" : r.paidOut ? "paid" : "pending payout"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold">Payouts</h2>
      {stats.payouts.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">No payouts yet.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {stats.payouts.map((p) => (
            <li key={p.id} className="rounded border border-neutral-800 bg-neutral-900 px-3 py-2">
              {fmtDate(p.paidAt)} — {usd(p.amountCents)}
              {p.note ? <span className="text-neutral-400"> · {p.note}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
